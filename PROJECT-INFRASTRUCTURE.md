# Project Infrastructure

**Status:** INFRASTRUCTURE READY
**Project:** PG Deník
**Owner:** David Brázda
**Infrastructure bootstrap scope:** APPROVED 2026-09-15 — nový standardní projekt, GitHub/Coolify pipeline, oddělené DB, runtime migrace, healthcheck a preview; produkční DNS cutover není schválen

## Workspace and repository

- Local workspace: `/home/david/Projects/pgdenik`
- GitHub repository: `https://github.com/drew2323/pgdenik`
- Default branch: `main`
- Bootstrap commit: `68979a85273ef9e452cba54866179682e9c8396d`
- Opravený ověřený runtime commit: `ab2d36e26dbddc59c976f3b1ba27072a33a734b2`

## Environments

- Production prototype: `https://pgdenik.2.56.97.3.sslip.io`; source `main`; project `yq5m9smaaeesx6udjmmecp1o`; app `accqwcih3fe5lapan5prkfmx`; DB `j86ujwj5ipp6sg8mikhc8rsv`
- Preview: `https://pr-<id>.pgdenik.2.56.97.3.sslip.io`; automatic PR deployment stejné app; DB `u3gp6y3q4whsnncdsucxnylb`
- Final public domain: `https://pgdenik.cz` — mimo bootstrap; vyžaduje samostatné schválení cutoveru

Preview database strategy: `shared-preview`; současně smí běžet jen jedna změna s migrací. U PR #1 byl v běžícím kontejneru ověřen host `u3gp6y3q4whsnncdsucxnylb` a DB `pgdenik_preview`.

## Deployment contract

- Preflight: `./scripts/preflight.sh --infrastructure`
- Local quality gate: `./scripts/quality.sh`
- Build: `corepack pnpm build`
- Start: `./scripts/start.sh`
- Migrations: `./scripts/migrate.sh` přes `migrate.mjs`, advisory lock a `lock_timeout=120s`
- Coolify pre-deploy: prázdný; migrace běží při startu kontejneru
- Verification: `./scripts/verify.sh <base-url>`
- Internal port: `3000`
- Health endpoint: `/api/health`
- Coolify build pack: `Dockerfile`

## Persistent resources

- PostgreSQL production: `j86ujwj5ipp6sg8mikhc8rsv`; kontejnerově ověřen `healthy`
- PostgreSQL preview: `u3gp6y3q4whsnncdsucxnylb`; kontejnerově ověřen `healthy`
- Upload/file storage: persistent storage `pgdenik-media` mounted at `/app/media`
- Backup policy: Coolify/PostgreSQL backup a kopie upload volume před datovou změnou nebo DNS cutoverem
- Restore test: před DNS cutoverem; infrastrukturní gate používá aplikační rollback bez uživatelských dat

Secrets jsou mimo Git v Coolify nebo lokálním necommitovaném `.env`.

## First deployment proof

- Skeleton commit: `68979a85273ef9e452cba54866179682e9c8396d`
- Runtime fix a čistá lokální DB: commit `ab2d36e26dbddc59c976f3b1ba27072a33a734b2`; jedna migrace; `/api/health` 200; `LOCAL_OK`
- Production deployment: `fgujceqw92pcaire3mk99vgm`, `finished`, webhook `true`, přesný commit `ab2d36e26dbddc59c976f3b1ba27072a33a734b2`
- Production CI: `https://github.com/drew2323/pgdenik/actions/runs/34935953650`, success, commit `ab2d36e26dbddc59c976f3b1ba27072a33a734b2`
- Production URL/HTTPS/health: `https://pgdenik.2.56.97.3.sslip.io`, `scripts/verify.sh` prošel, `/api/health` vrací `{"status":"ok"}`
- Preview PR: `https://github.com/drew2323/pgdenik/pull/1`
- Preview deployment: `lkfjnfhgv1xx8mp4m3gnvgkd`, `finished`, webhook `true`, commit `ff681a87defe3d54493db60e55554584a3ae5bda`
- Preview CI: `https://github.com/drew2323/pgdenik/actions/runs/34936482806`, success
- Preview URL/HTTPS/health: `https://pr-1.pgdenik.2.56.97.3.sslip.io`, `PREVIEW_OK`, `/api/health` 200
- Git webhook: GitHub hook `679460580`; podepsaný `ping`, `push` a `pull_request` delivery vrací 200
- Runtime-only secrets: produkční i preview `DATABASE_URL` a `PAYLOAD_SECRET` mají `is_buildtime=false`, `is_runtime=true`; hodnoty mezi prostředími jsou rozdílné
- First deployment migration: ověřena v čisté lokální DB i na Coolify produkci přes zdravý DB-aware endpoint
- Preview teardown: po zavření PR #1 kontejner `accqwcih3fe5lapan5prkfmx-pr-1` neexistuje a preview URL není zdravá
- Druhý production deployment: `2c916dswwzcmqnibevrvj8su`, `finished`, webhook `true`, commit `eb6d91c51ffc8bfb5f42dede23526c706b466159`; CI `https://github.com/drew2323/pgdenik/actions/runs/34937205629`, success
- Rollback: `xnzl8p7mn72bvnky9mkyxkji`, `finished`, `rollback=true`, přes plný SHA `ab2d36e26dbddc59c976f3b1ba27072a33a734b2`; následné HTTPS a `/api/health` prošly

Infrastrukturní gate je splněný. Následující push tohoto manifestu vrátí prototype prostředí automatickým webhookem na aktuální `main`; stav se ověřuje veřejným healthcheckem před Development Handoffem.
