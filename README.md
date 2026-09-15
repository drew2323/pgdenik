# PG Deník

Nový web `pgdenik.cz`: responzivní informační deník s Payload CMS, stromovou navigací a bloky pro text, obrázky, YouTube a XCvid.

## Dokumentace

- `SPEC.md` — schválený product scope
- `DESIGN-BRIEF.md` — vizuální zadání pro Codex
- `ARCHITECTURE.md` — high-level architektura
- `PROJECT-INFRASTRUCTURE.md` — deployment a ověřovací důkazy
- `WEB_PLATFORM.md` — společný platformní standard

## Lokálně

```bash
cp .env.example .env
docker compose up -d postgres
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

Admin je na `/admin`, veřejný web na `/` a readiness na `/api/health`.

## Ověření

```bash
./scripts/quality.sh
./scripts/verify.sh http://127.0.0.1:3000
```

Deployment probíhá výhradně přes GitHub → Coolify. Produkční DNS `pgdenik.cz` se nepřepíná bez samostatného schválení.
