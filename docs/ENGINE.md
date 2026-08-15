# 3D Engine

The voxel city is rendered with Three.js. The React side is a thin wrapper
(`components/NeighborhoodScene.tsx`); everything reusable lives in `engine/`.

## Assets — `engine/assets/`

Split by concern, re-exported from `engine/assets/index.ts` as the `CityAssets`
namespace (same shape the app always used):

| File | Contents |
|------|----------|
| `types.ts` | `InhabitantState` enum, `InstanceData`, `Bounds`, `Collider` |
| `materials.ts` | `sharedMaterials` (singletons), `getMaterial`, `getCachedGeometry` |
| `mergers.ts` | `LineMerger`, `MeshMerger` — batch small geometries into one draw call |
| `primitives.ts` | `createWireframeObject`, `createSolidObject` (rounded shapes → boxes for the voxel look) |
| `Life.ts` | inhabitants, vehicles, drones, helicopters |
| `Props.ts` | plants, fountains, sculptures, pools, holographic trees, ceiling fans, decks |
| `interiors.ts` | `Decoration`, `Furniture`, `Architecture`, `RoomAssembler` |
| `Layouts.ts` | composite layouts: apartments, offices, park, procedural building |

Rules:
- Materials are **shared singletons** and must not be disposed per-object (only geometries are).
- Geometries go through `getCachedGeometry` (deduped by size/type).

## City generator — `engine/cityGenerator.ts`

`generateCity(ctx)` builds the whole city for `ctx.architecturalStyle`
(`residential` villas + loop road, or the grid-based `mixed`/`extraordinary`/… city).
It resets the scene first via `cleanScene(group, animRef, fxRefs)`. Roads/trajectories
use the mergers; trees/lamps/props are instanced; vehicles & inhabitants are pushed into
`animRef.current.*List` for the animation loop.

## God operations — `engine/godOperations.ts`

- `executeGodOperations(ops, ctx)` — SPAWN (tree/car/person/sculpture), REMOVE, RECOLOR,
  RESIZE, TELEPORT, ANIMATE, CAMERA (force move), BUILD (procedural building).
- `summonVehicle(type, label, ctx)` — the "command a car" feature: spawns a vehicle ~34 m
  in front of the player, sets `userData.summonTarget`, and the animation loop drives it
  to ~6 m in front of the player so it lands in the crosshair (press **F** to enter).

## Lighting & theme

- `engine/theme.ts` (`CITY_THEME`) — every color/opacity for the scene in one place.
- `engine/presets.ts` (`LIGHTING_PRESETS`) — 8 ambiances (sky/fog/lights/sun), indexed by `lightingPreset`.
- `engine/shaders.ts` — skybox vertex/fragment GLSL.

## Runtime lifecycle (in `NeighborhoodScene.tsx`)

1. **Init (once):** renderer, camera, OrbitControls, PointerLockControls, sky dome, lights,
   stars, weather particles. Then input listeners + the `animate` loop are installed.
2. **Animation loop (`requestAnimationFrame`):**
   - Input polling (keyboard + gamepad) → unified `inputForward`/`inputRight`.
   - Interaction raycast from the screen center (vehicles/buildings within 10 m).
   - Vehicle driving physics (when driving) or FPS movement + jump/gravity.
   - Per-frame updates: vehicles (lanes + summoned), inhabitants (states + social),
     aircraft, traffic lights, fountain droplets, building expansion, fans, screens.
   - Special FX: flood, black hole, disco, distortion/glitch.
   - Camera: chase (driving), FPS (walk), or auto-orbit (drone).
3. **Reactive effects:** lighting/weather preset, walk↔orbit switching, city regeneration
   on style change, AI command application (`executeGodOperations` + `summonVehicle`).

> The init + animation loop is intentionally kept in one component: it is a tight
> real-time loop sharing many closures. It can be further split by passing an
> `EngineContext` (see `engine/context.ts`) into `engine/animation.ts` /
> `engine/controls.ts`; the context types are already defined for that future work.

## Performance notes

- `preserveDrawingBuffer: true` on the renderer so `canvas.toDataURL()` works for Gemini screenshots.
- Pixel ratio is capped at 1.5; shadow maps are off; geometry is merged/instanced aggressively.
