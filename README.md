# NookSure AI

**Prepare thoughtfully. Reuse wisely.**

NookSure AI helps people get a home ready for a guest or family member with mobility
needs — starting with what they already own.

**Live demo:** (coming soon)

> NookSure provides planning guidance only. It never certifies a home as safe and
> does not replace an occupational therapist or qualified installer.

## Features

- **"Use What You Have" planner** — pick mobility aids, rooms and what you notice;
  get a checklist ordered **reuse → rearrange → remove → purchase**. Built from a
  reviewed rule set and labeled as such (not AI analysis). Never suggests furniture
  as grab bars or stacked objects as ramps.
- **Gemini assistant** — ask questions about preparing your home. Runs server-side
  (the key never reaches the browser), with input validation, timeouts, rate limits
  and an urgent-hazard notice. Without a key it runs in clearly labeled demo mode.
- **Voice input** — speak your question with the browser's speech recognition and
  review the text before sending. Typing always works.
- **Read-aloud** — hear replies via the browser's speech synthesis, with a stop button.
- **Google sign-in** — optional, via Firebase Authentication. Guest mode keeps working.
- **Saved plans** — signed-in users can save, reopen and delete plans in Firestore
  (`users/{uid}/plans/{planId}`), protected by owner-only security rules.
- **3D room view** — an interactive Three.js view of each room with issues coloured
  by priority (red high, amber medium, green done); click an object to find its
  checklist item. **Illustrative layout, not to scale.** Lazy-loaded, with a
  checklist fallback where WebGL isn't available.

## Tech stack

| Area      | Tech                                                            |
| --------- | --------------------------------------------------------------- |
| Frontend  | React 18, Vite, TypeScript, Three.js / React Three Fiber / drei |
| Backend   | Node.js, Express, TypeScript, Zod                               |
| Shared    | Zod schemas, types and planner rules (`@nooksure/shared`)        |
| AI        | Gemini via `@google/genai` (server-side only)                   |
| Auth/Data | Firebase Authentication (Google) and Cloud Firestore            |
| Tests     | Vitest, Testing Library, Supertest                              |
| Hosting   | Vercel (frontend) and Render (backend) — see the deploy guide   |

## Run it locally

Step-by-step guide (keys, Firebase, testing in Chrome, troubleshooting):
**[`docs/setup.md`](docs/setup.md)**.

Quick version — requires Node.js 20 or newer:

```powershell
npm install
Copy-Item .env.example .env   # macOS/Linux: cp .env.example .env
# Fill in .env (never commit it), then in two separate terminals:
npm run dev:backend           # terminal 1 → http://localhost:3001/api/health
npm run dev:frontend          # terminal 2 → open http://localhost:5173/
```

It works with an empty `.env`: the assistant runs in labeled demo mode and the app
runs as a guest with sign-in turned off.

## Deploy

Click-by-click guide for Render (backend) and Vercel (frontend):
**[`docs/deploy.md`](docs/deploy.md)**.

## Firestore rules

Saved plans live at `users/{uid}/plans/{planId}` — each user's plans sit under their
own Firebase user id, and only that signed-in user can read or write them.

Publish the rules once: Firebase Console → **Firestore Database** → **Rules** tab →
paste the content of [`firestore.rules`](firestore.rules) → **Publish**.

## Checks

```powershell
npm run check   # typecheck + tests + build
```

Automated tests run without network access: Gemini, Firebase Auth, Firestore, the
browser speech APIs and WebGL are mocked, so they check the app's own logic, not the
live services.

More docs: [`docs/architecture.md`](docs/architecture.md),
[`docs/safety.md`](docs/safety.md).
