# Setup

1. Install Node.js 20 or newer.
2. `npm install` at the repo root (installs all workspaces).
3. `cp .env.example .env` and fill in values locally. `.env` is git-ignored.
4. `npm run dev:backend` and `npm run dev:frontend` in separate terminals.
5. `npm run check` runs typecheck, tests, and build.

## Environment variables

| Variable                    | Where    | Secret | Notes                                   |
| --------------------------- | -------- | ------ | --------------------------------------- |
| `PORT`, `CORS_ORIGIN`       | backend  | no     |                                         |
| `AI_PROVIDER_API_KEY`       | backend  | **yes** | Empty → fixture mode                   |
| `AI_PROVIDER`, `AI_MODEL`   | backend  | no     |                                         |
| `SUPABASE_URL`              | backend  | no     |                                         |
| `SUPABASE_SERVICE_ROLE_KEY` | backend  | **yes** | Never expose to the frontend           |
| `VITE_*`                    | frontend | no     | Bundled into the browser — public only  |
