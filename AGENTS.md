# YaleHub — ownership and module rules

YaleHub is a personal hub for one Yale student. Memory and retrieval are the core. The dashboard is Next.js App Router. Feature modules register tools on one MCP server.

Read this before editing. Stay inside your rows.

## Ownership

| Owner | Owns | Paths |
| --- | --- | --- |
| You (memory + agent) | Profile store, episodic memory, vector retrieval, the agent loop, MCP registration, Yale CAS on localhost, profile page, chat page | `src/core/**`, `src/integrations/vector-db.ts`, `src/integrations/vector_bridge.py`, `app/(hub)/profile/**`, `app/(hub)/chat/**`, `app/login/**`, `app/login_callback/**`, `app/api/auth/**`, `app/api/profile/**`, `app/api/chat/**`, `data/profiles/**`, `data/episodes/**` |
| Jack | Calendar module, Google Calendar, chat tools and automatic updates, calendar page | `src/modules/calendar/**`, `src/integrations/gcal.ts`, `app/(hub)/calendar/**`, `app/api/calendar/**`, `data/calendar/**` |
| Aiden | Dining, courses, Yalies, morning emails, dashboard shell | `src/modules/dining/**`, `src/modules/courses/**`, `src/modules/briefs/**`, `src/integrations/nutrislice.ts`, `src/integrations/yalies.ts`, `app/layout.tsx`, `app/(hub)/layout.tsx`, `app/(hub)/page.tsx`, `app/globals.css`, `app/(hub)/briefs/**`, `app/(hub)/dining/**`, `app/(hub)/courses/**`, `app/api/briefs/**`, `app/api/dining/**`, `app/api/courses/**`, `data/dining/**`, `data/courses/**`, `data/briefs/**` |
| Unassigned | Canvas reads (courses, assignments, to-do, announcements) | `src/modules/canvas/**`, `src/integrations/canvas.ts`, `app/(hub)/canvas/**` |

Shared files, edit only after the group agrees:

| Path | What it is |
| --- | --- |
| `src/core/types.ts` | `Profile`, `Tool`, `FeatureModule`, `ToolContext`, `MorningBriefSection` |
| `src/core/mcp-server.ts` | The module list. A new feature adds one import and one array entry. |

## Rules

1. Stay inside your folders. Touch `src/core/types.ts` or the module list in `src/core/mcp-server.ts` only when the group has agreed.
2. A module exports a `FeatureModule`: `tools`, plus an optional `morningBriefSection`. Modules never import each other.
3. A module may import `src/core/types.ts` and its own file under `src/integrations/`. It leaves `src/core/memory/**` and `src/core/agent.ts` alone.
4. Modules read `ctx.profile`. Profile files are written only by the memory tools. The agent saves stable facts with `update_student_profile`.
5. Module-local state goes in `data/<your-module>/`. Keep secrets out of the profile.
6. A new feature is a new folder `src/modules/<name>/` plus one line in `featureModules`. Add `app/(hub)/<name>/page.tsx` only if it needs a screen. That folder sits inside the sidebar layout.
7. The agent retrieves from the existing Yale text-chunk index before every answer. The MCP tool is `search_yale_knowledge`. Feature modules leave that archive alone.

## Adding an integration

1. Put the external client in `src/integrations/<name>.ts`.
2. Create `src/modules/<name>/index.ts` exporting a `FeatureModule`, and `tools.ts` for the MCP tools.
3. Import the module in `src/core/mcp-server.ts` and append it to `featureModules`.
4. Optional: `morningBriefSection` on the module. The brief assembler calls every section. Your module does not import the others.
5. Optional: `app/(hub)/<name>/page.tsx` and a thin `app/api/<name>/route.ts` that calls your module. Keep the route a few lines so the behavior stays in the module folder.

That registration is the only wiring into the agent. The overview page lists whatever is in `featureModules`.

## Tool contract

Handlers return `{ content: [{ type: "text", text }] }`. `textResult()` in `src/core/types.ts` builds that. Set `isError: true` when the call failed.

Calendar, dining, courses, and the morning brief live in their module folders. Their screens are under `app/(hub)/`.

## What the agent does on every question

1. Load or create the profile for the signed-in NetID.
2. Retrieve Yale chunks and recent episodes.
3. Call Gemini with that context and the MCP tool list, or return the retrieved context when `GEMINI_API_KEY` is unset.
4. Execute tool calls through the in-process MCP client.
5. Append a short episode for the turn.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
