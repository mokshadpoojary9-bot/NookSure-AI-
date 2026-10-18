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
| NookSure assistant (`POST /api/chat`, Gemini via `@google/genai`) | Working. One live Gemini reply verified locally on 2026-10-18; automated tests use a mocked Gemini. Without `GEMINI_API_KEY` it runs in labeled demo (sample) mode. |
| Voice input / read-aloud | Browser Web Speech API where supported; falls back to typing. Not yet tested in a real browser. |
| Google sign-in (Firebase Auth) | Implemented, optional (guest mode works). Firebase config verified; **a real sign-in has not been tested yet** — the Google provider must be enabled first. Signing in does not sync plans yet. |
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

## Quick start

New to this? Follow the step-by-step guide in [`docs/setup.md`](docs/setup.md) — it
covers keys, Firebase, testing in Chrome, and troubleshooting.

Requires Node.js 20 or newer (includes npm).

```powershell
npm install
Copy-Item .env.example .env   # macOS/Linux: cp .env.example .env
# Fill in .env (never commit it), then in two separate terminals:
npm run dev:backend           # terminal 1 → http://localhost:3001/api/health
npm run dev:frontend          # terminal 2 → open http://localhost:5173/
```

The app works with an empty `.env`: without `GEMINI_API_KEY` the assistant runs in
clearly labeled **demo mode** (sample replies, `analysisMode: "fixture"`), and
without the `VITE_FIREBASE_*` values the app runs in guest mode with sign-in off.

## Checks

```bash
npm run typecheck
npm test
npm run build
npm run check          # all of the above
```

See [`docs/`](docs/) for architecture, setup, and safety guidance.
