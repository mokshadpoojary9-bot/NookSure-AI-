# Architecture

```
frontend (React/Vite) ──HTTP/JSON──▶ backend (Express) ──▶ AiProvider adapter ──▶ GeminiProvider (@google/genai)
   │    │                                  │                    └─▶ FixtureProvider (no GEMINI_API_KEY)
   │    └──── @nooksure/shared (Zod schemas + types) ───────┘
   └──▶ Firebase Auth (Google sign-in) + Firestore (users/{uid}/plans), browser SDK
```

- **shared/** — single source of truth for request/response shapes. Backend validates
  input with these schemas; frontend parses responses with them. Also holds the
  rule-based planner catalog (`planner.ts`).
- **backend/** — `createApp(config, deps?)` builds the Express app (testable without
  listening; tests inject a fake provider); `loadConfig()` validates env and derives
  `analysisMode`.
- **AI adapter** — routes depend on the `AiProvider` interface, never a vendor SDK.
  If `GEMINI_API_KEY` is unset, a fixture provider returns labeled sample data.
- **`POST /api/chat`** — validates `{ messages }` with `ChatRequestSchema` (≤ 20
  messages, ≤ 2000 chars each, last from the user), rate-limits per IP (in-memory,
  single instance), and calls the provider with a timeout. Responses carry
  `analysisMode` and an `urgent` flag from a deterministic hazard check. Provider
  errors become generic 502/504 messages; details never reach clients, and only the
  error class/status is logged (never message content or keys).
- **Auth** — Firebase Auth runs in the browser only (Google provider, popup with a
  redirect fallback), lazy-loaded and initialized once. Sign-in is optional and the
  backend does not use identity yet. When a route starts relying on the user, it
  must verify Firebase ID tokens server-side with the Admin SDK — never trust a
  client-sent uid.
- **Saved plans** — `frontend/src/lib/plans.ts` reads/writes `users/{uid}/plans/{planId}`
  directly from the browser; the uid comes from the signed-in user, never a field.
  Access is enforced by `firestore.rules` (owner-only, title ≤ 120 chars, fixed fields).
- **frontend/** — hash-routed pages: home, planner, saved plans (signed-in), assistant, safety. Voice input
  and read-aloud use the browser Web Speech API; recognized text is placed in the
  input for review and sent to the same `/api/chat` endpoint. The interactive 3D room
  view (`components/room3d/`, Three.js / React Three Fiber) is lazy-loaded from the
  plan step. `sceneModel.ts` turns the plan into a fixed, illustrative (not-to-scale)
  layout per room type — pure and unit-tested; `RoomView3D.tsx` only renders it.
