# NookSure AI

**A "Use What You Have" home safety planner for mobility needs.**

NookSure AI helps families prepare a home for someone who uses a walker or a wheelchair, or for an older relative, by reusing and rearranging what they already own before buying anything. It builds an ordered safety plan from the user's real home layout and furniture, and shows each room in a labelled 3D view.

Built for **Build, Ship, Shape: Amazon Developer Hackathon 2026**.

---

## Links

| | Link |
|---|---|
| 🌐 Live demo (frontend, Vercel) | https://nooksure-ai.vercel.app |
| ⚙️ Backend API (Render) | https://nooksure-ai.onrender.com |
| ❤️ Backend health check | https://nooksure-ai.onrender.com/api/health |
| 💻 Source code (GitHub) | https://github.com/mokshadpoojary9-bot/NookSure-AI- |
| 🎬 Demo video | [YouTube link] |

> The backend runs on Render's free tier and sleeps when idle. The first request after a break can take about 50 seconds.

---

## The problem

Most home-accessibility advice assumes large houses and a budget for new products. Many real homes in India are a 1RK or 1BHK, where the main door opens straight into the hall, the kitchen is open to the living room, and the bathroom has an Indian-style toilet or a bucket and mug. When families can't find guidance that fits, they improvise, sometimes dangerously: bricks stacked as a ramp, or a towel rail used as a grab bar.

## The solution

NookSure AI asks about the actual home, the mobility need, the furniture already there and the problems the user notices. It then produces a plan in a fixed, safe order:

1. **Reuse:** put things you already own to safer use.
2. **Rearrange:** open walking routes and bring essentials within reach.
3. **Remove:** take away trip hazards such as loose rugs, clutter and cables.
4. **Purchase:** only then, purpose-built products installed by a professional.

It never suggests improvised ramps or load-bearing fixes, and it never claims a home is certified safe.

---

## MCP server

`mcp-server/` exposes NookSure's planner as a [Model Context Protocol](https://modelcontextprotocol.io) server, so an MCP-compatible agent can build the same plan the web app does. It runs over **stdio** (local agents) and **Streamable HTTP** (MCP protocol 2025-11-25), and the backend serves it remotely at:

**`https://nooksure-ai.onrender.com/mcp`**

It uses the official `@modelcontextprotocol/sdk` and calls the planning rules in `shared/` directly — no separate copy of the logic, and every safety rule still applies. Tool inputs are validated with Zod.

| Tool | What it does |
|---|---|
| `build_home_safety_plan` | Takes the home type and layout answers (door into the living room, open kitchen, garden, …), mobility aids, rooms, furniture per room and observations per room. Returns the ordered **Reuse → Rearrange → Remove → Purchase** plan, as readable text and as JSON, labelled rule-based and not a safety certification. |
| `list_options` | Lists valid home types, rooms, mobility aids, furniture and observations. Given a home type, also lists that home's room ids with the furniture and observations that apply to each. |
| `get_safety_principles` | Returns the safety rules from [`docs/safety.md`](docs/safety.md): guidance not certification, no improvised ramps or load-bearing fixes, grab bars and handrails only purpose-built and professionally installed. |

All three tools are read-only, make no network calls, and give the same answer every time. They need no sign-in: the remote endpoint is public (no account linking), stateless (POST only; GET/DELETE return 405), rate-limited per client, and rejects browser requests from origins other than the web app.

**Build and run** (from the repo root, after `npm install`):

```bash
npm run build -w mcp-server      # bundles to mcp-server/dist/index.js
node mcp-server/dist/index.js    # starts the server on stdio
npm test -w mcp-server           # tool tests
npm run start:http -w mcp-server # local Streamable HTTP server on http://127.0.0.1:3002/mcp
```

**Connect it to an agent** — for example in Claude Desktop's `claude_desktop_config.json` (or any MCP client that launches stdio servers), using the absolute path to your clone:

```json
{
  "mcpServers": {
    "nooksure": {
      "command": "node",
      "args": ["/absolute/path/to/NookSure-AI-/mcp-server/dist/index.js"]
    }
  }
}
```

On Windows, escape the backslashes in JSON: `"C:\\Users\\you\\NookSure-AI-\\mcp-server\\dist\\index.js"`. Then ask the agent, for example: *“Plan a 1BHK with an open kitchen for someone using a walker; the living room has a rug and a floor lamp, and the rug slides.”*

**Connect it to Alexa+** with the [Alexa AI CLI](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-quickstart.html). The CLI needs an Alexa developer account and Node.js 24+. Install it as described in [Set Up Your Development Environment](https://developer.amazon.com/docs/alexaplus/add-ons/set-up-your-development-environment.html), which includes logging npm in to Amazon's package registry first, then:

```bash
npm install -g @alexa-ai/cli     # after the registry login from the setup guide
alexa-ai configure                # sign in with your Amazon developer account
alexa-ai new mcp --name "NookSure" --locale en-US --mcp-server-url "https://nooksure-ai.onrender.com/mcp"
alexa-ai deploy
alexa-ai submit                   # when you're ready for certification
```

No account linking is needed: Amazon's guide says it's optional, and only needed when tools depend on who the user is ([Account Linking for MCP Add-ons](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-account-linking)). The backend is on Render's free tier, so the first request after a quiet spell can take about 50 seconds while it wakes up.
