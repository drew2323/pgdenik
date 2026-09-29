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

## Obnovení importovaného obsahu

Import z veřejného legacy webu je explicitní provozní krok, nikoli součást buildu nebo
startu aplikace:

```bash
corepack pnpm import:live
```

Příkaz používá `DATABASE_URL` a `PAYLOAD_SECRET` aktuálního prostředí. Je
opakovatelný, existující stránky identifikuje podle zdrojové URL a všechny změny
stránek provede v jedné databázové transakci. Před zápisem kontroluje přesnou sadu
67 veřejných zdrojových stránek a odmítne neúplný zdroj i neočekávané zastaralé
záznamy. Pro refresh preview se spouští jednou v novém PR kontejneru po jeho
zdravém nasazení; tím zůstává startup/migrační kontrakt beze změny.

## Ověření

```bash
./scripts/quality.sh
./scripts/verify.sh http://127.0.0.1:3000
```

Deployment probíhá výhradně přes GitHub → Coolify. Produkční DNS `pgdenik.cz` se nepřepíná bez samostatného schválení.
