# Agent Rules

1. **Issue v aktuálním projektovém trackeru je jediný zdroj pravdy pro změnu.** Před předáním do vývoje musí obsahovat outcome, scope, acceptance criteria a vlastníka. Handoff, průběžný stav, rozhodnutí a blockery zapisuj do issue; nevytvářej pro ně nové markdown dokumenty.
2. Před zahájením přečti issue a `README.md`. `docs/OPERATIONS.md` čti jen při změně runtime, dat, deploye nebo infrastruktury.
3. Pracuj na samostatné branchi z aktuálního `main`; název musí obsahovat identifikátor issue (např. `codex/dt-123-short-name`). Jedno vývojové issue = jedna branch = jeden PR.
4. Neměň nic mimo scope issue. Nutnou vedlejší změnu nejprve popiš v issue; bez schválení ji nedělej.
5. Behaviorální změny vyvíjej test-first. U změn aplikace nebo runtime před předáním spusť `./scripts/quality.sh`. U docs-only změny stačí kontrola odkazů a formátu; u samostatné změny shell skriptu minimálně `sh -n <script>`. Vždy uveď přesně, co proběhlo a co ne; neúspěch neskrývej.
6. PR musí odkazovat na příslušné issue a obsahovat: stručné shrnutí, testy, rizika a ověřenou Coolify preview URL. U čistě dokumentační změny napiš `Preview: not required (docs-only)`.
7. Agent smí commitnout, pushnout a otevřít PR. Merge řídí `.github/agent.yml`: `merge: auto` → po zeleném CI a ověřeném preview PR sám squash-mergni (merge nasadí produkci); `merge: review` nebo label `merge:review` → nemerguj a nech merge na člověku. Jiný produkční deploy než merge agent nespouští; issue neuzavře jako `done` před ověřením produkce.
8. Připomínky z review oprav na stejné branchi. Issue jde do `done` až po merge a ověření produkce (`./scripts/verify.sh https://pgdenik.cz`).
9. Produkční tajemství a změny Coolify vyžadují explicitní scope issue. Tajemství nikdy necommituj ani nevypisuj.
10. U CMS nebo databázové změny nejprve dokumentovaným a ověřeným postupem synchronizuj izolovanou preview DB z produkce, změnu aplikuj pouze tam a ověř ji přes preview aplikaci. Samotné issue neopravňuje k produkčnímu zápisu. Ten smí proběhnout až po explicitním lidském schválení preview, s čerstvou zálohou, reprodukovatelným postupem, rollbackem a následným ověřením.
11. Pokud je issue nejasné nebo preview/CI nefunguje, zastav se. Důvod, dosavadní důkazy a potřebný další krok zapiš přímo do issue (popis nebo trvalý komentář), nastav `blocked` a přiřaď stejné issue zpět Dev Leadovi. Nestačí blocker uvést pouze ve shrnutí běhu nebo aktivitě. Nerozšiřuj práci odhadem a neimprovizuj v produkci.

<!-- BEGIN_NEXTJS_AGENT_RULES -->
# Next.js: ALWAYS read the docs before coding

Before any Next.js work, find and read the relevant documentation in `node_modules/next/dist/docs/`. Your training data may be outdated — the bundled docs are the source of truth.
<!-- END_NEXTJS_AGENT_RULES -->
