# Architecture

**Status:** ARCHITECTURE_READY
**Owner:** David Brázda
**Last updated:** 2026-09-15

## System purpose

Veřejný, informačně orientovaný paraglidingový deník s CMS správou stránek, stromové navigace a podporovaných médií.

## Context and constraints

- Product/spec source: `SPEC.md`
- Existing system or migration source: pouze veřejný web `https://www.pgdenik.cz`; předchozí lokální prototypy se nepoužijí
- Important constraints: zachovat strom obsahu; text, obrázky, YouTube a XCvid; žádné jiné přílohy; původní produkce se při prototypování nemění

## High-level architecture

```text
[Návštěvník] → [Next.js veřejný web + Payload admin] → [PostgreSQL]
                         │
                         ├→ [spravované obrázky]
                         └→ [YouTube / XCvid embed]

[Veřejný pgdenik.cz] → [jednorázový importér + report] → [Payload]
```

- Frontend/application: Next.js a TypeScript
- Content management: Payload CMS jako součást aplikace
- Data store: PostgreSQL
- Media storage: perzistentní Coolify volume pro Payload uploady; importované obrázky se kopírují do spravovaných médií
- External services: veřejný zdroj pgdenik.cz pro jednorázovou migraci; YouTube a XCvid pouze pro bezpečně omezené embedy; GitHub a Coolify pro delivery

## Data and integrations

- `Pages`: titul, stabilní slug/cesta, volitelný menu titul, rodič, pořadí, viditelnost v menu, stav publikace, obsahové bloky.
- `Media`: obrázek, alt text a metadata.
- Obsahové bloky: rich text, obrázek, YouTube embed, XCvid embed.
- Strom se skládá z rodičovské vazby a explicitního pořadí; cykly a neplatní rodiče jsou odmítnuty.
- Embed URL jsou validovány allowlistem hostů a renderují se bez vložení libovolného HTML z CMS.
- Importér je opakovatelný, identifikuje zdrojové stránky stabilním zdrojovým ID/URL a vytváří report bez tichého vynechání.

## Environments and delivery

- Repository: `https://github.com/drew2323/pgdenik` po úspěšném preflightu
- Prototypová produkční URL: `https://pgdenik.2.56.97.3.sslip.io`
- Finální production domain: `https://pgdenik.cz` až po samostatném schválení cutoveru
- Coolify application/project: doplní `PROJECT-INFRASTRUCTURE.md` read-backem
- Preview strategy: automatický Coolify PR deployment na `https://pr-<id>.pgdenik.2.56.97.3.sslip.io`, oddělená preview DB
- Health check: `/api/health` včetně DB readiness
- Backup and rollback: záloha DB a upload volume před změnou schématu/cutoverem; aplikační rollback na předchozí image a kompatibilní migrace

## Security and privacy

- Payload admin vyžaduje autentizaci; veřejný web poskytuje pouze publikované stránky.
- Admin účet a secrets jsou pouze v Coolify nebo lokálním necommitovaném prostředí.
- Žádné libovolné iframe/HTML z editoru; YouTube a XCvid mají explicitní validaci.
- Importér čte pouze veřejný obsah, neobchází přihlášení a nepublikuje neveřejné stránky.

## Platform deviations

None.

## Architectural decisions

- 2026-09-15 — David schválil nový projekt od nuly v rámci standardního workflow; předchozí prototyp se nepoužije.
- 2026-09-15 — Standardní Next.js/Payload/PostgreSQL platforma bez výjimky.
- 2026-09-15 — Strom menu je součást modelu stránek, nikoli pevná konfigurace v kódu.
- 2026-09-15 — Prototyp se nejprve nasadí na sslip.io; DNS pgdenik.cz se nemění bez kontroly a samostatného schválení.
- 2026-09-15 — Codex rozhoduje detailní design a implementaci v mezích zadání.

## Open questions

- Žádné před bootstrapem. Přesný počet veřejných importovaných stran a výjimek určí nový importní audit z živého webu.
