/**
 * LineMerger & MeshMerger — batch many small geometries into single draw calls.
 */
import * as THREE from 'three';
import { getMaterial } from './materials';

export class LineMerger {
    positions: number[] = [];
    addBox(matrix: THREE.Matrix4, w: number, h: number, d: number) {
        const hw = w/2, hh = h/2, hd = d/2;
        const v = [new THREE.Vector3(-hw,-hh,-hd), new THREE.Vector3(hw,-hh,-hd), new THREE.Vector3(hw,hh,-hd), new THREE.Vector3(-hw,hh,-hd), new THREE.Vector3(-hw,-hh,hd), new THREE.Vector3(hw,-hh,hd), new THREE.Vector3(hw,hh,hd), new THREE.Vector3(-hw,hh,hd), new THREE.Vector3(hw,hh,hd), new THREE.Vector3(hw,hh,hd), new THREE.Vector3(-hw,hh,hd)];
        v.forEach(p => p.applyMatrix4(matrix));
        const pairs = [[0,1], [1,2], [2,3], [3,0], [4,5], [5,6], [6,7], [7,4], [0,4], [1,5], [2,6], [3,7]];
        pairs.forEach(p => { this.positions.push(v[p[0]].x, v[p[0]].y, v[p[0]].z); this.positions.push(v[p[1]].x, v[p[1]].y, v[p[1]].z); });
    }
    addLine(p1: THREE.Vector3, p2: THREE.Vector3) {
        this.positions.push(p1.x, p1.y, p1.z);
        this.positions.push(p2.x, p2.y, p2.z);
    }
    getObject(color: number | THREE.Material) {
        if (this.positions.length === 0) return null;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
        const mat = typeof color === 'number' ? getMaterial(color, true) : color;
        return new THREE.LineSegments(geo, mat);
    }
}

export class MeshMerger {
    geometries: THREE.BufferGeometry[] = [];
    material: THREE.Material;
    constructor(material: THREE.Material) { this.material = material; }
    addBox(matrix: THREE.Matrix4, w: number, h: number, d: number) {
        const geo = new THREE.BoxGeometry(w, h, d);
        geo.applyMatrix4(matrix);
        this.geometries.push(geo);
    }
    toMesh() {
        if (this.geometries.length === 0) return null;
        // Merge geometries efficiently
        const attributes: Record<string, any[]> = { position: [], normal: [] };
        
        // Calculate total count first for optimization could be done, but simplified for clarity:
        let totalCount = 0;
        this.geometries.forEach(g => totalCount += g.attributes.position.count);
        
        const position = new Float32Array(totalCount * 3);
        const normal = new Float32Array(totalCount * 3);
        
        let offset = 0;
        this.geometries.forEach(g => {
             const p = g.attributes.position.array;
             const n = g.attributes.normal.array;
             for(let i=0; i<p.length; i++) position[offset*3 + i] = p[i];
             for(let i=0; i<n.length; i++) normal[offset*3 + i] = n[i];
             offset += g.attributes.position.count;
             g.dispose(); // Important: Dispose intermediate geometries
        });
        
        const mergedGeo = new THREE.BufferGeometry();
        mergedGeo.setAttribute('position', new THREE.BufferAttribute(position, 3));
        mergedGeo.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
        
        return new THREE.Mesh(mergedGeo, this.material);
    }
}


