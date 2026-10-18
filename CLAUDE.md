# NookSure AI — Project Rules

Tagline: "Prepare thoughtfully. Reuse wisely."

## Layout
- `frontend/` React + Vite + TS. `backend/` Express + TS. `shared/` Zod schemas/types
  consumed by both as `@nooksure/shared` (npm workspaces, TS source exports).
- Run `npm run check` (typecheck + tests + build) before every commit.

## Safety rules (non-negotiable)
- Never recommend furniture as grab bars, stacked objects as ramps or steps, or any
  improvised load-bearing / fall-protection solution. See `docs/safety.md`.
- Never claim a home is "certified safe", "fully accessible", or similar.
- Never present fixture output as AI analysis. Every AI-derived response carries
  `analysisMode: "live" | "fixture"` and the UI must label fixture results.
- Jugaad Planner order: reuse → rearrange → remove → purchase.

## AI
- AI calls happen server-side only, through the `AiProvider` adapter
  (`backend/src/ai/provider.ts`). No vendor SDK calls in routes or the frontend.
- Gemini via `@google/genai`; key is `GEMINI_API_KEY` (server-only). No key → fixture provider.

## Secrets & Git
- Never commit `.env`, API keys, tokens, passwords, or Firebase service-account keys.
  Only `VITE_*` publishable values (e.g. Firebase web config) may reach the browser.
- Firebase is the only database/auth provider. Do not introduce Supabase or another.
- Never force-push. Inspect the diff before committing. Preserve unrelated work.
- Do not touch other projects (EvidenceLoop, SpeakIQ AI Coach).
