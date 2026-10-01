# Operations

Tento dokument obsahuje pouze stabilní provozní kontrakt. Aktuální změny, incidenty, rollout rozhodnutí a důkazy patří do Paperclip ticketu.

## Prostředí

| Prostředí | URL | Data | Účel |
|---|---|---|---|
| Local | `http://localhost:3000` | lokální PostgreSQL z `docker-compose.yml` | vývoj a testy |
| Preview | URL vytvořená Coolify a vložená do PR | oddělená preview databáze | lidské review PR |
| Production | `https://pgdenik.cz` | produkční PostgreSQL + perzistentní media | veřejný web |

Health endpoint je vždy `/api/health`. Preview ani lokální vývoj nesmí používat produkční databázi nebo produkční secrets.

## Vlastnictví systémů

- Git: `https://github.com/drew2323/pgdenik`, výchozí branch `main`
- Plánování a stav práce: Paperclip, projekt **PG Deník**
- CI: GitHub Actions, workflow `.github/workflows/ci.yml`
- Runtime a preview: Coolify
- Produkční aplikace v Coolify: UUID `accqwcih3fe5lapan5prkfmx`

Přístupy a secrets jsou v příslušných systémech, nikdy v repozitáři nebo Paperclip komentáři.

## Delivery workflow

1. Zadavatel vytvoří Paperclip ticket s outcome, scope a acceptance criteria.
2. PM přiřadí jednoho agenta. Agent vytvoří branch s identifikátorem ticketu.
3. Agent implementuje pouze ticket, průběžný stav a blockery píše do ticketu.
4. U změny aplikace/runtime agent spustí `./scripts/quality.sh`; docs-only změna používá cílené kontroly popsané v `AGENTS.md`. Potom pushne branch a otevře draft PR.
5. Coolify vytvoří izolované preview. Agent ověří `./scripts/verify.sh <preview-url>` a vloží URL i výsledek do PR a ticketu.
6. Člověk zkontroluje preview, diff, CI a rizika. Požadované opravy se dělají na stejné branchi.
7. Pouze člověk schválí merge do `main`. Merge spustí produkční deployment v Coolify.
8. Po deployi se ověří `./scripts/verify.sh https://pgdenik.cz`. Teprve potom se ticket uzavře jako `done`.

Chybějící CI nebo preview je blocker review. Agent nesmí použít produkční deploy jako náhradu preview.

## Runtime kontrakt

- Build se provádí z repozitářového `Dockerfile`.
- Startovací příkaz je `./scripts/start.sh`; před spuštěním aplikace provede databázové migrace.
- Aplikace poslouchá na portu poskytovaném runtime a musí vracet `{"status":"ok"}` na `/api/health`.
- Produkční a preview databáze jsou oddělené.
- Payload media vyžadují perzistentní úložiště; nesmějí záviset na zapisovatelné vrstvě kontejneru.

## Standardní příkazy

```bash
# kompletní lokální quality gate
./scripts/quality.sh

# ověření nasazeného prostředí
./scripts/verify.sh https://example.invalid

# databázové migrace
./scripts/migrate.sh
```

`pnpm import:live` mění data a není součást běžného delivery workflow. Smí se spustit pouze z explicitního migračního ticketu se zálohou, cílovým prostředím a rollback plánem.

## Produkční bezpečnost

- Žádné ruční změny v běžícím kontejneru.
- Žádný přímý push do `main`.
- Žádné produkční migrace nebo import bez schváleného ticketu a rollbacku.
- Rollback aplikace = předchozí úspěšný Coolify deployment.
- Datový rollback se provádí jen podle konkrétního plánu v incidentním/migračním ticketu; aplikace se nevrací naslepo přes nevratnou databázovou migraci.
