/**
 * Shared materials + geometry cache (rendering singletons).
 * Materials are intentionally shared and must NOT be disposed per-object.
 */
import * as THREE from 'three';
import { CITY_THEME } from '../theme';

export const sharedMaterials: Record<string, THREE.Material> = {
    wireframeCyan: new THREE.LineBasicMaterial({ color: 0x00eaff }), 
    wireframeWhite: new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }),
    wireframeGrey: new THREE.LineBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.5 }),
    wireframeGreen: new THREE.LineBasicMaterial({ color: 0x00ff66 }), 
    wireframeRoadBorder: new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.6 }), 
    
    fillCyan: new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.08, side: THREE.FrontSide, depthWrite: false }),
    fillWindow: new THREE.MeshBasicMaterial({ color: CITY_THEME.colors.buildings.glass, transparent: true, opacity: CITY_THEME.opacity.glass, side: THREE.FrontSide }), 
    fillBlack: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: false, opacity: 1.0, side: THREE.DoubleSide }),
    
    roadAsphalt: new THREE.MeshBasicMaterial({ color: CITY_THEME.colors.ground.roadBase, side: THREE.FrontSide, transparent: false }),
    sidewalkConcrete: new THREE.MeshBasicMaterial({ color: CITY_THEME.colors.ground.sidewalkBase, side: THREE.FrontSide, transparent: false }),
    
    treeLeaves: new THREE.MeshBasicMaterial({ color: 0x2E8B57, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.5 }),
    treeTrunk: new THREE.MeshBasicMaterial({ color: 0x5A3E36 }),
    grassGreen: new THREE.MeshBasicMaterial({ color: CITY_THEME.colors.nature.grass, transparent: false, opacity: 1.0, side: THREE.DoubleSide }),
    
    roadMarking: new THREE.MeshBasicMaterial({ color: CITY_THEME.colors.ground.markings, transparent: true, opacity: 0.9, side: THREE.FrontSide, depthWrite: false }), 
    crosswalkWhite: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.FrontSide, depthWrite: false }), 
    
    vehicleHeadlight: new THREE.MeshBasicMaterial({ color: 0xffffcc, transparent: true, opacity: 0.9 }),
    vehicleTaillight: new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.9 }),
    waterBlue: new THREE.MeshBasicMaterial({ color: CITY_THEME.colors.props.water, transparent: true, opacity: 0.6 }),
    lampLight: new THREE.MeshBasicMaterial({ color: 0xffffaa, transparent: true, opacity: 0.95 }),
    
    eyeGlow: new THREE.MeshBasicMaterial({ color: 0xccffff, transparent: true, opacity: 0.9 }),
    accessoryDark: new THREE.MeshBasicMaterial({ color: CITY_THEME.colors.characters.accessories, transparent: false }),
    manholeMetal: new THREE.MeshBasicMaterial({ color: 0x222222, transparent: false }),
    potholeDark: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: false }),
    patchAsphalt: new THREE.MeshBasicMaterial({ color: 0x1a1a2e, transparent: false }),
    
    // New Materials for Aircraft
    droneLightRed: new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 1.0 }),
    droneLightGreen: new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 1.0 }),
    searchLightBeam: new THREE.MeshBasicMaterial({ color: 0xffffaa, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
};

export const getMaterial = (color: number, isLine: boolean = false): THREE.Material => {
    const key = `${color}-${isLine}`;
    if (!sharedMaterials[key]) {
        if (isLine) {
            sharedMaterials[key] = new THREE.LineBasicMaterial({ color: color });
        } else {
            sharedMaterials[key] = new THREE.MeshBasicMaterial({ 
                color: color, 
                transparent: false, 
                opacity: 1.0, 
                side: THREE.FrontSide 
            });
        }
    }
    return sharedMaterials[key];
};

const geometryCache: Record<string, THREE.BufferGeometry> = {};
export const getCachedGeometry = (width: number, height: number, depth: number, type: string, segments?: number): THREE.BufferGeometry => {
    const w = Math.round(width * 100) / 100; const h = Math.round(height * 100) / 100; const d = Math.round(depth * 100) / 100;
    
    // ENFORCE CUBIC / VOXEL STYLE
    // Remap rounded shapes to Box automatically
    let generationType = type;
    if (type === 'cylinder' || type === 'cone' || type === 'icosahedron' || type === 'circle') {
        generationType = 'box';
    }

    // Keep unique key based on actual type requested to avoid cache collisions 
    // if logic changes, but fundamentally mapping to boxes.
    const key = `${generationType}-${w}-${h}-${d}-${segments || 0}`;
    
    if (!geometryCache[key]) {
        let geo;
        
        if (generationType === 'plane') {
            geo = new THREE.PlaneGeometry(w, h);
        } 
        else if (generationType === 'edges') {
            // Edges logic handled below
             // Use box as base for edges if not specified
             geo = new THREE.BoxGeometry(w, h, d);
        }
        else {
            // Default everything to BOX
            geo = new THREE.BoxGeometry(w, h, d);
        }
        
        if (type === 'edges') { 
            const edge = new THREE.EdgesGeometry(geo); 
            geometryCache[key] = edge;
            // Dispose intermediate
            geo.dispose(); 
        } 
        else {
            geometryCache[key] = geo;
        }
    }
    return geometryCache[key];
};


