# Architecture

## Layers

```
UI (React)                       Engine (pure TS, no React)            Config/Data
─────────────                    ─────────────────────────────         ───────────
App.tsx (orchestrator)           engine/cityGenerator.ts              engine/theme.ts
  │                              engine/godOperations.ts              engine/presets.ts
  ├─ hooks/                      engine/assets/*                      engine/shaders.ts
  │   useGamepad / useAudio      engine/context.ts (types)            engine/types.ts
  │   useCommandEngine                                              
  │                                                                
  └─ components/                  
      NeighborhoodScene.tsx  ───── uses engine/* + owns the Three.js runtime
      ui/* (presentational)
```

- **`App.tsx`** holds shared state, runs the three feature hooks, and composes the
  `components/ui/*` overlays. It contains no 3D code and no AI prompt text.
- **`hooks/`** own stateful cross-cutting concerns:
  - `useGamepad` — gamepad presence.
  - `useAudio` — the 4-track ambient mixer + volume sync.
  - `useCommandEngine` — the God Mode brain: chat log, local + Gemini execution,
    and the resulting `aiCommand` handed to the scene.
- **`components/NeighborhoodScene.tsx`** is the only React component that touches
  Three.js. It owns the imperative real-time lifecycle (init, input, animation loop,
  reactive effects). Pure engine pieces it used to contain were extracted.
- **`components/ui/*`** are presentational overlays driven entirely by props.
- **`engine/`** is framework-free TypeScript: meshes/materials, the city generator,
  god operations, shaders, presets, theme, and the shared command/state types.

## Data flow

```
user types "commande une voiture"
  └─> ScenarioConsole.onExecute ─> useCommandEngine.runCommand
        ├─ lib/commandParser.parseLocalCommand  ─> { summon: { type:'car' } }
        └─ applyCommandResult ─> setAiCommand({ summon }) + setLighting/setWeather/...
              └─ <VoxelCityScene aiCommand={cmd.aiCommand}>
                    └─ useEffect([aiCommand]) ─> engine/godOperations.summonVehicle(ctx)
                          └─ spawns a vehicle with userData.summonTarget
                                └─ animation loop drives it to the player, stops in reach
                                      └─ player looks at it, presses F ─> enters (drive mode)
```

For Gemini commands, `runCommand` captures the canvas, sends it + telemetry to
Gemini 2.5 Flash, parses the JSON result, and feeds it through the same
`applyCommandResult` path — so local and AI commands share one execution pipeline.

## Key contracts

- `engine/types.ts` — `GodOperation` (SPAWN/REMOVE/RECOLOR/RESIZE/TELEPORT/ANIMATE/CAMERA/BUILD)
  and `AICommand` (settings + reality bending + special effects + godOperations + summon).
- `engine/context.ts` — `AnimState`, `FxRefs`, `AiOverride`, `MoveState`, `InteractionState`,
  `VehicleState`: the mutable ref-held state threaded between the React component and engine functions.
- `engine/godOperations.ts` — `GodOpsCtx` / `SummonCtx` describe exactly which refs each
  operation needs, keeping the extraction honest (no god-object).

## Styling

Tailwind via the CDN `<script>` in `index.html`. The UI is dark, monospace, neon-accented;
all colors live in `engine/theme.ts` (`CITY_THEME`) for the 3D scene.
