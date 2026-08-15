/**
 * Engine command contracts: GodOperation + AICommand.
 * These describe the intents the UI (local parser or Gemini) sends to the 3D engine.
 */
import { InhabitantState } from './assets';

// AI Command Interface - Updated for "God Mode"
export interface GodOperation {
    action: 'SPAWN' | 'REMOVE' | 'RECOLOR' | 'RESIZE' | 'TELEPORT' | 'ANIMATE' | 'CAMERA' | 'BUILD';
    selector: {
        type: 'vehicle' | 'inhabitant' | 'building' | 'tree' | 'all';
        color?: string; // e.g., "red" (approximate match)
        count?: 'all' | number;
    };
    params?: {
        type?: 'tree' | 'car' | 'person' | 'sculpture'; // For SPAWN
        color?: string; // Hex string
        scale?: number;
        position?: { x: number, y: number, z: number };
        animationState?: InhabitantState;
        lookAt?: { x: number, y: number, z: number }; // For CAMERA
        // For BUILD
        floors?: number;
        style?: string;
    };
}

export interface AICommand {
    npcState?: InhabitantState;
    trafficSpeed?: number;
    globalChaos?: boolean;
    realityBending?: {
        distortion: number;     // -1 to 1: Bends geometry
        glitchIntensity: number; // 0 to 1: Random color/position jumps
        timeScale: number;      // 0 to 5: Speed of simulation
        gravity: number;        // 1.0 = normal, 0.0 = float, -1.0 = invert
    };
    godOperations?: GodOperation[]; // List of specific object manipulations
    specialEffects?: {
        flood?: boolean;
        alienInvasion?: boolean;
        kaiju?: boolean;
        blackHole?: boolean;
        disco?: boolean;
        meteorShower?: boolean;
        matrix?: boolean;
        rapture?: boolean;
        iceAge?: boolean;
        lava?: boolean;
    };
    summon?: { type: 'car' | 'taxi' | 'truck' | 'bus'; label?: string } | null;
}


