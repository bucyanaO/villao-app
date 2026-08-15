/**
 * Layouts — composite room/building layouts (apartments, offices, park, procedural building).
 */
import * as THREE from 'three';
import { InhabitantState, InstanceData } from './types';
import { getMaterial } from './materials';
import { sharedMaterials } from './materials';
import { createWireframeObject, createSolidObject } from './primitives';
import { Props } from './Props';
import { Life } from './Life';
import { RoomAssembler, Architecture, Furniture } from './interiors';

/** Lit windows on a floor box — a modern "2026" accent on procedural buildings. */
const addWindows = (box: THREE.Group, w: number, d: number, fh: number) => {
  const cols = Math.min(4, Math.max(2, Math.floor(w / 2.5)));
  const mat = Math.random() > 0.5 ? sharedMaterials.lampLight : sharedMaterials.eyeGlow;
  for (let cx = 0; cx < cols; cx++) {
    const wx = -w/2 + 0.7 + cx * ((w - 1.4) / Math.max(1, cols - 1));
    if (Math.random() > 0.25) {
      const win = createSolidObject(0.3, 0.35, 0.05, mat, 'box');
      win.position.set(wx, 0, -d/2 - 0.05);
      box.add(win);
    }
  }
};

export const Layouts = {
    createSmallTechnicalRoom: (floorW: number, floorD: number, animatedObjects: { fans: THREE.Group[], screens: THREE.Mesh[] } = {fans:[], screens:[]}): { furniture: THREE.Group, inhabitants: THREE.Group[] } => {
        const furniture = new THREE.Group();
        const inhabitants: THREE.Group[] = [];
        RoomAssembler.fillRoom(furniture, 'office', floorW, floorD, inhabitants, animatedObjects);
        return { furniture, inhabitants };
    },
    createGroundFloorLayout: (type: string, w: number, d: number, animatedObjects: { fans: THREE.Group[], screens: THREE.Mesh[] } = {fans:[], screens:[]}): { furniture: THREE.Group, inhabitants: THREE.Group[] } => {
        const furniture = new THREE.Group();
        const inhabitants: THREE.Group[] = [];
        if (type === 'retail') {
            const shelfCount = Math.floor(w / 3);
            for(let i=0; i<shelfCount; i++) {
                const s = Furniture.createRetailShelf();
                s.position.set((i - shelfCount/2)*2.5, 0, -d/4);
                furniture.add(s);
            }
             if (Math.random() > 0.5) { const p = Life.createInhabitant(InhabitantState.IDLE); p.position.set(0, 0, 0); furniture.add(p); inhabitants.push(p); }
        } else if (type === 'lobby') {
            const desk = Furniture.createCornerDesk(); desk.position.set(0, 0, -d/4); furniture.add(desk);
            const sofa = Furniture.createSectionalSofa(); sofa.position.set(w/4, 0, d/4); furniture.add(sofa);
            const plant = Props.createPlant(1.5); plant.position.set(-w/3, 0, d/3); furniture.add(plant);
        } else if (type === 'parking') {
            const line = createWireframeObject(w, 0.05, 0.2, 0xffffff, 0.5); line.position.set(0,0,0); furniture.add(line);
        }
        return { furniture, inhabitants };
    },
    createOfficeLayout: (w: number, d: number, animatedObjects: { fans: THREE.Group[], screens: THREE.Mesh[] } = {fans:[], screens:[]}): { furniture: THREE.Group, inhabitants: THREE.Group[] } => {
        const furniture = new THREE.Group();
        const inhabitants: THREE.Group[] = [];
        RoomAssembler.fillRoom(furniture, 'office', w, d, inhabitants, animatedObjects);
        return { furniture, inhabitants };
    },
    createApartment2Bed: (w: number, d: number, animatedObjects: { fans: THREE.Group[], screens: THREE.Mesh[] } = {fans:[], screens:[]}): { furniture: THREE.Group, inhabitants: THREE.Group[] } => {
         const furniture = new THREE.Group();
         const inhabitants: THREE.Group[] = [];
         const livingGroup = new THREE.Group(); livingGroup.position.set(-w/4, 0, 0);
         RoomAssembler.fillRoom(livingGroup, 'living', w/2, d, inhabitants, animatedObjects);
         furniture.add(livingGroup);
         const bedGroup = new THREE.Group(); bedGroup.position.set(w/4, 0, -d/4);
         RoomAssembler.fillRoom(bedGroup, 'bedroom', w/2, d/2, inhabitants, animatedObjects);
         furniture.add(bedGroup);
         return { furniture, inhabitants };
    },
    createOneBedroomApartment: (w: number, d: number, animatedObjects: { fans: THREE.Group[], screens: THREE.Mesh[] } = {fans:[], screens:[]}): { furniture: THREE.Group, inhabitants: THREE.Group[] } => {
         const furniture = new THREE.Group();
         const inhabitants: THREE.Group[] = [];
         RoomAssembler.fillRoom(furniture, 'bedroom', w, d, inhabitants, animatedObjects);
         return { furniture, inhabitants };
    },
    createStudioApartment: (w: number, d: number, animatedObjects: { fans: THREE.Group[], screens: THREE.Mesh[] } = {fans:[], screens:[]}): { furniture: THREE.Group, inhabitants: THREE.Group[] } => {
         const furniture = new THREE.Group();
         const inhabitants: THREE.Group[] = [];
         RoomAssembler.fillRoom(furniture, 'living', w, d, inhabitants, animatedObjects);
         const k = Furniture.createDetailedKitchen(); k.position.set(w/3, 0, d/3); k.rotation.y = Math.PI; furniture.add(k);
         return { furniture, inhabitants };
    },
    createParkBlock: (): { group: THREE.Group, inhabitants: THREE.Group[], droplets: THREE.Object3D[], benchData: InstanceData[] } => {
        const group = new THREE.Group();
        const inhabitants: THREE.Group[] = [];
        const benchData: InstanceData[] = [];
        const floor = createWireframeObject(14, 0.1, 14, 0x004400, 0.3); floor.position.y = 0.05; group.add(floor);
        const fountainData = Props.createFountain(); fountainData.group.position.set(0, 0.7, 0); group.add(fountainData.group);
        const sc = Props.createSculpture(); sc.position.set(-5, 1.2, -5); group.add(sc);
        const benches = [{ x: 4, z: 4, r: -Math.PI/4 }, { x: -4, z: 2, r: Math.PI/3 }, { x: 0, z: 6, r: 0 }, { x: 6, z: -2, r: Math.PI/2 }];
        benches.forEach(b => {
            const dummy = new THREE.Object3D(); dummy.position.set(b.x, 0.7, b.z); dummy.rotation.y = b.r; dummy.updateMatrix(); benchData.push({ mat: dummy.matrix.clone() });
            if (Math.random() > 0.6) { const sitter = Life.createInhabitant(InhabitantState.SITTING); sitter.position.set(b.x, 0.22, b.z); sitter.rotation.y = b.r + Math.PI; group.add(sitter); inhabitants.push(sitter); }
        });
        return { group, inhabitants, droplets: fountainData.droplets, benchData };
    },
    
    // NEW FUNCTION for procedural expansion (AI Architect)
    createProceduralBuilding: (width: number, depth: number, floors: number, style: string, wallColor: number): { group: THREE.Group, animatedObjects: { fans: THREE.Group[], screens: THREE.Mesh[] }, inhabitants: THREE.Group[] } => {
        const group = new THREE.Group();
        const animatedObjects = { fans: [] as THREE.Group[], screens: [] as THREE.Mesh[] };
        const inhabitants: THREE.Group[] = [];
        
        const floorHeight = 3.5;
        
        // Ground Floor
        const gfGroup = new THREE.Group();
        gfGroup.position.y = 0;
        const gfBox = createWireframeObject(width, floorHeight, depth, 0x333333, 0.3);
        gfBox.position.y = floorHeight/2;
        gfGroup.add(gfBox);
        
        const gfLayout = Layouts.createGroundFloorLayout('lobby', width-1, depth-1, animatedObjects);
        gfLayout.furniture.position.y = 0.1;
        gfGroup.add(gfLayout.furniture);
        gfLayout.inhabitants.forEach(i => { i.position.y += 0.1; gfGroup.add(i); inhabitants.push(i); });
        group.add(gfGroup);
        
        // Upper Floors
        for(let i=1; i<floors; i++) {
            const fGroup = new THREE.Group();
            fGroup.position.y = i * floorHeight;
            const fBox = createWireframeObject(width, floorHeight, depth, wallColor, 0.2);
            fBox.position.y = floorHeight/2;
            addWindows(fBox, width, depth, floorHeight);
            fGroup.add(fBox);
            
            // Floor Plate
            const plate = createWireframeObject(width, 0.2, depth, wallColor, 0.5);
            plate.position.y = 0;
            fGroup.add(plate);
            
            // Style Variations
            if (style === 'cyberpunk') {
                if (Math.random() > 0.5) {
                    const neon = createSolidObject(width + 0.2, 0.1, depth + 0.2, getMaterial(0xff00ff, false), 'box');
                    neon.position.y = floorHeight;
                    fGroup.add(neon);
                }
            }
            
            // Interior
            if (Math.random() > 0.3) {
                 const layout = Layouts.createApartment2Bed(width-1, depth-1, animatedObjects);
                 layout.furniture.position.y = 0.1;
                 fGroup.add(layout.furniture);
                 layout.inhabitants.forEach(inh => { inh.position.y += 0.1; fGroup.add(inh); inhabitants.push(inh); });
            }
            
            group.add(fGroup);
        }
        
        // Roof
        const roofGroup = new THREE.Group();
        roofGroup.position.y = floors * floorHeight;
        const roofPlate = createWireframeObject(width, 0.5, depth, 0x222222, 0.8);
        roofPlate.position.y = 0.25;
        roofGroup.add(roofPlate);
        const detail = Architecture.createRooftopDetail(width, depth, 'box');
        detail.position.y = 0.5;
        roofGroup.add(detail);
        group.add(roofGroup);

        return { group, animatedObjects, inhabitants };
    }
};


