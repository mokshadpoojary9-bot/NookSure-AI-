# Architecture

```
frontend (React/Vite) ──HTTP/JSON──▶ backend (Express) ──▶ AiProvider adapter ──▶ AI vendor
        │                                  │                    └─▶ FixtureProvider (no key)
        └──────── @nooksure/shared (Zod schemas + types) ───────┘
                                           └──▶ Supabase (planned)
```

- **shared/** — single source of truth for request/response shapes. Backend validates
  input with these schemas; frontend parses responses with them.
- **backend/** — `createApp(config)` builds the Express app (testable without
  listening); `loadConfig()` validates env and derives `analysisMode`.
- **AI adapter** — routes depend on the `AiProvider` interface, never a vendor SDK.
  If `AI_PROVIDER_API_KEY` is unset, a fixture provider returns labeled sample data.
- **frontend/** — will host the planner UI and an interactive 3D room view
  (Three.js / React Three Fiber).
