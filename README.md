# YaleHub

Personal hub for a Yale student. Next.js serves the dashboard. The core loads a profile, retrieves chunks from the existing Yale text index, and answers through one MCP server.

Ownership is in [AGENTS.md](AGENTS.md).

| Area | Owner |
| --- | --- |
| Memory, agent loop, retrieval, CAS, profile and chat pages | You |
| Calendar, Google Calendar, auto-update, calendar page | Jack |
| Dining, courses, Yalies, morning email, dashboard shell | Aiden |

## Run

```powershell
npm install
copy .env.example .env
npm run dev
```

Open http://127.0.0.1:3000 and sign in with a NetID. `CAS_MODE=mock` is a localhost form. `CAS_MODE=yale` redirects through Yale CAS and returns to `/auth/callback`.

```powershell
curl -H "X-NetID: ab12" -H "content-type: application/json" -d "{\"message\":\"What is Directed Studies?\"}" http://127.0.0.1:3000/api/chat
```

`X-NetID` is accepted only in mock mode.

Set `XAI_API_KEY` to answer with SpaceXAI (`grok-4.7` on `https://api.x.ai/v1/responses`) and to let the model call tools. With no key, each turn still loads the profile, retrieves Yale chunks, and returns that context.

Calendar events stay in `data/calendar/` until `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set. The calendar page then links to Google OAuth. Dining reads Yale Hospitality on Nutrislice. Course search uses the CourseTable catalog. Yalies lookup needs `YALIES_API_KEY`. Morning email stays in `data/briefs/` until `SMTP_HOST` is set.

The stdio MCP server, for an external client:

```powershell
npm run mcp
```

Set `YALEHUB_NETID` so tools on that process know which student is signed in.

## Yale knowledge index

`search_yale_knowledge` reads the existing chunk archive (default `../AI_girlfriend/backend/embeddings_with_text_v5.npz`) through `src/integrations/vector_bridge.py`. The first query loads `BAAI/bge-large-en-v1.5` on CPU and can take a few minutes. Python needs `numpy` and `sentence-transformers`. Point `PYTHON` at another interpreter if you want.

Check the archive without loading the model:

```powershell
python src/integrations/vector_bridge.py --check
```

## Add a feature

1. Add `src/integrations/<name>.ts` for the external client.
2. Add `src/modules/<name>/` exporting a `FeatureModule`.
3. Append it to `featureModules` in `src/core/mcp-server.ts`.
4. Add `app/<name>/page.tsx` only if it needs a screen.

Modules do not import each other. They read `ctx.profile` and leave `src/core/memory` alone. The overview page lists registered modules.
