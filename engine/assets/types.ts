/**
 * Shared type definitions for the voxel city assets.
 */
import * as THREE from 'three';

export enum InhabitantState {
    IDLE,
    WALKING,
    DRIVING,
    SITTING,
    SLEEPING,
    WORKING,
    PACING, // New state for interior movement
    TALKING,     // Interaction sociale
    SIGHTSEEING,  // Interaction environnement
    PANIC,       // Scénario catastrophe (IA)
    DANCING      // Scénario fête (IA)
}

export interface InstanceData {
    mat: THREE.Matrix4;
    color?: number;
}

export interface Bounds {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
}

export interface Collider {
    x: number;
    z: number;
    width: number;
    depth: number;
}


