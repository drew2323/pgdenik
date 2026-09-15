#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)
cd "$REPO_ROOT"

[ "$#" -eq 1 ] && [ "$1" = "--infrastructure" ] || {
  printf 'Usage: %s --infrastructure\n' "$0" >&2
  exit 2
}

for command_name in git gh node corepack codex curl timeout python3 getent; do
  command -v "$command_name" >/dev/null 2>&1 || { printf 'preflight failed: missing command %s\n' "$command_name" >&2; exit 1; }
done
corepack pnpm --version >/dev/null

for required_file in SPEC.md ARCHITECTURE.md PROJECT-INFRASTRUCTURE.md WEB_PLATFORM.md AGENTS.md Dockerfile package.json pnpm-lock.yaml scripts/start.sh scripts/migrate.sh scripts/migrate.mjs scripts/quality.sh scripts/verify.sh scripts/verify-preview.sh scripts/verify-production.sh; do
  [ -f "$required_file" ] || { printf 'preflight failed: missing %s\n' "$required_file" >&2; exit 1; }
done

validate_status() {
  python3 -c 'import re,sys
p,expected=sys.argv[1:]
lines=open(p).read().splitlines()
hits=[(i,m.group(1)) for i,line in enumerate(lines) if (m:=re.fullmatch(r"\*\*Status:\*\*\s*(\S+)\s*",line))]
if len(hits)!=1: raise SystemExit(f"preflight failed: duplicate status or missing status in {p}")
i,value=hits[0]
if i>=10 or value!=expected: raise SystemExit(f"preflight failed: {p} status must be {expected}")' "$1" "$2"
}
validate_status SPEC.md SPEC_READY
validate_status ARCHITECTURE.md ARCHITECTURE_READY

gh auth status >/dev/null 2>&1 || { printf 'preflight failed: GitHub authentication unavailable\n' >&2; exit 1; }
gh api user >/dev/null

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then :
elif command -v sudo >/dev/null 2>&1 && sudo -n docker info >/dev/null 2>&1; then :
else printf 'preflight failed: Docker daemon unavailable\n' >&2; exit 1
fi

: "${COOLIFY_API_BASE:?COOLIFY_API_BASE is required}"
: "${COOLIFY_TOKEN:?COOLIFY_TOKEN is required}"
: "${COOLIFY_WEBHOOK_URL:?COOLIFY_WEBHOOK_URL is required}"
: "${COOLIFY_WEBHOOK_SECRET:?COOLIFY_WEBHOOK_SECRET is required}"
: "${COOLIFY_SERVER_UUID:?COOLIFY_SERVER_UUID is required}"
: "${COOLIFY_DESTINATION_UUID:?COOLIFY_DESTINATION_UUID is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GITHUB_REPOSITORY_MODE:=existing}"
: "${PRODUCTION_HOST:?PRODUCTION_HOST is required}"
: "${PREVIEW_HOST_SUFFIX:?PREVIEW_HOST_SUFFIX is required}"

validate_host() {
  python3 -c 'import re,sys; raise SystemExit(0 if re.fullmatch(r"(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?",sys.argv[1]) else 1)' "$1" || {
    printf 'preflight failed: invalid hostname\n' >&2; exit 1;
  }
}
validate_host "$PRODUCTION_HOST"
validate_host "$PREVIEW_HOST_SUFFIX"
if [ "${PREFLIGHT_REQUIRE_DNS:-0}" = "1" ]; then
  getent hosts "$PRODUCTION_HOST" >/dev/null || { printf 'preflight failed: production hostname does not resolve\n' >&2; exit 1; }
  getent hosts "pr-0.$PREVIEW_HOST_SUFFIX" >/dev/null || { printf 'preflight failed: preview hostname does not resolve\n' >&2; exit 1; }
fi

case "$GITHUB_REPOSITORY_MODE" in
  existing)
    gh repo view "$GITHUB_REPOSITORY" >/dev/null 2>&1 || { printf 'preflight failed: canonical repository is inaccessible\n' >&2; exit 1; }
    remote=$(git remote get-url origin 2>/dev/null || true)
    case "$remote" in
      *"github.com/$GITHUB_REPOSITORY.git"|*"github.com/$GITHUB_REPOSITORY"|*"github.com:$GITHUB_REPOSITORY.git"|*"github.com:$GITHUB_REPOSITORY") ;;
      *) printf 'preflight failed: repository does not match origin\n' >&2; exit 1 ;;
    esac
    ;;
  new)
    if gh repo view "$GITHUB_REPOSITORY" >/dev/null 2>&1; then printf 'preflight failed: repository already exists\n' >&2; exit 1; fi
    owner=${GITHUB_REPOSITORY%%/*}; login=$(gh api user --jq .login)
    [ "$owner" = "$login" ] || { printf 'preflight failed: repository owner is not authenticated user\n' >&2; exit 1; }
    ;;
  *) printf 'preflight failed: GITHUB_REPOSITORY_MODE must be existing or new\n' >&2; exit 1 ;;
esac

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT
headers="Authorization: Bearer $COOLIFY_TOKEN"
http() {
  method=$1; output=$2; shift 2
  attempt=1
  while [ "$attempt" -le 2 ]; do
    status=$(curl --silent --show-error --max-time 15 --output "$output" --write-out '%{http_code}' -X "$method" "$@") && rc=0 || rc=$?
    if [ "$rc" -eq 0 ]; then case "$status" in 2??) return 0 ;; 5??) ;; *) printf 'preflight failed: HTTP %s\n' "$status" >&2; return 1 ;; esac; fi
    [ "$attempt" -eq 1 ] || { printf 'preflight failed: network/5xx after retry\n' >&2; return 1; }
    attempt=2
  done
}
http GET "$tmpdir/team.json" -H "$headers" -- "${COOLIFY_API_BASE%/}/teams/current"
http GET "$tmpdir/server.json" -H "$headers" -- "${COOLIFY_API_BASE%/}/servers/$COOLIFY_SERVER_UUID"
http GET "$tmpdir/destination.json" -H "$headers" -- "${COOLIFY_API_BASE%/}/destinations/$COOLIFY_DESTINATION_UUID"
python3 -c 'import json,sys
server=json.load(open(sys.argv[1])); dest=json.load(open(sys.argv[2])); su,du=sys.argv[3:]
assert server.get("uuid")==su, "server UUID mismatch"
assert dest.get("uuid")==du and dest.get("server_uuid")==su, "destination/server mismatch"
assert server.get("settings",{}).get("is_reachable") is True and server.get("settings",{}).get("is_usable") is True, "server unavailable"
assert server.get("proxy",{}).get("type")=="TRAEFIK" and server.get("proxy",{}).get("status")=="running", "proxy unavailable"' "$tmpdir/server.json" "$tmpdir/destination.json" "$COOLIFY_SERVER_UUID" "$COOLIFY_DESTINATION_UUID"

payload='{"zen":"web-delivery-preflight"}'
signature=$(PAYLOAD="$payload" python3 -c 'import hashlib,hmac,os; print(hmac.new(os.environ["COOLIFY_WEBHOOK_SECRET"].encode(),os.environ["PAYLOAD"].encode(),hashlib.sha256).hexdigest())')
delivery=$(python3 -c 'import uuid; print(uuid.uuid4())')
http POST "$tmpdir/webhook.json" -H 'Content-Type: application/json' -H 'X-GitHub-Event: ping' -H "X-GitHub-Delivery: $delivery" -H "X-Hub-Signature-256: sha256=$signature" --data "$payload" -- "$COOLIFY_WEBHOOK_URL"

printf 'PREFLIGHT_OK\n'
