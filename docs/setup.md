# Setup

1. Install Node.js 20 or newer.
2. `npm install` at the repo root (installs all workspaces).
3. `cp .env.example .env` and fill in values locally. `.env` is git-ignored.
4. `npm run dev:backend` and `npm run dev:frontend` in separate terminals.
5. `npm run check` runs typecheck, tests, and build.

Everything runs without keys: the assistant returns labeled sample replies and the
app runs in guest mode.

## Gemini (assistant)

1. Create an API key in Google AI Studio.
2. Put it in `.env` as `GEMINI_API_KEY=...` — **never** in a `VITE_` variable, in
   source code, or in a commit.
3. Optionally set `GEMINI_MODEL` to pin a model. The default is
   `gemini-flash-latest`, the alias used in the `@google/genai` SDK docs; check
   Google's current model list before pinning a specific one.
4. Restart the backend. `GET /api/health` should report `analysisMode: "live"`.

## Firebase (Google sign-in)

Project: `nooksure-ai`.

1. Firebase Console → Project settings → Your apps → add or select the **Web** app
   and copy its SDK config into the `VITE_FIREBASE_*` values in `.env`. These values
   identify the project to the browser and are publishable, but they live in `.env`,
   not in source.
2. Authentication → Sign-in method → enable **Google**.
3. Authentication → Settings → **Authorized domains**: `localhost` is included by
   default. When deploying, add each production domain (e.g. the Vercel domain),
   or sign-in fails with `auth/unauthorized-domain`.
4. Restart `npm run dev:frontend` (Vite reads env at startup).

Service-account (Admin SDK) keys aren't needed yet. If they're added later, they're
secrets: backend only, never committed (`*service-account*.json` is git-ignored).

## Voice

Voice input uses the browser's `SpeechRecognition` / `webkitSpeechRecognition`, and
read-aloud uses `speechSynthesis`. Support varies by browser (some send audio to
their own servers for recognition), microphone permission is required, and the
microphone generally needs a secure context (`https://` or `localhost`). When voice
isn't available, the UI says so and typing still works.

## Environment variables

| Variable                            | Where    | Secret  | Notes                                   |
| ----------------------------------- | -------- | ------- | --------------------------------------- |
| `PORT`, `CORS_ORIGIN`               | backend  | no      |                                         |
| `GEMINI_API_KEY`                    | backend  | **yes** | Empty → fixture (sample) mode           |
| `GEMINI_MODEL`, `GEMINI_TIMEOUT_MS` | backend  | no      | Defaults: `gemini-flash-latest`, 20000  |
| `CHAT_RATE_LIMIT_PER_MINUTE`        | backend  | no      | Per IP; default 20                      |
| `VITE_API_BASE_URL`                 | frontend | no      | Backend URL                             |
| `VITE_FIREBASE_*`                   | frontend | no      | Firebase web config; empty → guest mode |

All `VITE_*` values are bundled into the browser — publishable values only.
