# PG Deník

Osobní paraglidingový deník na `https://pgdenik.cz`. Veřejná část zobrazuje strom zápisů, text, obrázky a video embedy; správa obsahu běží přes Payload CMS.

## Stack

- Next.js 16 + React 19 + TypeScript
- Payload CMS 3
- PostgreSQL 16
- Tailwind CSS
- Vitest + Playwright
- Docker image nasazovaný přes Coolify

Aktuální chování a datový model určují kód, migrace a testy. Zadání změn, acceptance criteria, rozhodnutí a průběžný stav patří do projektu **PG Deník** v Paperclipu, nikoli do nových handoff/spec souborů v repozitáři.

## Lokální spuštění

Požadavky: Node.js 20+, Corepack/pnpm a Docker.

```bash
cp .env.example .env
docker compose up -d postgres
corepack pnpm install --frozen-lockfile
corepack pnpm run payload -- migrate
corepack pnpm dev
```

- web: `http://localhost:3000`
- administrace: `http://localhost:3000/admin`
- health: `http://localhost:3000/api/health`

## Ověření změny

```bash
./scripts/quality.sh
```

Quality gate spouští lint, typecheck, integrační testy, build a E2E testy. CI používá stejný kontrakt po jednotlivých krocích.

## Jak přispívat

Před prací si přečti `AGENTS.md`. Stabilní informace o prostředích, preview a produkčním nasazení jsou v `docs/OPERATIONS.md`.

Standardní tok je:

`Paperclip ticket → samostatná branch → testy → PR + preview → lidské review → merge → produkce`

Bez aktivního Paperclip ticketu se změna nezačíná. Produkční merge a deploy nikdy neschvaluje agent sám.
