# Setup guide

A step-by-step guide to running NookSure AI on your own computer. Commands are for
Windows PowerShell; macOS/Linux equivalents are noted where they differ.

## 1. Install Node.js and npm

1. Install **Node.js 20 or newer** (the LTS version is a good choice) from
   https://nodejs.org. npm comes with it.
2. Open a new terminal and check both are installed:

   ```powershell
   node -v   # should print v20 or higher
   npm -v
   ```

3. In the project folder, install everything (all three workspaces at once):

   ```powershell
   cd "C:\Users\HP\Desktop\NookSure-AI-"
   npm install
   ```

## 2. Create your `.env` file

```powershell
Copy-Item .env.example .env   # macOS/Linux: cp .env.example .env
notepad .env
```

`.env` holds your real keys. It is git-ignored — **never commit it, paste it into
source code, or share it.** `.env.example` is the committed template and contains
placeholders only.

| Variable                            | Where    | Secret  | What to put                              |
| ----------------------------------- | -------- | ------- | ---------------------------------------- |
| `GEMINI_API_KEY`                    | backend  | **yes** | Your Gemini key (step 4). Empty → demo mode |
| `GEMINI_MODEL`                      | backend  | no      | Optional. Empty → `gemini-flash-latest`  |
| `GEMINI_TIMEOUT_MS`                 | backend  | no      | Optional. Default `20000` (20 s)         |
| `CHAT_RATE_LIMIT_PER_MINUTE`        | backend  | no      | Optional. Per user IP; default `20`      |
| `PORT`, `CORS_ORIGIN`               | backend  | no      | Defaults `3001`, `http://localhost:5173` |
| `NODE_ENV`                          | backend  | no      | Leave unset locally; `production` on Render |
| `VITE_API_BASE_URL`                 | frontend | no      | `http://localhost:3001` locally          |
| `VITE_FIREBASE_API_KEY`             | frontend | no      | From Firebase config (step 3)            |
| `VITE_FIREBASE_AUTH_DOMAIN`         | frontend | no      | From Firebase config                     |
| `VITE_FIREBASE_PROJECT_ID`          | frontend | no      | From Firebase config                     |
| `VITE_FIREBASE_STORAGE_BUCKET`      | frontend | no      | From Firebase config                     |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | frontend | no      | From Firebase config                     |
| `VITE_FIREBASE_APP_ID`              | frontend | no      | From Firebase config                     |
| `VITE_FIREBASE_MEASUREMENT_ID`      | frontend | no      | Optional, from Firebase config           |

Anything starting with `VITE_` is bundled into the browser, so only publishable
values go there. The Gemini key must **never** be a `VITE_` variable.

## 3. Firebase web config

Project: `nooksure-ai`.

1. Open the Firebase Console → **Project settings** (gear icon) → **General**.
2. Scroll to **Your apps**, select the Web app (`</>`; add one if there is none),
   and choose **Config**.
3. Copy each value into the matching `VITE_FIREBASE_*` line in `.env`
   (`apiKey` → `VITE_FIREBASE_API_KEY`, `authDomain` → `VITE_FIREBASE_AUTH_DOMAIN`,
   and so on).

These values identify your project to the browser; they're not secret, but keep
them in `.env` rather than in source code.

## 4. Gemini API key

1. Go to https://aistudio.google.com/app/apikey and create an API key.
2. Paste it into `.env` as `GEMINI_API_KEY=...` (no quotes needed).

## 5. Enable Google sign-in

In the Firebase Console: **Authentication** → **Sign-in method** → **Google** →
**Enable** → choose a support email → **Save**.

Until this is done, clicking "Sign in with Google" shows "Google sign-in isn't
enabled for this Firebase project yet."

## 5b. Firestore (saved plans)

Signed-in users can save plans. Each plan is stored at `users/{uid}/plans/{planId}`
— under the signed-in user's own id, readable and writable only by them.

1. Firebase Console → **Firestore Database**. If there's no database yet, click
   **Create database**, pick a location, and start in **production mode**.
