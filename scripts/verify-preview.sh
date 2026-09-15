#!/bin/sh
set -eu

PR_NUMBER=${1:?Usage: PREVIEW_HOST_SUFFIX=<host> $0 <pr-number> <preview-url>}
PREVIEW_URL=${2:?Usage: PREVIEW_HOST_SUFFIX=<host> $0 <pr-number> <preview-url>}
: "${PREVIEW_HOST_SUFFIX:?PREVIEW_HOST_SUFFIX is required}"
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
case "$PR_NUMBER" in ''|*[!0-9]*|0*) printf 'preview failed: PR number must be a positive integer\n' >&2; exit 2 ;; esac
python3 -c 'import re,sys; raise SystemExit(0 if re.fullmatch(r"(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?",sys.argv[1]) else 1)' "$PREVIEW_HOST_SUFFIX" || {
  printf 'preview failed: invalid configured host suffix\n' >&2; exit 2;
}
expected="https://pr-$PR_NUMBER.$PREVIEW_HOST_SUFFIX"
[ "${PREVIEW_URL%/}" = "$expected" ] || { printf 'preview failed: URL does not match configured PR host\n' >&2; exit 2; }

checks_found=0
for _ in $(seq 1 30); do
  count=$(gh pr checks "$PR_NUMBER" --json state --jq 'length' 2>/dev/null || printf '0')
  if [ "$count" -gt 0 ]; then checks_found=1; break; fi
  sleep 2
done
[ "$checks_found" -eq 1 ] || { printf 'preview failed: no CI checks found for PR %s\n' "$PR_NUMBER" >&2; exit 1; }
timeout 300 gh pr checks "$PR_NUMBER" --watch --interval 10

for _ in $(seq 1 6); do
  if "$SCRIPT_DIR/verify.sh" "$expected" >/dev/null 2>&1; then printf 'PREVIEW_OK %s\n' "$expected"; exit 0; fi
  sleep 10
done
printf 'preview failed: URL did not become healthy: %s\n' "$expected" >&2
exit 1
