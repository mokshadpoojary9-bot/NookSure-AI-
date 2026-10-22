# Deploy guide

The backend (Express API) goes on **Render**; the frontend (React/Vite) goes on
**Vercel**. Both deploy from your GitHub repo. Replace the placeholders as you go:

| Placeholder        | What it is                                              |
| ------------------ | ------------------------------------------------------- |
| `YOUR_RENDER_URL`  | Your backend URL, e.g. `https://nooksure-backend.onrender.com` |
| `YOUR_VERCEL_URL`  | Your frontend URL, e.g. `https://nooksure-ai.vercel.app` |

Do the steps in order — the frontend needs the backend URL, and the backend then
needs the frontend URL.

> Keys go **only** into the Render and Vercel dashboards. Never commit them.

## 1. Backend on Render

1. Sign in at https://render.com (GitHub sign-in is easiest).
2. Click **New** → **Web Service** → connect your GitHub account → pick the
   `NookSure-AI-` repository.
3. Fill in the settings:
   - **Root Directory:** leave empty (the repo root).
   - **Runtime:** Node
   - **Build Command:** `npm ci --include=dev`
   - **Start Command:** `npm run start -w backend`
   - **Instance type:** Free
   - **Health Check Path** (under Advanced): `/api/health`

   (Alternatively, **New** → **Blueprint** reads these from `render.yaml`.)
4. Under **Environment Variables**, add:

   | Key               | Value                                        |
   | ----------------- | -------------------------------------------- |
   | `NODE_VERSION`    | `22`                                         |
   | `NODE_ENV`        | `production`                                 |
   | `GEMINI_API_KEY`  | your Gemini key                              |
   | `GEMINI_MODEL`    | `gemini-2.5-flash`                           |
   | `FRONTEND_ORIGIN` | leave empty for now — you'll set it in step 3 |

   Don't add `PORT`; Render sets it automatically.
5. Click **Create Web Service** (or **Deploy**) and wait for "Live".
6. Copy the URL at the top of the page — that's `YOUR_RENDER_URL`.
7. Open `YOUR_RENDER_URL/api/health` in your browser. You should see
   `"analysisMode":"live"`. If it says `"fixture"`, the Gemini key is missing —
   check step 4 and redeploy.

## 2. Frontend on Vercel

1. Sign in at https://vercel.com with GitHub.
2. Click **Add New…** → **Project** → **Import** the `NookSure-AI-` repository.
3. Settings:
   - **Root Directory:** leave as `./` (the repo root). `vercel.json` already sets
     the install command, the build command (`npm run build -w frontend`) and the
     output folder (`frontend/dist`).
   - **Framework Preset:** Vite (the `vercel.json` settings take priority).
4. Open **Environment Variables** and add (values from your local `.env`):
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_MEASUREMENT_ID` (optional)
   - `VITE_API_BASE_URL` = `YOUR_RENDER_URL` (no trailing slash)

   Never add `GEMINI_API_KEY` here — anything on Vercel with `VITE_` ends up in the
   browser.
5. Click **Deploy**. When it finishes, copy the domain — that's `YOUR_VERCEL_URL`.

## 3. Allow the frontend in the backend (CORS)

1. Back in Render → your service → **Environment**.
2. Set `FRONTEND_ORIGIN` = `YOUR_VERCEL_URL` (exactly, with `https://`, no
   trailing slash). For several domains, separate them with commas.
3. **Save Changes** — Render redeploys. In production the backend accepts browser
   requests **only** from these origins; `*` is never allowed.

## 4. Allow the domain for Google sign-in

Firebase Console → **Authentication** → **Settings** → **Authorized domains** →
**Add domain** → enter the Vercel domain without `https://` (e.g.
`nooksure-ai.vercel.app`) → **Add**. Otherwise sign-in fails with
`auth/unauthorized-domain`.

## 5. Test it

Open `YOUR_VERCEL_URL` and try sign-in, the planner, saving a plan, the assistant,
the mic, read-aloud, and the 3D view (see `docs/setup.md`, step 8).

## Notes

- **Render's free tier sleeps** after about 15 minutes without traffic. The first
  request after that can take about 50 seconds while it wakes up — the assistant
  may show a timeout once; just try again.
- `NODE_ENV=production` also makes the backend trust Render's proxy, so chat rate
  limits apply per user instead of to everyone at once.
- Pushing to `main` triggers new deploys on both services by default.
- Changed a `VITE_` variable on Vercel? Redeploy — they're baked in at build time.
