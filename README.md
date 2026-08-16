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

## Un monde qui se construit tout seul

La ville n'est plus un décor figé : elle est **bâtie, habitée et étendue par des
agents**, et elle **persiste** d'une session à l'autre.

- **Atelier Villao** (panneau en bas à gauche) : neuf architectes autonomes.
  Ils lisent l'état de la ville — population déduite du parc de logements,
  emplois, équipements manquants — et construisent ce qui manque le plus. Chaque
  ouvrage livré leur donne de l'expérience : leur niveau (★) monte et débloque
  des bâtiments plus riches. La progression est sauvegardée.
- **Trente programmes** : maison, immeuble, bureau, boulangerie, café, magasin,
  marché, hôtel, banque, poste, école, université, clinique, bibliothèque,
  musée, cinéma, stade, mairie, caserne, commissariat, gare, atelier, usine,
  entrepôt, ferme, station-service, parc énergétique, relais télécom, square.
- **Urbanisme réel** : la voirie est déclarée avant le bâti (rien ne pousse au
  milieu d'une rue), et des **distances de priorité** tiennent l'industrie à
  l'écart des logements et des écoles. Quand le foncier manque, le cabinet fait
  **tracer une rue neuve**.
- **Extension sans fin** : en avançant, de nouveaux quartiers naissent devant
  vous — faubourg, tours, vieille ville, jardins, zone industrielle, cité
  béton, quartier futuriste, mégastructure — reliés au réseau par une avenue et
  une rocade. Le sol et la forêt sont engendrés autour de vous : **on ne voit
  jamais le bord du monde**.
- **Vie** : les passants ont un domicile, un travail et une journée ; la
  circulation suit le vrai réseau, carrefour après carrefour.
- **Carte de poche** (en haut à droite) : voirie, bâti coloré par famille
  d'usage, noms des quartiers.

Détail de l'architecture logicielle : [docs/WORLD.md](docs/WORLD.md).

### Paramètres d'URL (repérage / démo)

| Paramètre | Effet |
| --- | --- |
| `?preset=0..7` | ambiance lumineuse (0 = jour, 2 = néon nocturne) |
| `&fog=0.2` | densité de brume |
| `&style=residential\|mixed\|region\|…` | plan de la ville d'origine |
| `&walk=0` | démarrer en vue orbitale plutôt qu'à pied |
| `&cam=x,y,z&look=x,y,z` | placer la caméra |
| `&stats=1` | compteur d'images, d'appels de dessin et d'actes |
| `&reset=1` | repartir d'une ville vierge (efface le registre et la progression) |
| `&restore=1` | rappeler la ville mise de côté par le dernier `reset=1` |

La ville construite est conservée dans le navigateur (`localStorage`,
une clé par style). Pour repartir d'une ville vierge, videz le stockage du site.

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
