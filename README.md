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

It never suggests

---

## MCP server

`mcp-server/` exposes NookSure's planner as a [Model Context Protocol](https://modelcontextprotocol.io) server (stdio), so an MCP-compatible agent can build the same plan the web app does. It uses the official `@modelcontextprotocol/sdk` and calls the planning rules in `shared/` directly — no separate copy of the logic, and every safety rule still applies. Tool inputs are validated with Zod.

| Tool | What it does |
|---|---|
| `build_home_safety_plan` | Takes the home type and layout answers (door into the living room, open kitchen, garden, …), mobility aids, rooms, furniture per room and observations per room. Returns the ordered **Reuse → Rearrange → Remove → Purchase** plan, as readable text and as JSON, labelled rule-based and not a safety certification. |
| `list_options` | Lists valid home types, rooms, mobility aids, furniture and observations. Given a home type, also lists that home's room ids with the furniture and observations that apply to each. |
| `get_safety_principles` | Returns the safety rules from [`docs/safety.md`](docs/safety.md): guidance not certification, no improvised ramps or load-bearing fixes, grab bars and handrails only purpose-built and professionally installed. |

All three tools are read-only, make no network calls, and give the same answer every time.

**Build and run** (from the repo root, after `npm install`):

```bash
npm run build -w mcp-server      # bundles to mcp-server/dist/index.js
node mcp-server/dist/index.js    # starts the server on stdio
npm test -w mcp-server           # tool tests
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
