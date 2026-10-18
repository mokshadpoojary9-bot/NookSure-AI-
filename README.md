# NookSure AI

**Prepare thoughtfully. Reuse wisely.**

NookSure AI helps people prepare a home for someone with mobility needs. Its core
feature, the **"Use What You Have" / Jugaad Planner**, looks first at safely reusing,
rearranging, or removing items already in the home before suggesting any purchase.

> NookSure provides planning guidance only. It never certifies a home as safe and
> does not replace an occupational therapist or qualified installer.

## Status

| Feature | State |
| ------- | ----- |
| Landing, safety page, 4-step home planner (reuse → rearrange → remove → purchase) | Working. Plans come from a reviewed rule set, labeled "not AI analysis", saved in the browser only. |
| NookSure assistant (`POST /api/chat`, Gemini via `@google/genai`) | Implemented and tested with mocks. **Not yet verified against the live Gemini API.** Without `GEMINI_API_KEY` it returns labeled sample replies. |
| Voice input / read-aloud | Browser Web Speech API where supported; falls back to typing. Not available in every browser. |
| Google sign-in (Firebase Auth) | Implemented, optional (guest mode works). **Not yet verified against the real Firebase project.** Signing in does not sync plans yet. |
| Firestore plan storage | Planned |
| Interactive 3D room view (Three.js / React Three Fiber) | Planned — not built |
| Deployment (Vercel frontend, Render backend) | Planned |

## Stack

| Area      | Tech                                                          |
| --------- | ------------------------------------------------------------- |
| Frontend  | React, Vite, TypeScript (Three.js / React Three Fiber planned) |
| Backend   | Node.js, Express, TypeScript, Zod                             |
| Shared    | Zod schemas and types (`@nooksure/shared`)                    |
| AI        | Gemini via `@google/genai` (server-side only)                 |
| Auth/Data | Firebase Authentication (Google); Firestore planned            |
| Tests     | Vitest, Testing Library, Supertest                            |

## Setup

Requires Node.js 20+.

```bash
npm install
cp .env.example .env   # fill in locally; never commit .env
npm run dev:backend    # http://localhost:3001/api/health
npm run dev:frontend   # http://localhost:5173
```

Without `GEMINI_API_KEY`, the backend runs in clearly labeled **fixture mode**: no
real AI analysis is performed and replies are shown as sample data. Without the
`VITE_FIREBASE_*` values, the app runs in guest mode with sign-in disabled. See
[`docs/setup.md`](docs/setup.md) for Gemini and Firebase setup.

## Checks

```bash
npm run typecheck
npm test
npm run build
npm run check          # all of the above
```

See [`docs/`](docs/) for architecture, setup, and safety guidance.
