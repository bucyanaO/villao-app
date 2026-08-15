/**
 * Props — street furniture & decor: plants, fountains, sculptures, pools, trees, fans, decks.
 */
import * as THREE from 'three';
import { CITY_THEME } from '../theme';
import { sharedMaterials, getMaterial } from './materials';
import { createWireframeObject, createSolidObject } from './primitives';

export const Props = {
    createPlant: (scale: number = 1): THREE.Group => {
        const g = new THREE.Group();
        const pot = createWireframeObject(0.4 * scale, 0.4 * scale, 0.4 * scale, CITY_THEME.colors.props.plantPot, 0.8, 'cylinder');
        const leaves = createSolidObject(0.6 * scale, 0.6 * scale, 0.6 * scale, sharedMaterials.grassGreen, 'cone');
        leaves.position.y = 0.5 * scale;
        g.add(pot, leaves);
        return g;
    },
    createFountain: (): { group: THREE.Group, droplets: THREE.Object3D[] } => {
        const group = new THREE.Group();
        const droplets: THREE.Object3D[] = [];
        const base = createSolidObject(3, 0.5, 3, sharedMaterials.sidewalkConcrete, 'cylinder');
        const water = createSolidObject(2.5, 0.6, 2.5, sharedMaterials.waterBlue, 'cylinder');
        water.position.y = 0.1;
        const pillar = createSolidObject(0.5, 2, 0.5, sharedMaterials.sidewalkConcrete, 'cylinder');
        pillar.position.y = 1;
        group.add(base, water, pillar);
        for(let i=0; i<20; i++) {
             const d = createSolidObject(0.1, 0.1, 0.1, sharedMaterials.waterBlue, 'box');
             d.position.set(0, 2, 0);
             d.userData = { velocity: new THREE.Vector3((Math.random()-0.5)*0.1, Math.random()*0.2, (Math.random()-0.5)*0.1) };
             group.add(d);
             droplets.push(d);
        }
        return { group, droplets };
    },
    createSculpture: (): THREE.Group => {
        const g = new THREE.Group();
        const base = createWireframeObject(1, 1, 1, 0x555555, 0.8);
        const s1 = createWireframeObject(1.5, 1.5, 1.5, 0xff00ff, 0.5, 'icosahedron');
        s1.position.y = 1.5;
        const s2 = createWireframeObject(1, 1, 1, 0x00ffff, 0.5, 'icosahedron');
        s2.position.y = 1.5;
        s2.rotation.y = Math.PI / 4;
        g.add(base, s1, s2);
        return g;
    },
    createSwimmingPool: (width: number, length: number): THREE.Group => {
        const g = new THREE.Group();
        const wMesh = createSolidObject(width, 0.1, length, sharedMaterials.waterBlue, 'box');
        wMesh.position.y = -0.2;
        g.add(wMesh);
        
        const th = 0.2; const bw = 0.8;
        const top = createSolidObject(width + bw*2, th, bw, sharedMaterials.sidewalkConcrete, 'box');
        top.position.set(0, 0, -length/2 - bw/2);
        const bottom = createSolidObject(width + bw*2, th, bw, sharedMaterials.sidewalkConcrete, 'box');
        bottom.position.set(0, 0, length/2 + bw/2);
        const left = createSolidObject(bw, th, length, sharedMaterials.sidewalkConcrete, 'box');
        left.position.set(-width/2 - bw/2, 0, 0);
        const right = createSolidObject(bw, th, length, sharedMaterials.sidewalkConcrete, 'box');
        right.position.set(width/2 + bw/2, 0, 0);
        g.add(top, bottom, left, right);
        return g;
    },
    createReflectingPool: (width: number, length: number): THREE.Group => {
        const g = new THREE.Group();
        // Minimalist border
        const border = createSolidObject(width + 0.4, 0.15, length + 0.4, getMaterial(0x333333, false), 'box');
        border.position.y = 0.05;
        
        // Water
        const water = createSolidObject(width, 0.16, length, sharedMaterials.waterBlue, 'box');
        water.position.y = 0.06;
        
        g.add(border, water);
        return g;
    },
    createFlowerBed: (width: number, depth: number): THREE.Group => {
        const g = new THREE.Group();
        // Soil
        const soil = createSolidObject(width, 0.1, depth, getMaterial(0x3e2723, false), 'box');
        soil.position.y = 0.05;
        g.add(soil);
        
        // Flowers
        const numFlowers = Math.floor(width * depth * 8);
        const colors = CITY_THEME.colors.nature.flowers;
        
        for (let i=0; i<numFlowers; i++) {
            const color = colors[Math.floor(Math.random() * colors.length)];
            const size = 0.15 + Math.random() * 0.1;
            const flow = createSolidObject(size, size, size, getMaterial(color, false), 'box'); // Abstract voxel flowers
            const fx = (Math.random() - 0.5) * (width - 0.2);
            const fz = (Math.random() - 0.5) * (depth - 0.2);
            flow.position.set(fx, 0.1 + size/2, fz);
            flow.rotation.y = Math.random() * Math.PI;
            g.add(flow);
        }
        
        return g;
    },
    createHolographicTree: (scale: number = 1, specificColors?: number[]): THREE.Group => {
        const g = new THREE.Group();
        
        // CUBIC & SPHERICAL GEOMETRY (No more Pyramids/Cones)
        const isCube = Math.random() > 0.5;
        const palette = specificColors || CITY_THEME.colors.props.treeFoliage;
        const foliageColor = palette[Math.floor(Math.random() * palette.length)];
        
        // Trunk: Wireframe cylinder or box
        const trunkH = 1.5 * scale;
        const trunk = createWireframeObject(0.3 * scale, trunkH, 0.3 * scale, 0x555555, 0.4, 'box');
        trunk.position.y = trunkH / 2;
        g.add(trunk);
        
        // Foliage Layers
        const layers = 2 + Math.floor(Math.random() * 2);
        let currentY = trunkH * 0.8;
        
        for (let i = 0; i < layers; i++) {
            const size = (3.0 - i * 0.8) * scale;
            const shape = isCube ? 'box' : 'icosahedron';
            // Use wireframe for holographic look
            const foliage = createWireframeObject(size, size * 0.8, size, foliageColor, 0.25, shape);
            
            foliage.position.y = currentY + size/2;
            
            // Random rotation for organic feel even with cubes
            foliage.rotation.y = Math.random() * Math.PI;
            foliage.rotation.z = (Math.random() - 0.5) * 0.2;
            
            g.add(foliage);
            currentY += size * 0.6;
            
            // Inner Core (Glowing)
            const core = createSolidObject(size * 0.3, size * 0.3, size * 0.3, sharedMaterials.eyeGlow, isCube ? 'box' : 'icosahedron');
            core.position.copy(foliage.position);
            g.add(core);
        }
        
        // Floating particles (Data Leaves)
        const pSize = 0.15 * scale;
        const pCount = Math.floor(4 * scale); 
        for(let i=0; i<pCount; i++) {
             const p = createSolidObject(pSize, pSize, pSize, getMaterial(foliageColor, false), 'box');
             p.position.set(
                 (Math.random()-0.5) * scale * 2.5, 
                 trunkH + Math.random() * scale * 3, 
                 (Math.random()-0.5) * scale * 2.5
             );
             // Floating animation would be handled in main loop, for now static
             g.add(p);
        }
        
        return g;
    },
    createHoloStatue: (): THREE.Group => {
        const g = new THREE.Group();
        const base = createSolidObject(2, 0.5, 2, getMaterial(0x111111, false), 'box');
        base.position.y = 0.25;
        g.add(base);
        
        // Abstract Holo Shape
        const s1 = createWireframeObject(1.5, 3, 1.5, 0xff00ff, 0.4, 'icosahedron');
        s1.position.y = 2.5;
        // Inner core
        const s2 = createWireframeObject(0.8, 1.5, 0.8, 0x00ffff, 0.8, 'icosahedron');
        s2.position.y = 2.5;
        
        g.add(s1, s2);
        return g;
    },
    // New Animated Asset: Ceiling Fan
    createCeilingFan: (): { group: THREE.Group, blades: THREE.Group } => {
        const g = new THREE.Group();
        const rod = createSolidObject(0.05, 0.4, 0.05, getMaterial(0x333333, false), 'cylinder');
        rod.position.y = 0.2;
        const hub = createSolidObject(0.2, 0.1, 0.2, getMaterial(0x555555, false), 'cylinder');
        hub.position.y = 0.4;
        
        const blades = new THREE.Group();
        blades.position.y = 0.4;
        
        const bladeMat = getMaterial(0x8B4513, false);
        for(let i=0; i<4; i++) {
            const b = createSolidObject(0.15, 0.02, 1.2, bladeMat, 'box');
            b.position.set(0, 0, 0.6); // Offset center
            const bladePivot = new THREE.Group();
            bladePivot.rotation.y = (Math.PI / 2) * i;
            bladePivot.add(b);
            blades.add(bladePivot);
        }
        
        g.add(rod, hub, blades);
        return { group: g, blades: blades };
    },
    createDeck: (w: number, d: number): THREE.Group => {
        const g = new THREE.Group();
        // Planks
        const plankW = 0.2;
        const num = Math.floor(w / plankW);
        for(let i=0; i<num; i++) {
            const p = createSolidObject(plankW-0.02, 0.05, d, getMaterial(CITY_THEME.colors.props.wood, false), 'box');
            p.position.set(-w/2 + i*plankW + plankW/2, 0.025, 0);
            g.add(p);
        }
        return g;
    }
};


