/**
 * Voxel primitives: createWireframeObject (edges + translucent fill) and createSolidObject.
 * Rounded shapes are remapped to boxes to enforce the cubic voxel style.
 */
import * as THREE from 'three';
import { CITY_THEME } from '../theme';
import { sharedMaterials, getMaterial, getCachedGeometry } from './materials';

/**
 * `edgeColor` : couleur des arêtes, quand elle doit différer du remplissage.
 * Un volume blanc cerclé de blanc n'a plus ni structure ni relief — il se lit
 * comme un bloc plein, hors du style de la ville.
 */
export const createWireframeObject = (width: number, height: number, depth: number, color: number, opacity: number = 0.1, shape: 'box' | 'icosahedron' | 'cylinder' | 'cone' | 'plane' | 'circle' = 'box', edgeColor?: number): THREE.Group => {
    const group = new THREE.Group();
    const edgesGeo = getCachedGeometry(width, height, depth, 'edges');
    const lineMaterial = getMaterial(edgeColor ?? color, true);
    group.add(new THREE.LineSegments(edgesGeo, lineMaterial));
    const fillGeo = getCachedGeometry(width, height, depth, shape);
    let fillMaterial;
    if (color === 0x00aaff) fillMaterial = sharedMaterials.fillCyan;
    else if (color === CITY_THEME.colors.buildings.glass) fillMaterial = sharedMaterials.fillWindow;
    else if (color === 0x000000) fillMaterial = sharedMaterials.fillBlack;
    else fillMaterial = getMaterial(color, false);
    
    if (opacity < 1) { 
        fillMaterial = (fillMaterial as THREE.Material).clone(); 
        (fillMaterial as THREE.MeshBasicMaterial).opacity = opacity; 
        (fillMaterial as THREE.MeshBasicMaterial).transparent = true;
    }
    group.add(new THREE.Mesh(fillGeo, fillMaterial));
    return group;
};

export const createSolidObject = (width: number, height: number, depth: number, material: THREE.Material, shape: 'box' | 'cylinder' | 'cone' | 'icosahedron' = 'box', addEdges: boolean = false): THREE.Group => {
    const group = new THREE.Group();
    const geo = getCachedGeometry(width, height, depth, shape);
    group.add(new THREE.Mesh(geo, material));
    if (addEdges) { const edgesGeo = getCachedGeometry(width, height, depth, 'edges'); group.add(new THREE.LineSegments(edgesGeo, sharedMaterials.wireframeGrey)); }
    return group;
};


