# Agent Rules

1. **Paperclip ticket je jediný zdroj pravdy pro změnu.** Musí obsahovat outcome, scope, acceptance criteria a vlastníka. Handoff, průběžný stav, rozhodnutí a blockery zapisuj do ticketu; nevytvářej pro ně nové markdown dokumenty.
2. Před zahájením přečti ticket a `README.md`. `docs/OPERATIONS.md` čti jen při změně runtime, dat, deploye nebo infrastruktury.
3. Pracuj na samostatné branchi z aktuálního `main`; název musí obsahovat identifikátor ticketu (např. `codex/far-123-short-name`). Jeden ticket = jedna branch = jeden PR.
4. Neměň nic mimo scope ticketu. Nutnou vedlejší změnu nejprve popiš v ticketu; bez schválení ji nedělej.
5. Behaviorální změny vyvíjej test-first. U změn aplikace nebo runtime před předáním spusť `./scripts/quality.sh`. U docs-only změny stačí kontrola odkazů a formátu; u samostatné změny shell skriptu minimálně `sh -n <script>`. Vždy uveď přesně, co proběhlo a co ne; neúspěch neskrývej.
6. PR musí odkazovat na Paperclip ticket a obsahovat: stručné shrnutí, testy, rizika a ověřenou Coolify preview URL. U čistě dokumentační změny napiš `Preview: not required (docs-only)`.
7. Agent smí commitnout, pushnout a otevřít draft PR. Agent nesmí sám mergeovat, spouštět produkční deploy ani uzavřít ticket jako `done`.
8. Po lidském review oprav připomínky na stejné branchi. Ticket jde do `done` až po schváleném merge a ověření produkce.
9. Produkční data, tajemství, migrace, importy a změny Coolify vyžadují explicitní scope ticketu a rollback plán. Tajemství nikdy necommituj ani nevypisuj.
10. Pokud je ticket nejasný nebo preview/CI nefunguje, zastav se a zapiš konkrétní blocker. Nerozšiřuj práci odhadem.

<!-- BEGIN_NEXTJS_AGENT_RULES -->
# Next.js: ALWAYS read the docs before coding

Before any Next.js work, find and read the relevant documentation in `node_modules/next/dist/docs/`. Your training data may be outdated — the bundled docs are the source of truth.
<!-- END_NEXTJS_AGENT_RULES -->
