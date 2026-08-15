/**
 * Engine shared state types.
 * These describe the mutable ref-held state passed between the React component
 * and the pure engine modules (god operations, city generator, animation loop).
 */
import type * as THREE from 'three';
import type { InhabitantState } from './assets';

/** Per-frame animation registries (lists of objects to tick each frame). */
export interface AnimState {
  inhabitantsList: any[];
  vehiclesList: any[];
  buildingsList: THREE.Group[];
  trafficLightsList: any[];
  fountainDropletsList: THREE.Object3D[];
  fanList: THREE.Group[];
  screenList: THREE.Mesh[];
  airTrafficList: any[]; // Drones & Helicopters
  pois: THREE.Vector3[];
  gA: 'x' | 'z';
  tT: number;
}

/** Special-FX object handles (created/destroyed by the animation loop). */
export interface FxRefs {
  waterPlane: THREE.Mesh | null;
  ufoSwarm: THREE.Group[];
  kaiju: THREE.Group | null;
  blackHole: THREE.Mesh | null;
  meteors: THREE.Mesh[];
}

/** God-mode overrides applied each frame by the animation loop. */
export interface AiOverride {
  trafficMultiplier: number;
  forcedNpcState: InhabitantState | null;
  chaosMode: boolean;
  distortion: number;
  glitchIntensity: number;
  timeScale: number;
  gravity: number;
  fx: {
    flood: boolean;
    alienInvasion: boolean;
    kaiju: boolean;
    blackHole: boolean;
    disco: boolean;
    meteorShower: boolean;
    matrix: boolean;
    rapture: boolean;
    iceAge: boolean;
    lava: boolean;
  };
}

/** FPS movement input flags. */
export interface MoveState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  run: boolean;
  jump: boolean;
}

/** Current interactable under the crosshair. */
export interface InteractionState {
  target: THREE.Object3D | null;
  type: 'vehicle' | 'building' | 'agent' | null;
}

/** The vehicle currently being driven (or null). */
export interface VehicleState {
  current: THREE.Group | null;
  velocity: number;
  steering: number;
}
