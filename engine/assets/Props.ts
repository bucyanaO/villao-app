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
        // Terre
        const soil = createSolidObject(width, 0.1, depth, getMaterial(0x3e2723, false), 'box');
        soil.position.y = 0.05;
        g.add(soil);

        // Fleurs : une seule instance colorée par parterre. En meshes séparés,
        // un parterre coûtait à lui seul plus de cent appels de dessin.
        const numFlowers = Math.floor(width * depth * 8);
        if (numFlowers > 0) {
            const colors = CITY_THEME.colors.nature.flowers;
            const geo = new THREE.BoxGeometry(1, 1, 1);
            const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const im = new THREE.InstancedMesh(geo, mat, numFlowers);
            const dummy = new THREE.Object3D();
            const col = new THREE.Color();
            for (let i = 0; i < numFlowers; i++) {
                const size = 0.15 + Math.random() * 0.1;
                dummy.position.set(
                    (Math.random() - 0.5) * (width - 0.2),
                    0.1 + size / 2,
                    (Math.random() - 0.5) * (depth - 0.2),
                );
                dummy.rotation.set(0, Math.random() * Math.PI, 0);
                dummy.scale.setScalar(size);
                dummy.updateMatrix();
                im.setMatrixAt(i, dummy.matrix);
                im.setColorAt(i, col.setHex(colors[Math.floor(Math.random() * colors.length)]));
            }
            im.instanceMatrix.needsUpdate = true;
            if (im.instanceColor) im.instanceColor.needsUpdate = true;
            g.add(im);
        }

        return g;
    },
    createHolographicTree: (scale: number = 1, specificColors?: number[]): THREE.Group => {
        const g = new THREE.Group();
        
        // Majoritairement des masses arrondies : en boîtes, l'arbre lisait comme
        // un gros cube vert translucide posé sur la pelouse.
        const isCube = Math.random() > 0.78;
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
            const size = (2.3 - i * 0.75) * scale;
            const shape = isCube ? 'box' : 'icosahedron';
            // Use wireframe for holographic look
            const foliage = createWireframeObject(size, size * 0.85, size, foliageColor, 0.18, shape);
            
            foliage.position.y = currentY + size/2;
            
            // Random rotation for organic feel even with cubes
            foliage.rotation.y = (isCube ? Math.PI / 4 : 0) + Math.random() * Math.PI;
            foliage.rotation.z = (Math.random() - 0.5) * 0.2;
            
            g.add(foliage);
            currentY += size * 0.6;

            // Coeur lumineux : seulement sur la couronne, pas à chaque étage.
            if (i === layers - 1) {
                const core = createSolidObject(size * 0.3, size * 0.3, size * 0.3, sharedMaterials.eyeGlow, isCube ? 'box' : 'icosahedron');
                core.position.copy(foliage.position);
                g.add(core);
            }
        }

        // Feuilles de données : une seule instance pour tout l'arbre. En meshes
        // séparés, un alignement d'arbres pesait à lui seul des milliers
        // d'appels de dessin.
        const pCount = Math.max(2, Math.floor(3 * scale));
        const pSize = 0.15 * scale;
        const pGeo = new THREE.BoxGeometry(pSize, pSize, pSize);
        const leaves = new THREE.InstancedMesh(pGeo, getMaterial(foliageColor, false), pCount);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < pCount; i++) {
            dummy.position.set(
                (Math.random() - 0.5) * scale * 2.5,
                trunkH + Math.random() * scale * 3,
                (Math.random() - 0.5) * scale * 2.5,
            );
            dummy.rotation.set(0, Math.random() * Math.PI, 0);
            dummy.updateMatrix();
            leaves.setMatrixAt(i, dummy.matrix);
        }
        leaves.instanceMatrix.needsUpdate = true;
        g.add(leaves);

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
    /**
     * Terrasse en bois : une dalle unique + un rainurage en lignes.
     * (Avant : une boîte par latte — jusqu'à 45 meshes par terrasse, et un
     * aplat orange très voyant qui donnait ces « tapis » posés dans l'herbe.)
     */
    createDeck: (w: number, d: number): THREE.Group => {
        const g = new THREE.Group();
        const slab = createSolidObject(w, 0.06, d, getMaterial(0x54402f, false), 'box');
        slab.position.y = 0.03;
        g.add(slab);

        // rainures : une ligne toutes les 40 cm, discrètes
        const pts: number[] = [];
        for (let x = -w / 2 + 0.4; x < w / 2; x += 0.4) {
            pts.push(x, 0.065, -d / 2, x, 0.065, d / 2);
        }
        if (pts.length) {
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
            g.add(new THREE.LineSegments(geo, getMaterial(0x4a3222, true)));
        }
        return g;
    }
};


