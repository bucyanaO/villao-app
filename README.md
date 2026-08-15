# CITÉ VOXEL — Voxel City Simulator

An interactive 3D voxel city built with **React + Three.js + Gemini**.
Walk the streets in first person, drive vehicles, visit buildings, and reshape
the world from a "God Mode" command console (a local command parser works
offline; a Gemini key unlocks full multimodal AI commands).

## Run locally

**Prerequisite:** Node.js

```bash
npm install
npm run dev      # http://localhost:3000
```

Build for production:

```bash
npm run build    # outputs to dist/
npm run preview  # preview the production build
```

### Optional: full AI commands

The console works offline for the built-in commands (see [docs/COMMANDS.md](docs/COMMANDS.md)).
For the full Gemini-powered experience, set a real key in `.env.local`:

```
GEMINI_API_KEY=your_real_key_here
```

## Controls

- **Walk mode (FPS):** `ZQSD` / arrows to move, `Shift` to run, `Space` to jump, `F` to interact (enter vehicle / visit building). Click to lock the pointer.
- **Drive mode:** `ZQSD` to pilot, `F` to exit.
- **Gamepad:** fully supported (Xbox/PS) — sticks to move/look, `A` jump, `X` interact, `B` exit.
- **Orbit mode:** drag to orbit, scroll to zoom (disabled while walking).
- **God Mode console:** red button (top-right) → type a command, e.g. `commande une voiture`.

## Project structure

```
villao/
├── index.html / index.tsx        # entry point
├── App.tsx                       # orchestrator: state + hooks + UI composition (slim)
├── components/
│   ├── NeighborhoodScene.tsx     # React wrapper around the Three.js lifecycle
│   └── ui/                       # presentational overlays (HUDs, menus, console, modal)
├── hooks/                        # stateful logic
│   ├── useGamepad.ts             # gamepad connection detection
│   ├── useAudio.ts               # ambient multi-track audio mixer
│   └── useCommandEngine.ts       # God Mode brain (chat + local parser + Gemini)
├── lib/
│   └── commandParser.ts          # offline French command → engine intent
├── engine/                       # pure 3D engine (no React)
│   ├── theme.ts                  # CITY_THEME color/opacity config
│   ├── shaders.ts                # skybox GLSL
│   ├── presets.ts                # lighting presets
│   ├── types.ts                  # GodOperation / AICommand contracts
│   ├── context.ts                # shared engine state types
│   ├── godOperations.ts          # spawn/remove/... + summonVehicle
│   ├── cityGenerator.ts          # builds the city for a style
│   └── assets/                   # voxel meshes & materials (split by concern)
├── server/                      # secure AI gateway (holds LLM keys; deploys to the VPS)
└── docs/                         # architecture & feature docs
```

The AI NPC chat routes through a **secure gateway** (`server/`) in production so the
LLM key never reaches the browser — see [server/README.md](server/README.md).

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the module map and data flow,
[docs/ENGINE.md](docs/ENGINE.md) for the 3D engine, and
[docs/COMMANDS.md](docs/COMMANDS.md) for the command system.

## Tech

React 19 · Three.js 0.181 · Vite 6 · TypeScript · `@google/genai` (Gemini 2.5)
