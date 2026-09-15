# Project Infrastructure

**Status:** DRAFT
**Project:** PG Deník
**Owner:** David Brázda

## Workspace and repository

- Local workspace: `/home/david/Projects/pgdenik`
- GitHub repository: `https://github.com/drew2323/pgdenik` (vytvoří se po `PREFLIGHT_OK`)
- Default branch: `main`
- Bootstrap commit: TBD

## Environments

- Production prototype: `https://pgdenik.2.56.97.3.sslip.io`, source `main`, Coolify app TBD, DB TBD
- Preview: `https://pr-<id>.pgdenik.2.56.97.3.sslip.io`, source pull request, stejná app TBD, oddělená DB TBD
- Final public domain: `https://pgdenik.cz` — mimo bootstrap; vyžaduje samostatné schválení cutoveru

Preview database strategy: `shared-preview`; současně smí běžet jen jedna změna s migrací.

## Deployment contract

- Preflight: `./scripts/preflight.sh --infrastructure`
- Local quality gate: `./scripts/quality.sh`
- Build: `corepack pnpm build`
- Start: `./scripts/start.sh`
- Migrations: `./scripts/migrate.sh`
- Coolify pre-deploy: prázdný; startup migrace používá PostgreSQL advisory lock
- Verification: `./scripts/verify.sh <base-url>`
- Internal port: `3000`
- Health endpoint: `/api/health`
- Coolify build pack: `Dockerfile`

## Persistent resources

- PostgreSQL production: TBD
- PostgreSQL preview: TBD
- Upload/file storage: perzistentní volume pro Payload media; TBD UUID/path
- Backup policy: Coolify/PostgreSQL backup a kopie upload volume před datovou změnou nebo DNS cutoverem
- Restore test: TBD

Secrets jsou mimo Git v Coolify nebo lokálním necommitovaném `.env`.

## First deployment proof

- Skeleton commit: TBD
- Production deployment URL: TBD
- Preview PR: TBD
- Preview deployment URL: TBD
- HTTPS verified: TBD
- Healthcheck verified: TBD
- Git webhook verified: TBD
- Runtime-only secrets verified: TBD
- First deployment migration verified: TBD
- Preview teardown verified: TBD
- Rollback verified: TBD
- Evidence/log link: TBD

Status se změní na `INFRASTRUCTURE_READY` pouze po ověřeném Git → Coolify → VPS → HTTPS toku a automatickém preview testu.
