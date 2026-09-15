#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

exec node "$SCRIPT_DIR/migrate.mjs"
