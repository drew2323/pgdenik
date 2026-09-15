#!/bin/sh
set -eu

PRODUCTION_URL=${1:?Usage: PRODUCTION_HOST=<host> $0 <production-url>}
: "${PRODUCTION_HOST:?PRODUCTION_HOST is required}"
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
python3 -c 'import re,sys; raise SystemExit(0 if re.fullmatch(r"(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?",sys.argv[1]) else 1)' "$PRODUCTION_HOST" || {
  printf 'production failed: invalid configured host\n' >&2; exit 2;
}
expected="https://$PRODUCTION_HOST"
[ "${PRODUCTION_URL%/}" = "$expected" ] || { printf 'production failed: URL does not match configured host\n' >&2; exit 2; }
"$SCRIPT_DIR/verify.sh" "$expected" >/dev/null
printf 'PRODUCTION_OK %s\n' "$expected"
