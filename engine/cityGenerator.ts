/**
 * City generator: builds the voxel city (roads, buildings, vehicles, inhabitants, props)
 * for a given architectural style. `cleanScene` resets the scene between regenerations.
 */
import * as THREE from 'three';
import type { MutableRefObject } from 'react';
import { CITY_THEME } from './theme';
import { CityAssets, sharedMaterials, getMaterial, getCachedGeometry, LineMerger, MeshMerger, InhabitantState, InstanceData } from './assets';
import type { AnimState, FxRefs } from './context';
import { resetZoning, addRoad, addRoadAxis, addRoadRing, occupy, addPlot, setCityRadius } from './world/zoning';
import { attachLod } from './world/lod';

export interface CityGenCtx {
  cityGroup: THREE.Group;
  architecturalStyle: string;
  animRef: MutableRefObject<AnimState>;
  fxRefs: MutableRefObject<FxRefs>;
}

function cleanScene(group: THREE.Group, animRef: MutableRefObject<AnimState>, fxRefs: MutableRefObject<FxRefs>): void {
    // Optimized cleanup to prevent memory leaks during city regeneration
    while(group.children.length > 0) {
        const obj = group.children[0];
        if (obj.userData.isPersistent) {
            // If persistent, we move it to a safe holding group if it's not already
            // But for now, we assume persistent items are managed separately
            // Actually, let's just detach it
            group.remove(obj);
            continue;
        }
        
        // Recursive dispose for Geometries only
        // Materials are shared in CityAssets and should NOT be disposed
        obj.traverse((child) => {
            if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments || child instanceof THREE.Points) {
                if (child.geometry) child.geometry.dispose();
            }
        });
        group.remove(obj);
    }
    
    // Reset animation lists
    animRef.current.inhabitantsList = [];
    animRef.current.vehiclesList = [];
    animRef.current.buildingsList = [];
    animRef.current.trafficLightsList = [];
    animRef.current.fountainDropletsList = [];
    animRef.current.fanList = [];
    animRef.current.screenList = [];
    animRef.current.airTrafficList = [];
    animRef.current.pois = [];
    
    // Clean special FX
    if (fxRefs.current.waterPlane) { fxRefs.current.waterPlane.geometry.dispose(); fxRefs.current.waterPlane = null; }
    // Kaiju and Aliens are managed by scene add/remove in animation loop but better to clean list here
    fxRefs.current.ufoSwarm = [];
    fxRefs.current.kaiju = null;
};


/**
 * Builds the city and (re)declares the cadastre (`engine/world/zoning`):
 * roads first, then every footprint, then the free plots. Returns the radius of
 * the urbanised area so the caller can plant the forest belt beyond it.
 */
