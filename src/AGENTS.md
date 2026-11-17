# YaleHub — ownership and module rules

The canonical copy is the repo-root [AGENTS.md](../AGENTS.md). Keep the two in sync. Summary:

| Owner | Paths |
| --- | --- |
| You | `src/core/**`, vector DB wrapper, `app/profile/**`, `app/chat/**`, auth routes |
| Jack | `src/modules/calendar/**`, `src/integrations/gcal.ts`, `app/calendar/**` |
| Aiden | `src/modules/dining/**`, `src/modules/courses/**`, `src/modules/briefs/**`, `app/layout.tsx`, `app/page.tsx`, `app/briefs/**` |

Modules export a `FeatureModule` and never import each other. New integration: new folder under `src/modules/` plus one line in `src/core/mcp-server.ts`. Memory stays in `src/core/memory/`. The agent retrieves Yale chunks before every answer.
