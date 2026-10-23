Replace README.md in my NookSure AI repo with the content below. Before committing, check it against the real repo and fix ONLY details that don't match: package.json script names, folder names, env variable names, and the current test count (run the tests). Do not add features or claims. Do not include any secret values. Then commit as "Update README" and push to origin main (never force-push). Confirm the push succeeded and show me the final README.

--- README START ---
# NookSure AI

**A "Use What You Have" home safety planner for mobility needs.**

NookSure AI helps families prepare a home for someone using a walker or a wheelchair, or for an older relative, by reusing and rearranging what they already own before buying anything.

![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-000000?logo=three.js&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?logo=express&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?logo=firebase&logoColor=black)
![Gemini](https://img.shields.io/badge/Google%20Gemini-8E75B2?logo=googlegemini&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white)
![Render](https://img.shields.io/badge/Render-46E3B7?logo=render&logoColor=black)

## Links

- **Live demo:** https://nooksure-ai.vercel.app
- **Backend health check:** https://nooksure-ai.onrender.com/api/health
- **Repository:** https://github.com/mokshadpoojary9-bot/NookSure-AI-
- **Demo video:** [YouTube link]

## Screenshots

| Landing | Planner | 3D room |
|---|---|---|
| ![Landing](docs/screenshots/landing.png) | ![Planner](docs/screenshots/planner.png) | ![3D room](docs/screenshots/3d-room.png) |

| Assistant | Safety |
|---|---|
| ![Assistant](docs/screenshots/assistant.png) | ![Safety](docs/screenshots/safety.png) |

## The problem

Most home-accessibility advice assumes large houses and a budget for new products. Real Indian homes are often a 1RK or 1BHK, with the main door opening straight into the hall, an open kitchen, or an Indian-style toilet. Without clear guidance, people improvise unsafe fixes like brick ramps or towel rails used as grab bars.

## The solution

Every recommendation follows the same order:

1. **Reuse:** put things you already own to safer use.
2. **Rearrange:** open walking routes and bring essentials within reach.
3. **Remove:** take away trip hazards like loose rugs, clutter and cables.
4. **Purchase:** only then, purpose-built products installed by a professional.

## Features

- **Home layout setup:** Studio/1RK, 1BHK, 2BHK, 3BHK or custom, with merged rooms (living room + entrance, open kitchen), bathrooms, balcony and garden.
- **Furniture-aware plan:** tick the furniture you own; the plan reuses it before suggesting purchases.
- **Ordered checklist** with progress tracking.
- **Labelled 3D room view:** your furniture, numbered pins with a linked legend, and toggleable overlays (1.5 m turning circle, walking path, grab bar zones, non-slip zones, night-light path). Illustrative layout, not to scale.
- **AI Assistant:** Gemini 2.5 Flash via the backend, with voice input, read-aloud and automatic retry when the AI service is overloaded.
- **Saved plans** with Google sign-in.
- **Safety page:** principles, room-by-room checks, do and don't, when to call a professional, printable checklist.
- **Credits page** for all 3D model authors.

## Tech stack

| Area | Technology |
|---|---|
| Frontend | React, Vite, TypeScript, Three.js, React Three Fiber, Framer Motion |
| Backend | Node.js, Express, Zod |
| AI | Google Gemini 2.5 Flash (server-side only) |
| Auth and data | Firebase Authentication (Google), Cloud Firestore |
| 3D assets | Poly Haven (CC0), Sketchfab (CC-BY), converted with Blender to glTF/GLB |
| Testing | Vitest |
| Deployment | Vercel (frontend), Render (backend) |

## Architecture

```mermaid
flowchart LR
  U[User browser] --> F[Frontend on Vercel]
  F -->|/api| B[Express API on Render]
  B -->
