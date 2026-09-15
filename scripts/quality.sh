#!/bin/sh
set -eu

corepack pnpm install --frozen-lockfile
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test:int
corepack pnpm build

if [ -z "${PLAYWRIGHT_EXECUTABLE_PATH:-}" ] && command -v chromium >/dev/null 2>&1; then
  export PLAYWRIGHT_EXECUTABLE_PATH=$(command -v chromium)
fi
corepack pnpm test:e2e

printf 'LOCAL_OK\n'
