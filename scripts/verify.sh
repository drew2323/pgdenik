#!/bin/sh
set -eu

BASE_URL=${1:-${BASE_URL:-}}
if [ -z "$BASE_URL" ]; then echo "Usage: $0 <https-base-url>" >&2; exit 2; fi
case "$BASE_URL" in https://*) ;; *) printf 'verification failed: HTTPS URL required\n' >&2; exit 2 ;; esac
command -v python3 >/dev/null 2>&1 || { printf 'verification failed: python3 is required\n' >&2; exit 1; }

BASE_URL=${BASE_URL%/}
health_body=$(mktemp)
trap 'rm -f "$health_body"' EXIT

status=$(curl --silent --show-error --max-time 15 --output "$health_body" --write-out '%{http_code}' -- "$BASE_URL/api/health")
case "$status" in 2??) ;; *) printf 'verification failed: health returned HTTP %s\n' "$status" >&2; exit 1 ;; esac
python3 -c 'import json,sys; data=json.load(open(sys.argv[1])); raise SystemExit(0 if isinstance(data,dict) and data.get("status")=="ok" else 1)' "$health_body" || {
  printf 'verification failed: top-level health status is not ok JSON\n' >&2
  exit 1
}

status=$(curl --silent --show-error --max-time 15 --output /dev/null --write-out '%{http_code}' -- "$BASE_URL/")
case "$status" in 2??) ;; *) printf 'verification failed: homepage returned HTTP %s\n' "$status" >&2; exit 1 ;; esac
printf 'verified: %s\n' "$BASE_URL"
