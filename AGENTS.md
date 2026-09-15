# Agent Rules

1. Před změnou přečti `SPEC.md`, `ARCHITECTURE.md`, `WEB_PLATFORM.md`, `PROJECT-INFRASTRUCTURE.md` a aktivní `DEVELOPMENT-HANDOFF.md`.
2. Implementuj pouze scope schváleného Development Handoffu. Nejasnost nebo architektonickou odchylku vrať jako blocker.
3. Implementation details rozhodni podle repozitáře; neměň schválenou high-level architekturu bez souhlasu.
4. Pracuj na samostatné branchi. Nikdy necommituj secrets ani produkční data.
5. Spusť relevantní testy, lint, typecheck a build. Selhání nezakrývej.
6. Commitni změnu a vytvoř PR. Do výsledku uveď scope, gates, PR, preview a blockery.
7. Produkci neměň přímo. Nasazení probíhá přes merge do `main` a Coolify.
8. Neměň `Dockerfile`, deploy hooky, healthcheck ani prostředí bez výslovně schváleného infrastrukturního scope.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