2. Open the **Rules** tab.
3. Replace everything there with the content of `firestore.rules` from this repo.
4. Click **Publish**.

Without published rules, saving shows "You don't have permission to access this
plan." Guests aren't affected: their plan stays in the browser only.

## 6. When you deploy (later)

- **Authorized domains:** Firebase Console → **Authentication** → **Settings** →
  **Authorized domains** → add each production domain (e.g. your Vercel domain).
  `localhost` is already there. Without this, sign-in fails with
  `auth/unauthorized-domain`.
- **Render (backend):** set `NODE_ENV=production`. The backend then trusts one proxy
  hop (`app.set("trust proxy", 1)`) so each user gets their own chat rate limit
  instead of everyone sharing the proxy's address. Locally this stays off, so a
  forged `X-Forwarded-For` header can't dodge the limit.
- Set `GEMINI_API_KEY` in Render's environment settings, not in the frontend.
  Set `CORS_ORIGIN` to the frontend's URL and `VITE_API_BASE_URL` to the backend's.

## 7. Run locally

Use **two terminals**, both in the project folder:

```powershell
# Terminal 1
npm run dev:backend
# Terminal 2
npm run dev:frontend
```

Then open **http://localhost:5173/** in Chrome. Stop either server with `Ctrl+C`.
Restart both after editing `.env` — they only read it at startup.

Check the backend: open http://localhost:3001/api/health. `"analysisMode":"live"`
means Gemini is configured; `"fixture"` means demo mode.

## 8. Test the features in Chrome

| Feature        | What to do |
| -------------- | ---------- |
| Google sign-in | Click **Sign in with Google** (top right) → pick your account. The header shows "Signed in as …" and **Sign out**. |
| Saved plans    | Signed in, finish a plan in **Planner** → name it → **Save plan** ("Saved to your account ✓"). Open **My saved plans** → **Open** reloads it; **Delete** asks you to confirm. |
| Chat           | Click **Assistant** → type a question (or click a suggestion) → **Send** or Enter. Live replies show "Gemini AI · guidance only"; demo replies show "Sample reply". |
| Mic            | Click **🎤 Speak** → click **Allow** when Chrome asks for the microphone → speak. Your words appear in the text box; edit if needed, then **Send**. |
| Read-aloud     | Click **Read aloud** under a reply; **Stop reading** to stop. Or tick **Read replies aloud automatically** and use **Stop speaking**. |

## 9. Browser limits

- The microphone works best in **Chrome or Edge** and needs an **internet
  connection** (Chrome, for example, sends audio to Google's speech service). Other browsers
  may not support it; the page will say so.
- The mic needs permission and a secure page (`https://` or `localhost`).
- **Typing always works**, whatever the browser.

## 10. Troubleshooting

**My PC is low on memory / servers stop on their own**
- Close other heavy apps (extra browser tabs, editors) before starting.
- Run the two servers in your own terminals rather than through other tools, and
  stop them with `Ctrl+C` when you're done.
- `npm run check` runs typecheck, tests, and build one after another; run it when
  the dev servers are stopped.

**"Google sign-in isn't enabled for this Firebase project yet"**
- Do step 5 (enable the Google provider), then reload the page.
- If it says the domain isn't authorized, add the domain under Authentication →
  Settings → Authorized domains.
- If the header shows "Guest mode", the `VITE_FIREBASE_*` values are missing —
  check step 3 and restart `npm run dev:frontend`.

**Health shows `"fixture"` (demo) instead of `"live"`**
- `GEMINI_API_KEY` is empty or misspelled in `.env`.
- `.env` must be in the project root folder (next to `package.json`), not inside
  `backend/` or `frontend/`.
- Make sure you saved the file, then stop and restart `npm run dev:backend`.

**Chat says it can't reach the assistant**
- The backend isn't running — start `npm run dev:backend` and check the health URL.

## Checks

```powershell
npm run check   # typecheck + tests + build
```

Service-account (Admin SDK) keys aren't needed yet. If added later, they are
secrets: backend only, never committed (`*service-account*.json` is git-ignored).