export const generateCity = (ctx: CityGenCtx): number => {
    const { architecturalStyle } = ctx;
    const cityGroup = ctx.cityGroup;
    cleanScene(cityGroup, ctx.animRef, ctx.fxRefs);
    resetZoning(architecturalStyle);

    const treeData = { trunks: [] as InstanceData[], foliageBoxes: [] as InstanceData[], foliageIcos: [] as InstanceData[], foliageCones: [] as InstanceData[] };
    const lampData = { poles: [] as InstanceData[], fixtures: [] as InstanceData[], arms: [] as InstanceData[] };
    const propData = { benches: [] as InstanceData[], signs: [] as InstanceData[], bins: [] as InstanceData[], mailboxes: [] as InstanceData[], tlPoles: [] as InstanceData[], tlHousings: [] as InstanceData[] };
    const manholeData: InstanceData[] = [];
    const potholeData: InstanceData[] = [];
    
    const treeMergerTrunk = new LineMerger(); const treeMergerFoliage = new LineMerger(); const lampMerger = new LineMerger();
    const asphaltMerger = new MeshMerger(sharedMaterials.roadAsphalt);
    const sidewalkMerger = new MeshMerger(sharedMaterials.sidewalkConcrete);
    const markingMerger = new MeshMerger(sharedMaterials.crosswalkWhite);
    const roadBorderMerger = new LineMerger(); 
    const patchMerger = new MeshMerger(sharedMaterials.patchAsphalt);

    // Pas de « plaque » de sol ici : le sol est infini et streamé autour du
    // joueur (`engine/world/terrain.ts`). On ne voit donc jamais son bord.

    const batchTree = (x: number, z: number) => {
        const scale = 0.8 + Math.random() * 0.5; const trunkH = 1.5 * scale;
        const type = Math.random();
        const colorPalette = CITY_THEME.colors.props.treeFoliage;
        const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
        const tObj = new THREE.Object3D(); tObj.position.set(x, trunkH/2, z); tObj.scale.set(0.4*scale, trunkH, 0.4*scale); tObj.updateMatrix();
        treeData.trunks.push({ mat: tObj.matrix.clone() }); treeMergerTrunk.addBox(tObj.matrix, 1, 1, 1); 
        if (type < 0.4) {
            const layers = 2 + Math.floor(Math.random() * 3); let currentY = trunkH;
            for(let i=0; i<layers; i++) { const layerW = (layers - i + 1) * 0.4 * scale; const layerH = 0.8 * scale; const fObj = new THREE.Object3D(); fObj.position.set(x, currentY + layerH/2, z); fObj.scale.set(layerW, layerH, layerW); fObj.updateMatrix(); treeData.foliageBoxes.push({ mat: fObj.matrix.clone(), color }); treeMergerFoliage.addBox(fObj.matrix, 1, 1, 1); currentY += layerH * 0.8; }
        } else if (type < 0.7) {
            const fObj = new THREE.Object3D(); const size = (1.5 + Math.random()) * scale; fObj.position.set(x, trunkH + size/2 - 0.5, z); fObj.scale.set(size, size, size); fObj.updateMatrix(); treeData.foliageIcos.push({ mat: fObj.matrix.clone(), color });
        } else {
            const layers = 3; let currentY = trunkH - 0.5;
            for(let i=0; i<layers; i++) { const layerW = (layers - i + 1) * 0.6 * scale; const layerH = 1.2 * scale; const fObj = new THREE.Object3D(); fObj.position.set(x, currentY + layerH/2, z); fObj.scale.set(layerW, layerH, layerW); fObj.updateMatrix(); treeData.foliageCones.push({ mat: fObj.matrix.clone(), color }); currentY += layerH * 0.7; }
        }
    };

    const batchStreetLamp = (x: number, z: number, r: number) => {
         const pObj = new THREE.Object3D(); pObj.position.set(x, 2, z); pObj.scale.set(0.15, 4, 0.15); pObj.updateMatrix(); lampData.poles.push({ mat: pObj.matrix.clone() }); lampMerger.addBox(pObj.matrix, 1, 1, 1);
         const aObj = new THREE.Object3D(); aObj.position.set(x, 3.8, z); aObj.rotation.y = r; aObj.translateX(0.5); aObj.scale.set(1.2, 0.1, 0.1); aObj.updateMatrix(); lampData.arms.push({ mat: aObj.matrix.clone() }); lampMerger.addBox(aObj.matrix, 1, 1, 1);
         const fObj = new THREE.Object3D(); fObj.position.set(x, 3.7, z); fObj.rotation.y = r; fObj.translateX(1.0); fObj.scale.set(0.3, 0.1, 0.3); fObj.updateMatrix(); lampData.fixtures.push({ mat: fObj.matrix.clone() });
    };

    // Simplified calls for brevity in update, reusing core logic from previous version
    const createModernVilla = (x: number, z: number, rotation: number, isRadial: boolean = false) => {
        // Logic mostly identical to original file, ensuring we push to ctx.animRef lists
        const group = new THREE.Group(); group.position.set(x, 0, z); group.rotation.y = rotation;
        const wallColors = CITY_THEME.colors.buildings.modernWalls; const accentColors = CITY_THEME.colors.buildings.modernAccents; const roofColors = CITY_THEME.colors.buildings.modernRoofs;
        const mainColor = wallColors[Math.floor(Math.random() * wallColors.length)]; const accentColor = accentColors[Math.floor(Math.random() * accentColors.length)]; const roofColor = roofColors[Math.floor(Math.random() * roofColors.length)]; const trimColor = Math.random() > 0.5 ? 0xffffff : 0xccffff;
        
        const styles = ['stack', 'gallery', 'patio', 'frame', 'cantilever']; const style = styles[Math.floor(Math.random() * styles.length)];
        const addTechTrim = (parent: THREE.Group, w: number, h: number, d: number, yPos: number = 0) => { const trim = CityAssets.primitives.createSolidObject(w + 0.05, 0.05, d + 0.05, getMaterial(trimColor, false), 'box'); trim.position.set(0, yPos, 0); parent.add(trim); };
        const addRoof = (parent: THREE.Group, w: number, d: number, yPos: number) => { const roof = CityAssets.primitives.createWireframeObject(w, 0.4, d, roofColor, 0.9, 'box'); roof.position.set(0, yPos + 0.2, 0); addTechTrim(roof, w, 0.4, d, 0); parent.add(roof); };
        const addRoofTerrace = (parent: THREE.Group, w: number, d: number, yBase: number) => {
            const deckY = yBase + 0.45; const deck = CityAssets.Props.createDeck(w - 1.2, d - 1.2); deck.position.set(0, deckY, 0); parent.add(deck);
            const railH = 0.9; const inset = 0.4; const glassMat = CITY_THEME.colors.buildings.glass;
            const rFront = CityAssets.primitives.createWireframeObject(w-inset*2, railH, 0.05, glassMat, 0.3); rFront.position.set(0, deckY + railH/2, d/2 - inset);
            const rBack = CityAssets.primitives.createWireframeObject(w-inset*2, railH, 0.05, glassMat, 0.3); rBack.position.set(0, deckY + railH/2, -d/2 + inset);
            const rLeft = CityAssets.primitives.createWireframeObject(0.05, railH, d-inset*2, glassMat, 0.3); rLeft.position.set(-w/2 + inset, deckY + railH/2, 0);
            const rRight = CityAssets.primitives.createWireframeObject(0.05, railH, d-inset*2, glassMat, 0.3); rRight.position.set(w/2 - inset, deckY + railH/2, 0);
            parent.add(rFront, rBack, rLeft, rRight);
            if (Math.min(w, d) > 4) { const table = CityAssets.Furniture.createTableSet(); table.position.set(0, deckY, 0); parent.add(table); } else { const chair = CityAssets.Furniture.createChair(); chair.position.set(0, deckY, 0); chair.rotation.y = Math.random() * 6; parent.add(chair); }
            const plant = CityAssets.Props.createPlant(0.8); plant.position.set(w/2 - 1.2, deckY, d/2 - 1.2); parent.add(plant);
            const light = new THREE.PointLight(trimColor, 0.5, 4); light.position.set(0, deckY + 1.5, 0); parent.add(light);
            if (Math.random() > 0.6) { const p = CityAssets.Life.createInhabitant(InhabitantState.IDLE); p.position.set(-1, deckY + 0.2, 0); p.rotation.y = Math.PI / 2; parent.add(p); ctx.animRef.current.inhabitantsList.push(p); }
        };

        const animatedObjects = { fans: [] as THREE.Group[], screens: [] as THREE.Mesh[] };
        let gfW = 10, gfD = 10, gfH = 3.5; let sfW = 10, sfD = 8, sfH = 3.5; const wallOpacity = 0.6;
        
        if (style === 'stack') {
            const gf = CityAssets.primitives.createWireframeObject(8, gfH, 10, mainColor, wallOpacity, 'box'); gf.position.set(0, gfH/2, 0); group.add(gf);
            const stairs = CityAssets.Architecture.createStairs(); stairs.position.set(-2, 0, 2); gf.add(stairs);
            const sf = CityAssets.primitives.createWireframeObject(10, sfH, 8, accentColor, wallOpacity, 'box'); sf.position.set(1.5, gfH + sfH/2, 0); group.add(sf);
            const balc = CityAssets.Architecture.createBalcony(4, 'glass'); balc.position.set(-3, -sfH/2 + 0.5, 4); sf.add(balc);
            const extStairs = CityAssets.Architecture.createStraightStairs(gfH, 1.5, 4); extStairs.position.set(-1.5, 0, 5); group.add(extStairs);
            const tf = CityAssets.primitives.createWireframeObject(5, sfH, 5, mainColor, wallOpacity, 'box'); tf.position.set(-1, gfH + sfH + sfH/2, 1); group.add(tf);
            addRoof(group, 8, 10, gfH); addRoof(sf, 10, 8, sfH/2); addRoof(tf, 5, 5, sfH/2); addRoofTerrace(sf, 5, 8, sfH/2);
            const layout = CityAssets.Layouts.createApartment2Bed(7, 9, animatedObjects); layout.furniture.position.set(0, -gfH/2 + 0.1, 0); gf.add(layout.furniture);
            layout.inhabitants.forEach(i => { i.position.y += 0.1; ctx.animRef.current.inhabitantsList.push(i); group.add(i); });
        } else if (style === 'gallery') {
            const blockLeft = CityAssets.primitives.createWireframeObject(5, gfH, 8, accentColor, wallOpacity, 'box'); blockLeft.position.set(-5, gfH/2, 0); addRoof(blockLeft, 5, 8, gfH/2); addRoofTerrace(blockLeft, 5, 8, gfH/2);
            const blockRight = CityAssets.primitives.createWireframeObject(5, gfH, 8, accentColor, wallOpacity, 'box'); blockRight.position.set(5, gfH/2, 0); addRoof(blockRight, 5, 8, gfH/2);
            const gallery = CityAssets.primitives.createWireframeObject(6, gfH-0.5, 4, CITY_THEME.colors.buildings.glass, 0.3, 'box'); gallery.position.set(0, gfH/2 - 0.25, 0);
            group.add(blockLeft, blockRight, gallery);
            const stairs = CityAssets.Architecture.createStraightStairs(gfH, 1.2, 3); stairs.position.set(0, -gfH/2, 0); stairs.rotation.y = Math.PI/2; blockRight.add(stairs);
            const layout = CityAssets.Layouts.createStudioApartment(4, 7, animatedObjects); layout.furniture.position.set(0, -gfH/2 + 0.1, 0); blockLeft.add(layout.furniture);
            layout.inhabitants.forEach(i => { i.position.x -= 5; i.position.y += 0.1; ctx.animRef.current.inhabitantsList.push(i); group.add(i); });
        } else if (style === 'patio') {
            const centerW = 12, centerD = 4; const wingW = 4, wingD = 8;
            const center = CityAssets.primitives.createWireframeObject(centerW, gfH, centerD, mainColor, wallOpacity, 'box'); center.position.set(0, gfH/2, -wingD/2 + centerD/2); addRoof(center, centerW, centerD, gfH/2);
            const leftWing = CityAssets.primitives.createWireframeObject(wingW, gfH, wingD, mainColor, wallOpacity, 'box'); leftWing.position.set(-centerW/2 + wingW/2, gfH/2, 0); addRoof(leftWing, wingW, wingD, gfH/2); addRoofTerrace(leftWing, wingW, wingD, gfH/2);
            const rightWing = CityAssets.primitives.createWireframeObject(wingW, gfH, wingD, mainColor, wallOpacity, 'box'); rightWing.position.set(centerW/2 - wingW/2, gfH/2, 0); addRoof(rightWing, wingW, wingD, gfH/2);
            const deck = CityAssets.Props.createDeck(centerW - 2, wingD - 2); deck.position.set(0, 0, 0); group.add(deck); group.add(center, leftWing, rightWing);
            const patioTree = CityAssets.Props.createPlant(1.5); patioTree.position.set(0, 0, 0); group.add(patioTree);
            const layout = CityAssets.Layouts.createGroundFloorLayout('lobby', centerW-1, centerD-1, animatedObjects); layout.furniture.position.set(0, -gfH/2+0.1, 0); center.add(layout.furniture);
        } else if (style === 'frame') {
            const glassBox = CityAssets.primitives.createWireframeObject(gfW, gfH*2, gfD-2, CITY_THEME.colors.buildings.glass, 0.2, 'box'); glassBox.position.set(0, gfH, 0); group.add(glassBox);
            const stairs = CityAssets.Architecture.createStraightStairs(gfH, 1.5, 3.5); stairs.position.set(3, -gfH, -2); glassBox.add(stairs);
            const balc = CityAssets.Architecture.createBalcony(gfW - 2, 'glass'); balc.position.set(0, 0, gfD/2 - 1); glassBox.add(balc);
            const frameTop = CityAssets.primitives.createWireframeObject(gfW+2, 0.8, gfD, accentColor, 0.9, 'box'); frameTop.position.set(0, gfH*2 + 0.4, 0); addRoofTerrace(frameTop, gfW, gfD, 0.4);
            const frameBot = CityAssets.primitives.createWireframeObject(gfW+2, 0.8, gfD, accentColor, 0.9, 'box'); frameBot.position.set(0, 0.4, 0);
            const frameLeft = CityAssets.primitives.createWireframeObject(1.5, gfH*2, gfD, accentColor, 0.9, 'box'); frameLeft.position.set(-(gfW/2 + 0.75), gfH, 0);
            const frameRight = CityAssets.primitives.createWireframeObject(1.5, gfH*2, gfD, accentColor, 0.9, 'box'); frameRight.position.set((gfW/2 + 0.75), gfH, 0);
            group.add(frameTop, frameBot, frameLeft, frameRight);
            const shutterColor = 0x222222; const shutterL = CityAssets.primitives.createWireframeObject(2, gfH * 1.5, 0.1, shutterColor, 0.5, 'box'); shutterL.position.set(-gfW/4, gfH, gfD/2 - 0.9); group.add(shutterL);
            const layout = CityAssets.Layouts.createApartment2Bed(gfW-1, gfD-3, animatedObjects); layout.furniture.position.set(0, 0.1, 0); glassBox.add(layout.furniture);
            layout.inhabitants.forEach(i => { i.position.add(new THREE.Vector3(0,0.1,0)); glassBox.add(i); ctx.animRef.current.inhabitantsList.push(i); });
        } else {
            const base = CityAssets.primitives.createWireframeObject(6, gfH, 8, accentColor, wallOpacity, 'box'); base.position.set(2, gfH/2, 2); addRoof(base, 6, 8, gfH/2);
            const stairs = CityAssets.Architecture.createStairs(); stairs.position.set(0, -gfH/2, 0); base.add(stairs); group.add(base);
            const top = CityAssets.primitives.createWireframeObject(10, sfH, 10, mainColor, wallOpacity, 'box'); top.position.set(-1, gfH + sfH/2, -1); addRoof(top, 10, 10, sfH/2); addRoofTerrace(top, 10, 10, sfH/2);
            const balc = CityAssets.Architecture.createBalcony(10, 'glass'); balc.position.set(0, -sfH/2 + 0.5, 5); top.add(balc); group.add(top);
            const col = CityAssets.primitives.createWireframeObject(0.6, gfH, 0.6, 0x111111, 0.8, 'cylinder'); col.position.set(-4, gfH/2, -4); group.add(col);
            const layout = CityAssets.Layouts.createApartment2Bed(5, 7, animatedObjects); layout.furniture.position.set(0, -gfH/2 + 0.1, 0); base.add(layout.furniture);
            layout.inhabitants.forEach(i => { i.position.x += 2; i.position.z += 2; i.position.y += 0.1; ctx.animRef.current.inhabitantsList.push(i); group.add(i); });
        }
        animatedObjects.fans.forEach(f => ctx.animRef.current.fanList.push(f));
        animatedObjects.screens.forEach(s => ctx.animRef.current.screenList.push(s));
        
        const pool = CityAssets.Props.createSwimmingPool(7, 4); pool.position.set(0, 0, -12); group.add(pool);
        const poolDeck = CityAssets.Props.createDeck(8.4, 5.4); poolDeck.position.set(0, 0, -12); group.add(poolDeck);
        if (style === 'frame' || style === 'stack') { const refPool = CityAssets.Props.createReflectingPool(5, 3); refPool.position.set(-4, 0, 7); group.add(refPool); }
        const dwLen = 14; 
        for(let k=0; k<6; k++) { const strip = CityAssets.primitives.createSolidObject(3.5, 0.05, 1.5, sharedMaterials.sidewalkConcrete, 'box'); strip.position.set(4, 0.05, 5 + k*2); group.add(strip); }
        const pathX = -2; for(let k=0; k<8; k++) { const stone = CityAssets.primitives.createSolidObject(1.2, 0.05, 0.8, sharedMaterials.sidewalkConcrete, 'box'); stone.position.set(pathX + (Math.random()-0.5)*0.2, 0.06, 5 + k*1.8); stone.rotation.y = (Math.random()-0.5)*0.1; group.add(stone); }
        const doorLight = new THREE.PointLight(trimColor, 1, 5); doorLight.position.set(4, 2.5, 5); group.add(doorLight);
        const bedL = CityAssets.Props.createFlowerBed(2.5, 6); bedL.position.set(-5, 0, 10); group.add(bedL);
        
        const carType = Math.random() > 0.5 ? 'car' : (Math.random() > 0.5 ? 'taxi' : 'truck');
        const car = CityAssets.Life.createVehicle(carType); car.position.set(4, 0.1, 5 + dwLen/2 - 2); car.rotation.y = Math.PI; group.add(car);
        car.userData.type = 'vehicle'; // Add type metadata for interactions
        ctx.animRef.current.vehiclesList.push(car);

        const resident = CityAssets.Life.createInhabitant(InhabitantState.WALKING);
        const localDoorPos = new THREE.Vector3(0, 0.2, 5); const localStreetPos = new THREE.Vector3(0, 0.2, 5 + dwLen + 2);
        resident.userData.isResident = true; resident.userData.homeState = 'GOING_HOME'; resident.userData.doorPosLocal = localDoorPos.clone(); resident.userData.streetPosLocal = localStreetPos.clone(); resident.userData.houseRotation = rotation;
        resident.position.copy(localStreetPos); resident.rotation.y = Math.PI; group.add(resident); ctx.animRef.current.inhabitantsList.push(resident);
        
        const separatorCount = 4;
        for (let i = 0; i < separatorCount; i++) {
           const t = i / (separatorCount - 1); const zPos = 10 - t * 24; 
           let halfWidth = 14; if (isRadial) { const widthFront = 6; const widthBack = 17; halfWidth = widthFront + t * (widthBack - widthFront); }
           let scale = 0.8 + Math.random() * 0.4; if (Math.random() < 0.05) scale = 2.5 + Math.random() * 1.5;
           const treeL = CityAssets.Props.createHolographicTree(scale, CITY_THEME.colors.props.greenFoliage); treeL.position.set(-halfWidth, 0, zPos); treeL.rotation.y = Math.random() * Math.PI; group.add(treeL);
           const treeR = CityAssets.Props.createHolographicTree(scale, CITY_THEME.colors.props.greenFoliage); treeR.position.set(halfWidth, 0, zPos); treeR.rotation.y = Math.random() * Math.PI; group.add(treeR);
        }
        
        // `footprint` = la MAISON (≈14 m), pas la parcelle : sinon la silhouette
        // lointaine engloberait le jardin, l'allée et la voiture, et l'on verrait
        // un grand bloc posé là où il n'y a qu'un pavillon.
        group.userData = { isBuilding: true, expanded: false, footprint: 14 }; // Mark for interaction
        occupy(x, z, 15); // cadastre: villa + jardin + allée (rien ne peut être bâti dessus)
        cityGroup.add(group); ctx.animRef.current.buildingsList.push(group);
    };
    
    // --- SPAWN AIR TRAFFIC ---
    const spawnAircraft = () => {
        // 1. Helicopters (High altitude, circling)
        // INCREASED ALTITUDE to avoid skyscrapers
        for (let i = 0; i < 3; i++) {
            const heli = CityAssets.Life.createHelicopter();
            heli.position.set(0, 80 + Math.random() * 20, 0); // 80-100 height
            heli.userData.type = 'helicopter'; // Metadata
            cityGroup.add(heli);
            ctx.animRef.current.airTrafficList.push(heli);
        }
        
        // 2. Drones (Low altitude, patrolling)
        for (let i = 0; i < 8; i++) {
            const drone = CityAssets.Life.createDrone();
            drone.position.set((Math.random()-0.5)*100, 15 + Math.random() * 10, (Math.random()-0.5)*100);
            drone.userData.type = 'drone'; // Metadata
            cityGroup.add(drone);
            ctx.animRef.current.airTrafficList.push(drone);
        }
    };
    spawnAircraft();

    // Main Generation Switch
    let baseRadius = 90;
    if (architecturalStyle === 'residential') {
        const STEM_LENGTH = 160; const STEM_Z_START = 160; const STEM_Z_END = 15; const LOOP_RADIUS = 22; const ROAD_WIDTH = 10;
        // --- CADASTRE : les routes d'abord, avant toute construction
        addRoadAxis('z', 0, STEM_Z_END - 5, STEM_Z_START, ROAD_WIDTH);
        addRoadRing(0, 0, LOOP_RADIUS, ROAD_WIDTH, 32);
        occupy(0, 0, 15); // le parc central
        const stemM = new THREE.Matrix4(); stemM.setPosition(0, 0.02, (STEM_Z_START + STEM_Z_END) / 2); asphaltMerger.addBox(stemM, ROAD_WIDTH, 0.05, STEM_Z_START - STEM_Z_END);
        const dashLen = 2, gapLen = 2; const stemDist = STEM_Z_START - STEM_Z_END; const numDashes = Math.floor(stemDist / (dashLen + gapLen));
        for(let k=0; k<numDashes; k++) { const pz = STEM_Z_END + k*(dashLen+gapLen) + dashLen; const m = new THREE.Matrix4(); m.setPosition(0, 0.03, pz); markingMerger.addBox(m, 0.2, 0.05, dashLen); }
        // (plus de voitures « sur rail » ici : toute la circulation passe par
        //  `agents/traffic.ts`, qui roule sur le vrai réseau et où chacun voit
        //  les autres. Deux systèmes aveugles l'un à l'autre, c'était la
        //  garantie de voir des voitures se traverser.)
        const segments = 48;
        for (let i = 0; i < segments; i++) {
            const theta1 = (i / segments) * Math.PI * 2; const theta2 = ((i + 1) / segments) * Math.PI * 2;
            const p1x = Math.sin(theta1) * LOOP_RADIUS; const p1z = Math.cos(theta1) * LOOP_RADIUS; const p2x = Math.sin(theta2) * LOOP_RADIUS; const p2z = Math.cos(theta2) * LOOP_RADIUS;
            const midX = (p1x + p2x) / 2; const midZ = (p1z + p2z) / 2; const angle = Math.atan2(p2x - p1x, p2z - p1z); const len = Math.sqrt(Math.pow(p2x - p1x, 2) + Math.pow(p2z - p1z, 2)) + 0.5;
            const roadSeg = new THREE.Matrix4(); roadSeg.makeRotationY(angle); roadSeg.setPosition(midX, 0.02, midZ); asphaltMerger.addBox(roadSeg, ROAD_WIDTH, 0.05, len);
        }
        const stemPlotSteps = 7; const startPlotZ = STEM_Z_END + 15; const plotGap = 22;
        for (let i = 0; i < stemPlotSteps; i++) { const z = startPlotZ + i * plotGap; if (z > STEM_Z_START - 10) break; createModernVilla(-32, z, -Math.PI / 2, false); createModernVilla(32, z, Math.PI / 2, false); batchStreetLamp(-7, z - 10, 0); batchStreetLamp(7, z - 10, Math.PI); }
        const loopHouseCount = 8;
        // r = 46 : l'allée d'entrée (14 m) + le trottoir viennent affleurer le
        // bord extérieur de la boucle sans jamais mordre dessus. À r = 38, les
        // allées, les terrasses et les rangées d'arbres débordaient EN PLEIN
        // MILIEU du rond — c'est ce désordre-là qu'on supprime.
        for (let i = 0; i < loopHouseCount; i++) { const angle = (i / loopHouseCount) * Math.PI * 2; if (Math.abs(angle) < 0.4 || Math.abs(angle - Math.PI*2) < 0.4) continue; const r = 48; const x = Math.sin(angle) * r; const z = Math.cos(angle) * r; createModernVilla(x, z, angle + Math.PI, true); const lr = LOOP_RADIUS + 7; batchStreetLamp(Math.sin(angle)*lr, Math.cos(angle)*lr, angle + Math.PI); }
        const park = CityAssets.Layouts.createParkBlock(); park.group.position.set(0, 0, 0); park.group.scale.set(1.5, 1, 1.5); cityGroup.add(park.group);
        ctx.animRef.current.pois.push(new THREE.Vector3(0, 1, 0)); // PARK POI
        const statue = CityAssets.Props.createHoloStatue(); statue.position.set(0, 0.1, 0); cityGroup.add(statue);
        park.inhabitants.forEach(i => { i.position.multiplyScalar(1.5); cityGroup.add(i); ctx.animRef.current.inhabitantsList.push(i) });
        park.droplets.forEach(d => ctx.animRef.current.fountainDropletsList.push(d));
        park.benchData.forEach(bd => { const m = bd.mat.clone(); const pos = new THREE.Vector3(); const rot = new THREE.Quaternion(); const scl = new THREE.Vector3(); m.decompose(pos, rot, scl); pos.multiplyScalar(1.5); m.compose(pos, rot, scl); propData.benches.push({mat: m}); });

        // --- PARCELLES : balayage régulier, on ne garde que ce qui est légal
        for (let px = -66; px <= 66; px += 22) {
            for (let pz = -44; pz <= 156; pz += 22) {
                addPlot(px, pz, 14, 'Quartier résidentiel');
            }
        }
        baseRadius = 175;

    } else if (architecturalStyle === 'region') {
        // === REGION: several towns on one map, connected by a road network ===
        const towns = [ { x: 0, z: 0 }, { x: 95, z: 25 }, { x: -82, z: 72 } ];
        const roadW = 9;
        const drawRoad = (a: { x: number; z: number }, b: { x: number; z: number }) => {
            const dx = b.x - a.x, dz = b.z - a.z; const len = Math.hypot(dx, dz); const ang = Math.atan2(dx, dz);
            const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
            const m = new THREE.Matrix4(); m.makeRotationY(ang); m.setPosition(mx, 0.02, mz);
            asphaltMerger.addBox(m, roadW, 0.05, len);
            const dashLen = 2, gapLen = 2, n = Math.floor(len / (dashLen + gapLen));
            for (let k = 0; k < n; k++) {
                const t = -len / 2 + (dashLen + gapLen) / 2 + k * (dashLen + gapLen);
                const dm = new THREE.Matrix4(); dm.makeRotationY(ang); dm.setPosition(mx + Math.sin(ang) * t, 0.03, mz + Math.cos(ang) * t);
                markingMerger.addBox(dm, 0.2, 0.05, dashLen);
            }
        };
        // road network connecting every pair of towns (cadastre first)
        for (const [a, b] of [[0, 1], [0, 2], [1, 2]] as const) {
            addRoad(towns[a].x, towns[a].z, towns[b].x, towns[b].z, roadW);
        }
        drawRoad(towns[0], towns[1]); drawRoad(towns[0], towns[2]); drawRoad(towns[1], towns[2]);
        const wallColors = CITY_THEME.colors.buildings.walls;
        const styles = ['modern', 'cyberpunk', 'brutalist'] as const;
        towns.forEach((t, ti) => {
            // central plaza
            occupy(t.x, t.z, 18);
            const pm = new THREE.Matrix4(); pm.setPosition(t.x, 0.04, t.z); sidewalkMerger.addBox(pm, 32, 0.05, 32);
            // 4 procedural buildings around the plaza (with lit windows)
            for (let i = 0; i < 4; i++) {
                const ang = i * Math.PI / 2 + ti * 0.3;
                const bx = t.x + Math.cos(ang) * 26, bz = t.z + Math.sin(ang) * 26;
                const floors = 2 + Math.floor(Math.random() * 4);
                const wc = wallColors[Math.floor(Math.random() * wallColors.length)];
                const bd = CityAssets.Layouts.createProceduralBuilding(11, 11, floors, styles[Math.floor(Math.random() * 3)], wc);
                bd.group.position.set(bx, 0, bz); bd.group.rotation.y = ang + Math.PI;
                occupy(bx, bz, 9);
                bd.group.userData = { isBuilding: true, expanded: false, footprint: 12 };
                cityGroup.add(bd.group); ctx.animRef.current.buildingsList.push(bd.group);
                bd.animatedObjects.fans.forEach((f: any) => ctx.animRef.current.fanList.push(f));
                bd.animatedObjects.screens.forEach((s: any) => ctx.animRef.current.screenList.push(s));
                bd.inhabitants.forEach((inh: any) => ctx.animRef.current.inhabitantsList.push(inh));
                // a tree beside each building
                const tree = CityAssets.Props.createHolographicTree(1 + Math.random(), CITY_THEME.colors.props.greenFoliage);
                tree.position.set(bx + 9, 0, bz + 9); cityGroup.add(tree);
            }
            ctx.animRef.current.pois.push(new THREE.Vector3(t.x, 1, t.z));
        });
        // parcelles : une couronne autour de chaque bourg
        towns.forEach((t) => {
            for (let i = 0; i < 10; i++) {
                const a = (i / 10) * Math.PI * 2;
                addPlot(t.x + Math.cos(a) * 46, t.z + Math.sin(a) * 46, 14, 'Bourg');
            }
        });
        baseRadius = 190;
    } else {
        const batchTrafficLightStructure = (x: number, z: number, axis: 'x' | 'z') => {
            const pObj = new THREE.Object3D(); pObj.position.set(x, 2.25, z); pObj.scale.set(0.2, 4.5, 0.2); pObj.updateMatrix(); propData.tlPoles.push({ mat: pObj.matrix.clone() });
            const aObj = new THREE.Object3D(); aObj.position.set(x, 4.2, z); if(axis==='x') aObj.rotation.y = Math.PI/2; aObj.translateX(axis==='z'?1:1); aObj.translateZ(axis==='x'?0:0); if(axis==='z') aObj.position.x += 1; else aObj.position.z += 1; aObj.scale.set(2.5, 0.2, 0.2); aObj.updateMatrix(); propData.tlPoles.push({ mat: aObj.matrix.clone() });
            const hObj = new THREE.Object3D(); hObj.position.set(x, 4.0, z); if(axis==='x') hObj.rotation.y = Math.PI/2; if(axis==='z') hObj.position.x += 2; else hObj.position.z += 2; hObj.scale.set(0.6, 1.5, 0.5); hObj.updateMatrix(); propData.tlHousings.push({ mat: hObj.matrix.clone() }); return { housingPos: hObj.position.clone(), housingRot: hObj.rotation.y };
       };
       const scatterRoadDetails = (axis: 'x' | 'z', constantCoord: number, start: number, end: number) => {
           const length = end - start; const count = Math.floor(length / 5); 
           for(let k=0; k<count; k++) {
               const pos = start + Math.random() * length; const type = Math.random(); const laneOffset = (Math.random() - 0.5) * 6; 
               let x, z; if (axis === 'z') { x = constantCoord + laneOffset; z = pos; } else { x = pos; z = constantCoord + laneOffset; }
               if (type < 0.1) { const m = new THREE.Matrix4(); m.makeTranslation(x, 0.055, z); manholeData.push({ mat: m }); } 
               else if (type < 0.25) { const m = new THREE.Matrix4(); m.makeRotationY(Math.random() * Math.PI); m.setPosition(x, 0.052, z); const scale = 0.5 + Math.random() * 0.5; m.scale(new THREE.Vector3(scale, 1, scale)); potholeData.push({ mat: m }); } 
               else if (type < 0.45) { const m = new THREE.Matrix4(); m.makeRotationY(Math.random() * 0.2); m.setPosition(x, 0.051, z); const w = 1 + Math.random(); const d = 1 + Math.random(); patchMerger.addBox(m, w, 0.01, d); }
           }
       };
       const GRID_RADIUS = 2; const blockSize = 16; const gap = 10; const fullStep = blockSize + gap;
       // --- CADASTRE : toutes les avenues de la grille, déclarées avant de bâtir
       {
           const mapSize = (GRID_RADIUS * 2 + 2) * fullStep;
           for (let i = -GRID_RADIUS; i <= GRID_RADIUS + 1; i++) {
               const offset = (i - 0.5) * fullStep;
               addRoadAxis('z', offset, -mapSize / 2, mapSize / 2, gap);
               addRoadAxis('x', offset, -mapSize / 2, mapSize / 2, gap);
           }
       }
       for (let x = -GRID_RADIUS; x <= GRID_RADIUS; x++) {
           for (let z = -GRID_RADIUS; z <= GRID_RADIUS; z++) {
               const bx = x * fullStep; const bz = z * fullStep; const distFromCenter = Math.max(Math.abs(x), Math.abs(z));
               occupy(bx, bz, blockSize / 2 + 1); // îlot entier réservé (bâtiment + trottoir)
               if (x === 0 && z === 0) {
                   const park = CityAssets.Layouts.createParkBlock(); park.group.position.set(bx, 0, bz); cityGroup.add(park.group);
                   ctx.animRef.current.pois.push(new THREE.Vector3(bx, 1, bz)); // PARK POI
                   park.benchData.forEach(bd => { const m = bd.mat.clone(); m.setPosition(m.elements[12]+bx, m.elements[13], m.elements[14]+bz); propData.benches.push({mat: m}); });
                   park.inhabitants.forEach(i => { i.position.x += bx; i.position.z += bz; cityGroup.add(i); ctx.animRef.current.inhabitantsList.push(i) });
                   park.droplets.forEach(d => ctx.animRef.current.fountainDropletsList.push(d));
                   for(let i=0; i<8; i++) { const angle = (i / 8) * Math.PI * 2; const r = 6; batchTree(bx + Math.sin(angle)*r, bz + Math.cos(angle)*r); }
                   const swM = new THREE.Matrix4(); swM.setPosition(bx, 0.1, bz); sidewalkMerger.addBox(swM, 16, 0.2, 16);
                   continue;
               }
               const building = new THREE.Group(); building.position.set(bx, 0, bz);
               const width = 12; const depth = 12; let floors = 3; 
               const wallColors = CITY_THEME.colors.buildings.walls; let wallColor = wallColors[Math.floor(Math.random() * wallColors.length)];
               let allowedStyles: string[] = [];
               switch (architecturalStyle) {
                   case 'modern': allowedStyles = ['modern', 'cantilever']; break;
                   case 'brutalist': allowedStyles = ['shift', 'modern']; break;
                   case 'art_deco': allowedStyles = ['step', 'taper']; break;
                   case 'cyberpunk': allowedStyles = ['cylinder', 'twist']; break;
                   case 'extraordinary': allowedStyles = ['extraordinary']; break;
                   default: allowedStyles = ['modern', 'modern', 'step', 'shift', 'taper', 'cantilever', 'cantilever', 'cylinder', 'twist', 'extraordinary']; break;
               }
               let archStyle = allowedStyles[Math.floor(Math.random() * allowedStyles.length)];
               if (architecturalStyle === 'mixed') { const styleIndex = Math.abs(x + z) % 3; if (styleIndex === 0) archStyle = 'cylinder'; }
               if (distFromCenter <= 1 && Math.random() < 0.5) {
                   floors = 12 + Math.floor(Math.random() * 11); 
                   if (architecturalStyle === 'mixed') { const tallStyles = ['modern', 'shift', 'twist', 'taper', 'step', 'cylinder', 'extraordinary']; archStyle = tallStyles[Math.floor(Math.random() * tallStyles.length)]; } 
                   else if (architecturalStyle === 'extraordinary') { archStyle = 'extraordinary'; }
               } else { if (distFromCenter === 1) { floors = 5 + Math.floor(Math.random() * 5); } else { floors = 3 + Math.floor(Math.random() * 4); } }
               const floorHeight = 3.5; const gfType = Math.random() > 0.6 ? 'retail' : (Math.random() > 0.5 ? 'parking' : 'lobby');
               const groundGroup = new THREE.Group(); groundGroup.position.y = 0; groundGroup.userData = { originalY: 0 };
               let gfShape: 'box' | 'cylinder' | 'icosahedron' = archStyle === 'cylinder' ? 'cylinder' : 'box';
               if (archStyle === 'extraordinary') gfShape = Math.random() > 0.5 ? 'icosahedron' : 'box';
               const groundBox = CityAssets.primitives.createWireframeObject(width, floorHeight, depth, 0x444444, 0.3, gfShape); groundBox.position.y = floorHeight / 2; groundGroup.add(groundBox);
               const animatedObjects = { fans: [] as THREE.Group[], screens: [] as THREE.Mesh[] };
               const gfLayout = CityAssets.Layouts.createGroundFloorLayout(gfType, width-1, depth-1, animatedObjects); gfLayout.furniture.position.y = 0.1; 
               let baseScaleX = 1; let baseScaleZ = 1;
               if(archStyle === 'cylinder' || (archStyle === 'extraordinary' && (gfShape === 'cylinder' || gfShape === 'icosahedron'))) { baseScaleX = 0.75; baseScaleZ = 0.75; }
               gfLayout.furniture.scale.set(baseScaleX, 1, baseScaleZ); groundGroup.add(gfLayout.furniture);
               gfLayout.inhabitants.forEach(i => { i.position.y += 0.1; i.position.x *= baseScaleX; i.position.z *= baseScaleZ; groundGroup.add(i); ctx.animRef.current.inhabitantsList.push(i); });
               building.add(groundGroup);
               for (let i = 1; i < floors; i++) {
                   const yPos = i * floorHeight; const floorGroup = new THREE.Group(); floorGroup.position.y = yPos; floorGroup.userData = { originalY: yPos };
                   let fW = width; let fD = depth; let floorScaleX = 1; let floorScaleZ = 1;
                   if (archStyle === 'extraordinary') {
                       const floorShape: 'box' | 'icosahedron' = Math.random() > 0.5 ? 'icosahedron' : 'box';
                       const wobble = Math.sin(i * 0.8) * 0.6; fW = width * (0.7 + wobble * 0.3 + Math.random() * 0.4); fD = depth * (0.7 + wobble * 0.3 + Math.random() * 0.4);
                       floorGroup.rotation.y = (Math.random() - 0.5) * 0.8; const funkyColor = wallColors[Math.floor(Math.random() * wallColors.length)];
                       const floorBox = CityAssets.primitives.createWireframeObject(fW, floorHeight, fD, funkyColor, 0.15, floorShape); floorBox.position.y = floorHeight / 2; floorGroup.add(floorBox);
                       const plate = CityAssets.primitives.createWireframeObject(fW, 0.2, fD, funkyColor, 0.5, floorShape); plate.position.y = 0; floorGroup.add(plate);
                       if (Math.random() > 0.7) { const tubeLen = width * 1.5; const tube = CityAssets.primitives.createWireframeObject(tubeLen, 1, 1, 0xffffff, 0.5, 'cylinder'); tube.rotation.z = Math.PI / 2; tube.position.set(0, floorHeight/2, 0); floorGroup.add(tube); }
                       if (floorShape === 'icosahedron') { floorScaleX = 0.75; floorScaleZ = 0.75; } floorScaleX *= (fW/width); floorScaleZ *= (fD/depth);
                   } else {
                       if (archStyle === 'step') { const steps = Math.floor(i / 2); const shrinkage = steps * 1.5; fW = Math.max(width - shrinkage, 5); fD = Math.max(depth - shrinkage, 5); } 
                       else if (archStyle === 'shift') { if (i % 2 !== 0) { floorGroup.position.x = (Math.random() - 0.5) * 1.5; floorGroup.position.z = (Math.random() - 0.5) * 1.5; } } 
                       else if (archStyle === 'twist') { floorGroup.rotation.y = i * 0.1; } 
                       else if (archStyle === 'taper') { const ratio = 1 - (i / floors) * 0.4; fW *= ratio; fD *= ratio; } 
                       else if (archStyle === 'cantilever') { if (Math.random() > 0.7) { const dir = Math.random() > 0.5 ? 'x' : 'z'; const offset = (Math.random() - 0.5) * 2.5; if(dir === 'x') floorGroup.position.x += offset; else floorGroup.position.z += offset; } }
                       if (archStyle === 'cylinder') { floorScaleX = 0.75; floorScaleZ = 0.75; } else if (archStyle === 'step' || archStyle === 'taper') { floorScaleX = fW / width; floorScaleZ = fD / depth; }
                       fW = Math.max(fW, 5); fD = Math.max(fD, 5);
                       const floorShape: 'box' | 'cylinder' = archStyle === 'cylinder' ? 'cylinder' : 'box';
                       const floorBox = CityAssets.primitives.createWireframeObject(fW, floorHeight, fD, wallColor, 0.1, floorShape); floorBox.position.y = floorHeight / 2; floorGroup.add(floorBox);
                       const plate = CityAssets.primitives.createWireframeObject(fW, 0.2, fD, wallColor, 0.4, floorShape); plate.position.y = 0; floorGroup.add(plate);
                   }
                   if (i < floors - 1 || Math.random() > 0.5) {
                       let layout;
                       if (fW < 7 || fD < 7) { layout = CityAssets.Layouts.createSmallTechnicalRoom ? CityAssets.Layouts.createSmallTechnicalRoom(fW-1, fD-1, animatedObjects) : CityAssets.Layouts.createOfficeLayout(fW-1, fD-1, animatedObjects); } 
                       else { const randLayout = Math.random(); if (Math.random() > 0.3) { if (randLayout > 0.66) layout = CityAssets.Layouts.createApartment2Bed(fW-1, fD-1, animatedObjects); else if (randLayout > 0.33) layout = CityAssets.Layouts.createOneBedroomApartment(fW-1, fD-1, animatedObjects); else layout = CityAssets.Layouts.createStudioApartment(fW-1, fD-1, animatedObjects); } else { layout = CityAssets.Layouts.createOfficeLayout(fW-1, fD-1, animatedObjects); } }
                       layout.furniture.position.y = 0.1; layout.furniture.scale.set(0.95, 1, 0.95); layout.furniture.position.x = 0; layout.furniture.position.z = 0;
                       floorGroup.add(layout.furniture);
                       layout.inhabitants.forEach(inh => { inh.position.y += 0.1; floorGroup.add(inh); ctx.animRef.current.inhabitantsList.push(inh); });
                   }
                   building.add(floorGroup);
               }
               const roofY = floors * floorHeight; const roofGroup = new THREE.Group(); roofGroup.position.y = roofY; roofGroup.userData = { originalY: roofY };
               let lastW = width; let lastD = depth;
               if(archStyle === 'step') { const steps = Math.floor((floors-1) / 2); const shrinkage = steps * 1.5; lastW = Math.max(width - shrinkage, 5); lastD = Math.max(depth - shrinkage, 5); } 
               else if (archStyle === 'taper') { const ratio = 1 - ((floors-1) / floors) * 0.4; lastW *= ratio; lastD *= ratio; } else if (archStyle === 'extraordinary') { lastW *= 0.7; lastD *= 0.7; }
               let roofShape: 'box' | 'cylinder' | 'icosahedron' = archStyle === 'cylinder' ? 'cylinder' : 'box';
               if (archStyle === 'extraordinary') roofShape = Math.random() > 0.5 ? 'icosahedron' : 'box';
               const roofPlate = CityAssets.primitives.createWireframeObject(lastW, 0.5, lastD, 0x222222, 0.8, roofShape); roofPlate.position.y = 0.25; roofGroup.add(roofPlate);
               const details = CityAssets.Architecture.createRooftopDetail(lastW, lastD, roofShape); details.position.y = 0.5; roofGroup.add(details);
               building.add(roofGroup); 
               cityGroup.add(building); ctx.animRef.current.buildingsList.push(building); building.userData = { isBuilding: true, expanded: false, footprint: Math.max(width, depth) };
               animatedObjects.fans.forEach(f => ctx.animRef.current.fanList.push(f)); animatedObjects.screens.forEach(s => ctx.animRef.current.screenList.push(s));

               const swM = new THREE.Matrix4(); swM.setPosition(bx, 0.1, bz); sidewalkMerger.addBox(swM, 16, 0.2, 16);
               const positions = [[bx-8,bz-8], [bx+8,bz-8], [bx-8,bz+8], [bx+8,bz+8], [bx-8,bz], [bx+8,bz], [bx,bz-8], [bx,bz+8]]; positions.forEach(p=>{ batchTree(p[0],p[1]); });
               const lamps=[{x:bx-8,z:bz-4,r:0},{x:bx+8,z:bz+4,r:Math.PI},{x:bx-4,z:bz+8,r:-Math.PI/2},{x:bx+4,z:bz-8,r:Math.PI/2}]; lamps.forEach(p=>batchStreetLamp(p.x,p.z,p.r));
               const corners=[{x:bx-8.5,z:bz-8.5,r:0, dx:-1, dz:-1},{x:bx+8.5,z:bz-8.5,r:-Math.PI/2, dx:1, dz:-1},{x:bx-8.5,z:bz+8.5,r:Math.PI/2, dx:-1, dz:1},{x:bx+8.5,z:bz+8.5,r:Math.PI, dx:1, dz:1}];
               corners.forEach(c=>{ if(Math.random()>0.7){ const ox=Math.cos(c.r+Math.PI/4)*1.5;const oz=Math.sin(c.r+Math.PI/4)*1.5; const objM = new THREE.Matrix4(); objM.setPosition(c.x+ox, 0, c.z+oz); if(Math.random()>0.5) { const dummy = new THREE.Object3D(); dummy.position.set(c.x+ox, 0.4, c.z+oz); dummy.scale.set(0.5, 0.8, 0.5); dummy.updateMatrix(); propData.bins.push({mat: dummy.matrix}); } else { const dummy = new THREE.Object3D(); dummy.position.set(c.x+ox, 0.8, c.z+oz); dummy.scale.set(0.6, 0.8, 0.6); dummy.updateMatrix(); propData.mailboxes.push({mat: dummy.matrix}); } } });
               const signM = new THREE.Matrix4(); signM.makeRotationY(Math.PI/4); signM.setPosition(bx-8.5, 1.5, bz-8.5); const sObj = new THREE.Object3D(); sObj.position.set(bx-8.5, 1.5, bz-8.5); sObj.rotation.y=Math.PI/4; sObj.updateMatrix(); propData.signs.push({mat: sObj.matrix});
               const popDensity = distFromCenter === 1 ? 4 : 2;
               for(let i=0;i<popDensity;i++){ const isX=Math.random()>0.5; const b=isX?{minX:bx-8.5,maxX:bx+8.5,minZ:bz-8.8,maxZ:bz-8.2}:{minX:bx-8.8,maxX:bx-8.2,minZ:bz-8.5,maxZ:bz+8.5}; if(isX&&Math.random()>0.5){b.minZ+=17;b.maxZ+=17;} if(!isX&&Math.random()>0.5){b.minX+=17;b.maxX+=17;} const p=CityAssets.Life.createInhabitant(InhabitantState.WALKING,b); p.position.set((b.minX+b.maxX)/2,0.2,(b.minZ+b.maxZ)/2); cityGroup.add(p); ctx.animRef.current.inhabitantsList.push(p); }
           }
       }
       const roadLimit = GRID_RADIUS + 0.5; const mapSize = (GRID_RADIUS * 2 + 2) * fullStep;
       for (let i = -GRID_RADIUS; i <= GRID_RADIUS + 1; i++) {
            const offset = (i - 0.5) * fullStep;
            scatterRoadDetails('z', offset, -mapSize/2, mapSize/2); scatterRoadDetails('x', offset, -mapSize/2, mapSize/2);
            for (let j = -GRID_RADIUS; j <= GRID_RADIUS + 1; j++) {
                const crossOffset = (j - 0.5) * fullStep;
                const addCrosswalk = (px: number, pz: number, vertical: boolean) => { for(let k=-3; k<=3; k++) { const m = new THREE.Matrix4(); if (vertical) m.setPosition(px + k*1.0, 0.06, pz); else m.setPosition(px, 0.06, pz + k*1.0); markingMerger.addBox(m, vertical ? 0.3 : 1.8, 0.005, vertical ? 1.8 : 0.3); } };
                addCrosswalk(offset, crossOffset + gap/2 - 1.5, true); addCrosswalk(offset, crossOffset - gap/2 + 1.5, true); addCrosswalk(offset + gap/2 - 1.5, crossOffset, false); addCrosswalk(offset - gap/2 + 1.5, crossOffset, false);
                const tl1Struct = batchTrafficLightStructure(offset+8.5, crossOffset+8.5, 'z'); const tl2Struct = batchTrafficLightStructure(offset-8.5, crossOffset-8.5, 'x');
                const addSignals = (pos: THREE.Vector3, rot: number, axis: 'x' | 'z') => { const group = new THREE.Group(); group.userData = { controlAxis: axis }; const colors = { red: 0xff0000, yellow: 0xffff00, green: 0x00ff00 }; const offsets = [0.4, 0, -0.4]; const signals: any = {}; let idx = 0; for (const [key, color] of Object.entries(colors)) { const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3 }); const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.05), mat); const y = pos.y + offsets[idx]; if (axis === 'z') mesh.position.set(pos.x, y, pos.z + 0.26); else { mesh.position.set(pos.x + 0.26, y, pos.z); mesh.rotation.y = Math.PI/2; } group.add(mesh); signals[key] = mesh; idx++; } cityGroup.add(group); ctx.animRef.current.trafficLightsList.push({ group, signals }); }
                addSignals(tl1Struct.housingPos, tl1Struct.housingRot, 'z'); addSignals(tl2Struct.housingPos, tl2Struct.housingRot, 'x');
            }
            const vRoadM = new THREE.Matrix4(); vRoadM.setPosition(offset, 0.02, 0); asphaltMerger.addBox(vRoadM, gap, 0.05, mapSize);
            const hRoadM = new THREE.Matrix4(); hRoadM.setPosition(0, 0.02, offset); asphaltMerger.addBox(hRoadM, mapSize, 0.05, gap);
            roadBorderMerger.addLine(new THREE.Vector3(offset-gap/2, 0.05, -mapSize/2), new THREE.Vector3(offset-gap/2, 0.05, mapSize/2)); roadBorderMerger.addLine(new THREE.Vector3(offset+gap/2, 0.05, -mapSize/2), new THREE.Vector3(offset+gap/2, 0.05, mapSize/2)); roadBorderMerger.addLine(new THREE.Vector3(-mapSize/2, 0.05, offset-gap/2), new THREE.Vector3(mapSize/2, 0.05, offset-gap/2)); roadBorderMerger.addLine(new THREE.Vector3(-mapSize/2, 0.05, offset+gap/2), new THREE.Vector3(mapSize/2, 0.05, offset+gap/2));
            const dashLen = 2; const gapLen = 2; const numDashes = Math.floor(mapSize / (dashLen + gapLen));
            for(let k=0; k<numDashes; k++) { const pos = -mapSize/2 + (dashLen+gapLen)/2 + k*(dashLen+gapLen); const vm = new THREE.Matrix4(); vm.setPosition(offset, 0.06, pos); markingMerger.addBox(vm, 0.2, 0.005, dashLen); const hm = new THREE.Matrix4(); hm.setPosition(pos, 0.06, offset); markingMerger.addBox(hm, dashLen, 0.005, 0.2); }
            // (idem : la grille ne porte plus ses propres voitures)
       }
       // --- PARCELLES : la première couronne d'îlots vides autour de la grille.
       // La ville s'étend donc vers l'extérieur, jamais dans les rues existantes.
       for (const RING of [GRID_RADIUS + 1, GRID_RADIUS + 2]) {
           for (let x = -RING; x <= RING; x++) {
               for (let z = -RING; z <= RING; z++) {
                   if (Math.max(Math.abs(x), Math.abs(z)) !== RING) continue;
                   addPlot(x * fullStep, z * fullStep, 12, 'Extension');
               }
           }
       }
       baseRadius = (GRID_RADIUS + 2) * fullStep;
    }

    // Merged Mesh Generation
    const tL=treeMergerTrunk.getObject(0x5A3E36); if(tL) cityGroup.add(tL);
    const fL=treeMergerFoliage.getObject(0x2E8B57); if(fL) cityGroup.add(fL);
    const lL=lampMerger.getObject(CITY_THEME.colors.props.lampPost); if(lL) cityGroup.add(lL);
    const rbL=roadBorderMerger.getObject(sharedMaterials.wireframeRoadBorder); if(rbL) cityGroup.add(rbL);
    const asphaltMesh = asphaltMerger.toMesh(); if(asphaltMesh) cityGroup.add(asphaltMesh);
    const sidewalkMesh = sidewalkMerger.toMesh(); if(sidewalkMesh) cityGroup.add(sidewalkMesh);
    const markingsMesh = markingMerger.toMesh(); if(markingsMesh) cityGroup.add(markingsMesh);
    const patchMesh = patchMerger.toMesh(); if(patchMesh) cityGroup.add(patchMesh);

    // Instanced Meshes
    if(treeData.trunks.length>0){const g=getCachedGeometry(1,1,1,'box');const m=new THREE.InstancedMesh(g,sharedMaterials.treeTrunk,treeData.trunks.length);treeData.trunks.forEach((d,i)=>m.setMatrixAt(i,d.mat));cityGroup.add(m);}
    if(treeData.foliageBoxes.length>0){const g=getCachedGeometry(1,1,1,'box');const m=new THREE.InstancedMesh(g,sharedMaterials.treeLeaves,treeData.foliageBoxes.length);treeData.foliageBoxes.forEach((d,i)=>{m.setMatrixAt(i,d.mat);m.setColorAt(i,new THREE.Color(d.color));});cityGroup.add(m);}
    if(treeData.foliageIcos.length>0){const g=getCachedGeometry(1,1,1,'icosahedron');const m=new THREE.InstancedMesh(g,sharedMaterials.treeLeaves,treeData.foliageIcos.length);treeData.foliageIcos.forEach((d,i)=>{m.setMatrixAt(i,d.mat);m.setColorAt(i,new THREE.Color(d.color));});cityGroup.add(m);}
    if(treeData.foliageCones.length>0){const g=getCachedGeometry(1,1,1,'cone');const m=new THREE.InstancedMesh(g,sharedMaterials.treeLeaves,treeData.foliageCones.length);treeData.foliageCones.forEach((d,i)=>{m.setMatrixAt(i,d.mat);m.setColorAt(i,new THREE.Color(d.color));});cityGroup.add(m);}
    if(lampData.poles.length>0){const g=getCachedGeometry(1,1,1,'box');const m=new THREE.InstancedMesh(g,new THREE.MeshBasicMaterial({color:CITY_THEME.colors.props.lampPost,transparent:true,opacity:0.8}),lampData.poles.length+lampData.arms.length);lampData.poles.forEach((d,i)=>m.setMatrixAt(i,d.mat));lampData.arms.forEach((d,i)=>m.setMatrixAt(lampData.poles.length+i,d.mat));cityGroup.add(m);}
    if(lampData.fixtures.length>0){const g=getCachedGeometry(1,1,1,'box');const m=new THREE.InstancedMesh(g,sharedMaterials.lampLight,lampData.fixtures.length);lampData.fixtures.forEach((d,i)=>m.setMatrixAt(i,d.mat));cityGroup.add(m);}
    if(propData.tlPoles.length>0){const g=getCachedGeometry(1,1,1,'box');const m=new THREE.InstancedMesh(g,getMaterial(CITY_THEME.colors.props.metal,false),propData.tlPoles.length);propData.tlPoles.forEach((d,i)=>m.setMatrixAt(i,d.mat));cityGroup.add(m);}
    if(propData.tlHousings.length>0){const g=getCachedGeometry(1,1,1,'box');const m=new THREE.InstancedMesh(g,getMaterial(0x111111,false),propData.tlHousings.length);propData.tlHousings.forEach((d,i)=>m.setMatrixAt(i,d.mat));cityGroup.add(m);}
    if(propData.signs.length>0){const g=getCachedGeometry(0.1,3,0.1,'box');const m=new THREE.InstancedMesh(g,getMaterial(CITY_THEME.colors.props.signs,false),propData.signs.length);propData.signs.forEach((d,i)=>m.setMatrixAt(i,d.mat));cityGroup.add(m);}
    if(propData.bins.length>0){const g=getCachedGeometry(1,1,1,'box');const m=new THREE.InstancedMesh(g,getMaterial(CITY_THEME.colors.props.trashBin,false),propData.bins.length);propData.bins.forEach((d,i)=>m.setMatrixAt(i,d.mat));cityGroup.add(m);}
    if(propData.mailboxes.length>0){const g=getCachedGeometry(1,1,1,'box');const m=new THREE.InstancedMesh(g,getMaterial(CITY_THEME.colors.props.mailbox,false),propData.mailboxes.length);propData.mailboxes.forEach((d,i)=>m.setMatrixAt(i,d.mat));cityGroup.add(m);}
    if(propData.benches.length>0){const g=getCachedGeometry(2,0.1,0.6,'box');const m=new THREE.InstancedMesh(g,getMaterial(CITY_THEME.colors.props.wood,false),propData.benches.length);propData.benches.forEach((d,i)=>m.setMatrixAt(i,d.mat));cityGroup.add(m);}
    if(manholeData.length>0){const g=getCachedGeometry(0.6,0.05,0.6,'cylinder',16);const m=new THREE.InstancedMesh(g,sharedMaterials.manholeMetal,manholeData.length);manholeData.forEach((d,i)=>m.setMatrixAt(i,d.mat));cityGroup.add(m);}
    if(potholeData.length>0){const g=getCachedGeometry(0.6,0.02,0.6,'cylinder',7);const m=new THREE.InstancedMesh(g,sharedMaterials.potholeDark,potholeData.length);potholeData.forEach((d,i)=>m.setMatrixAt(i,d.mat));cityGroup.add(m);}

    // Niveau de détail : chaque bâtiment reçoit sa silhouette de remplacement,
    // qui prendra le relais dès qu'on s'éloigne (cf. engine/world/lod.ts).
    ctx.animRef.current.buildingsList.forEach((b) => attachLod(b));

    setCityRadius(baseRadius);
    return baseRadius;
};


