# Web Platform Standard

## Účel

Výchozí pravidla pro weby vyvíjené a spravované agenty. Platí, dokud je projektové `ARCHITECTURE.md` výslovně nepřepíše schválenou výjimkou.

## Výchozí platforma

- Next.js a TypeScript
- Payload CMS
- PostgreSQL
- GitHub
- Coolify na vlastním VPS
- Tailwind CSS, design tokeny a omezená sada znovupoužitelných komponent

Odchylka od této platformy vyžaduje zdůvodnění v `ARCHITECTURE.md` a schválení Davida před Development Handoffem.

## Zdrojový kód a obsah

- Kód, CMS schéma, migrace a konfigurace patří do Git repozitáře.
- Secrets, produkční data a runtime soubory do Gitu nepatří.
- Obsahové stránky se skládají ze schválených bloků; jednorázové nesouvisející implementace se nevytvářejí.
- Nový blok má definované použití, datový model, responzivní chování, přístupnost a prázdný stav.
- Sdílené vizuální hodnoty patří do tokenů. Inline styly se nepoužívají; arbitrary hodnoty jen s odůvodněním.

## Rozdělení odpovědnosti

- **Team Agent:** co se staví — requirements, scope, acceptance criteria a orchestrace.
- **web-platform:** sdílený skeleton, build/deploy contract, healthcheck a verzované šablony hooků.
- **web-architecture:** projektová high-level struktura, platformní konzistence a infrastrukturní dopady.
- **project-bootstrap:** aplikuje platformní šablonu, vytvoří lokální workspace a repo, zprovozní prostředí a prokáže první skeleton deployment.
- **Coding worker:** po dokončeném bootstrapu implementuje web — detailní návrh, kód, migrace a testy.
- **GitHub + Coolify:** doručení — PR, preview a production deployment.

Team Agent ani platformní standard nepředepisují implementation details, pokud nejsou nutné pro schválenou architekturu.

## Povinný tok nového projektu

```text
SPECIFY → ARCHITECT → APPROVE BOOTSTRAP
  → INFRASTRUCTURE BOOTSTRAP
  → SKELETON DEPLOY + PREVIEW TEST
  → INFRASTRUCTURE_READY
  → HANDOFF_READY
  → INITIAL IMPLEMENTATION
  → PR → PREVIEW → REVIEW → PRODUCTION
```

Infrastructure bootstrap a initial implementation jsou dvě oddělené fáze. Coding worker se skutečným webem se nespouští, dokud skeleton neprojde Git → Coolify → VPS → HTTPS a preview testem. Development Handoff je až druhý explicitní approval gate.

## Build a runtime contract

- Package manager je `pnpm` přes Corepack a lockfile je commitnutý.
- `pnpm build` vytváří produkční Next.js/Payload build; build nesmí měnit databázi.
- `scripts/start.sh` spustí verzované migrace a poté aplikaci na `0.0.0.0:3000`.
- Produkční image vzniká verzovaným `Dockerfile` uloženým v repozitáři.
- Payload migrace jsou verzované v repozitáři a spouští je `scripts/migrate.sh` před startem serveru. První deployment nesmí vyžadovat starý kontejner.
- Coolify pre-deploy command je prázdný; startup migrace jsou serializované PostgreSQL advisory lockem. Při horizontálním škálování je preferovaný samostatný migrační job.
- `/api/health` vrací úspěch pouze tehdy, když je aplikace připravená a dosáhne na svou databázi.
- `scripts/preflight.sh` ověří vstupy před změnami, `scripts/quality.sh` spustí lokální gates a `scripts/verify.sh <base-url>` ověří zvenčí health endpoint a homepage.

Sdílené hooky se kopírují z `templates/web-platform/`. Coding worker je pro každý projekt nevymýšlí znovu.

## Quality gates

Před vytvořením PR musí projít všechny kontroly dostupné v repozitáři:

- relevantní testy;
- lint;
- typecheck;
- produkční build;
- databázové migrace a jejich bezpečnost, pokud se mění data.

Chybějící nebo neproveditelný gate se uvede jako blocker; nesmí se vydávat za úspěšný.

## Git a deployment

- Každá změna vzniká na samostatné branchi a končí commitem a PR.
- Scope PR odpovídá schválenému zadání.
- Preview a production používají oddělené prostředí a secrets.
- Produkční migrace musí být verzované, zálohované a mít popsaný rollback.
- Merge do `main` vyžaduje úspěšné gates a lidské schválení.
- Coolify po PR vytvoří preview; merge do `main` spouští production deployment.
- Přímý zásah agenta do produkce přes SSH není standardní cesta.

## Povinné soubory projektu

- `ARCHITECTURE.md` — projektová architektura, integrace a schválené výjimky.
- `PROJECT-INFRASTRUCTURE.md` — konkrétní workspace, repo, domény, Coolify aplikace, databáze a důkaz prvního deploymentu.
- `AGENTS.md` — stručná pravidla pro coding workery.
- relevantní product/spec dokumenty.
- Development Handoff pro právě schválenou změnu.

Při konfliktu má přednost explicitně schválená projektová architektura, poté tento standard, poté obecné preference coding workeru.
