# YaleHub — ownership and module rules

The canonical copy is the repo-root [AGENTS.md](../AGENTS.md). Keep the two in sync. Summary:

| Owner | Paths |
| --- | --- |
| You | `src/core/**`, vector DB wrapper, `app/(hub)/profile/**`, `app/(hub)/chat/**`, `app/login/**`, `app/login_callback/**` |
| Jack | `src/modules/calendar/**`, `src/integrations/gcal.ts`, `app/(hub)/calendar/**` |
| Aiden | `src/modules/dining/**`, `src/modules/courses/**`, `src/modules/briefs/**`, `app/globals.css`, `app/(hub)/layout.tsx`, `app/(hub)/page.tsx`, `app/(hub)/briefs/**`, `app/(hub)/dining/**`, `app/(hub)/courses/**` |
| Unassigned | `src/modules/canvas/**`, `src/integrations/canvas.ts`, `app/(hub)/canvas/**` |

Modules export a `FeatureModule` and never import each other. New integration: new folder under `src/modules/` plus one line in `src/core/mcp-server.ts`. Memory stays in `src/core/memory/`. The agent retrieves Yale chunks before every answer.
