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
| Google sign-in (Firebase Auth) | Implemented, optional (guest mode works). Firebase config verified; **a real sign-in has not been tested yet** — the Google provider must be enabled first. |
| Saved plans (Firestore) | Implemented for signed-in users: Save plan, My saved plans (open, delete). Tested with a mocked Firestore; **not yet tested against the real database**, and the rules below must be published first. Guests keep browser-only storage. |
| Interactive 3D room view (Three.js / React Three Fiber) | Built: "Show 3D view" on the plan step, room picker, issues coloured by priority (red high, amber medium, green done), click to find the checklist item. **Illustrative layout, not to scale.** Lazy-loaded; falls back to the checklist when WebGL isn't available. Tested without WebGL; not yet checked in a real browser. |
| Deployment (Vercel frontend, Render backend) | Planned |

## Stack

| Area      | Tech                                                          |
| --------- | ------------------------------------------------------------- |
| Frontend  | React, Vite, TypeScript, Three.js / React Three Fiber (3D view) |
| Backend   | Node.js, Express, TypeScript, Zod                             |
| Shared    | Zod schemas and types (`@nooksure/shared`)                    |
| AI        | Gemini via `@google/genai` (server-side only)                 |
| Auth/Data | Firebase Authentication (Google) and Firestore (saved plans)   |
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

## Firestore rules

Saved plans live at `users/{uid}/plans/{planId}` — each user's plans sit under their
own Firebase user id, and only that signed-in user can read or write them.

Before saving plans works, publish the rules once: Firebase Console → **Firestore
Database** → **Rules** tab → paste the content of [`firestore.rules`](firestore.rules)
→ **Publish**. (Create the Firestore database first if the project has none.)

## Checks

```bash
npm run typecheck
npm test
npm run build
npm run check          # all of the above
```

See [`docs/`](docs/) for architecture, setup, and safety guidance.
