# NookSure AI

**Prepare thoughtfully. Reuse wisely.**

NookSure AI helps people prepare a home for someone with mobility needs. Its core
feature, the **"Use What You Have" / Jugaad Planner**, looks first at safely reusing,
rearranging, or removing items already in the home before suggesting any purchase.

> NookSure provides planning guidance only. It never certifies a home as safe and
> does not replace an occupational therapist or qualified installer.

## Status

Foundation only — monorepo skeleton, a backend health endpoint, shared schemas, and
a placeholder frontend. Product features are not implemented yet.

## Stack

| Area      | Tech                                                          |
| --------- | ------------------------------------------------------------- |
| Frontend  | React, Vite, TypeScript (Three.js / React Three Fiber planned) |
| Backend   | Node.js, Express, TypeScript, Zod                             |
| Shared    | Zod schemas and types (`@nooksure/shared`)                    |
| Data      | Supabase (planned)                                            |
| Tests     | Vitest, Testing Library, Supertest                            |

## Setup

Requires Node.js 20+.

```bash
npm install
cp .env.example .env   # fill in locally; never commit .env
npm run dev:backend    # http://localhost:3001/api/health
npm run dev:frontend   # http://localhost:5173
```

Without `AI_PROVIDER_API_KEY`, the backend runs in clearly labeled **fixture mode**:
no real AI analysis is performed and results must be shown as sample data.

## Checks

```bash
npm run typecheck
npm test
npm run build
npm run check          # all of the above
```

See [`docs/`](docs/) for architecture, setup, and safety guidance.
