/**
 * Life — inhabitants, vehicles, drones and helicopters.
 */
import * as THREE from 'three';
import { CITY_THEME } from '../theme';
import { InhabitantState, Bounds, Collider } from './types';
import { sharedMaterials, getMaterial, getCachedGeometry } from './materials';
import { createWireframeObject, createSolidObject } from './primitives';

export const Life = {
    createInhabitant: (state: InhabitantState = InhabitantState.IDLE, bounds?: Bounds, colliders: Collider[] = []): THREE.Group => {
        const group = new THREE.Group();
        const color = CITY_THEME.colors.characters.clothes[Math.floor(Math.random() * CITY_THEME.colors.characters.clothes.length)];
        const hairColorVal = CITY_THEME.colors.characters.hair[Math.floor(Math.random() * CITY_THEME.colors.characters.hair.length)];
        const hairMat = getMaterial(hairColorVal, false);
        const scale = state === InhabitantState.DRIVING ? 0.4 : 0.55;
        const headS = 1.2 * scale; const legH = 0.7 * scale; const torsoH = 0.8 * scale; const limbW = 0.35 * scale; 
        const isFemale = Math.random() > 0.5;
        
        const leftLegPivot = new THREE.Group(); leftLegPivot.position.set(-limbW, legH, 0);
        const leftLeg = createWireframeObject(limbW, legH, limbW, color, 0.5); leftLeg.position.y = -legH / 2; leftLegPivot.add(leftLeg);
        const rightLegPivot = new THREE.Group(); rightLegPivot.position.set(limbW, legH, 0);
        const rightLeg = createWireframeObject(limbW, legH, limbW, color, 0.5); rightLeg.position.y = -legH / 2; rightLegPivot.add(rightLeg);
        const torso = createWireframeObject(limbW * 2.8, torsoH, limbW * 1.8, color, 0.5); torso.position.set(0, legH + torsoH / 2, 0);
        const head = createWireframeObject(headS, headS, headS, color, 0.6); head.position.set(0, legH + torsoH + headS / 2, 0);
        const eyeSize = 0.25 * scale; const eyeGeo = getCachedGeometry(eyeSize, eyeSize/2, 0.1, 'box');
        const leftEye = new THREE.Mesh(eyeGeo, sharedMaterials.eyeGlow); leftEye.position.set(-0.25 * scale, 0.1 * scale, headS/2 + 0.05);
        const rightEye = new THREE.Mesh(eyeGeo, sharedMaterials.eyeGlow); rightEye.position.set(0.25 * scale, 0.1 * scale, headS/2 + 0.05);
        head.add(leftEye, rightEye);

        if (isFemale) {
            const hairStyle = Math.floor(Math.random() * 3);
            if (hairStyle === 0) { const longHair = createSolidObject(headS + 0.1*scale, headS * 1.5, 0.3 * scale, hairMat, 'box'); longHair.position.set(0, -headS/2, -headS/2 - 0.1*scale); head.add(longHair); const topHair = createSolidObject(headS + 0.1*scale, 0.3*scale, headS + 0.2*scale, hairMat, 'box'); topHair.position.set(0, headS/2 + 0.1*scale, 0); head.add(topHair); } 
            else if (hairStyle === 1) { const sideL = createSolidObject(0.3*scale, headS, headS, hairMat, 'box'); sideL.position.set(-headS/2-0.1*scale, 0, 0); const sideR = createSolidObject(0.3*scale, headS, headS, hairMat, 'box'); sideR.position.set(headS/2+0.1*scale, 0, 0); const top = createSolidObject(headS + 0.6*scale, 0.3*scale, headS, hairMat, 'box'); top.position.set(0, headS/2+0.1*scale, 0); head.add(sideL, sideR, top); } 
            else { const bun = createSolidObject(headS*0.6, headS*0.6, headS*0.6, hairMat, 'box'); bun.position.set(0, headS/2 + 0.3*scale, -0.3*scale); head.add(bun); }
        } else {
            const hairStyle = Math.floor(Math.random() * 4);
            if (hairStyle === 0) { const top = createSolidObject(headS, 0.1*scale, headS, hairMat, 'box'); top.position.set(0, headS/2 + 0.05*scale, 0); head.add(top); } 
            else if (hairStyle === 1) { const mohawk = createSolidObject(0.2 * scale, 0.6 * scale, headS, getMaterial(color, false), 'box'); mohawk.position.set(0, headS/2 + 0.3*scale, 0); head.add(mohawk); } 
            else if (hairStyle === 2) { const capVisor = createSolidObject(headS, 0.1 * scale, 0.3 * scale, sharedMaterials.accessoryDark, 'box'); capVisor.position.set(0, headS/2 - 0.2*scale, Math.random() > 0.5 ? -headS/2 - 0.1*scale : headS/2 + 0.1*scale); head.add(capVisor); const capTop = createSolidObject(headS + 0.1*scale, 0.2*scale, headS + 0.1*scale, sharedMaterials.accessoryDark, 'box'); capTop.position.set(0, headS/2 + 0.1*scale, 0); head.add(capTop); }
        }
        const armH = 0.7 * scale; const shoulderY = legH + torsoH - 0.2 * scale; const armOffset = limbW * 1.8;
        const leftArmPivot = new THREE.Group(); leftArmPivot.position.set(-armOffset, shoulderY, 0);
        const leftArm = createWireframeObject(limbW, armH, limbW, color, 0.5); leftArm.position.y = -armH/2; leftArmPivot.add(leftArm);
        const rightArmPivot = new THREE.Group(); rightArmPivot.position.set(armOffset, shoulderY, 0);
        const rightArm = createWireframeObject(limbW, armH, limbW, color, 0.5); rightArm.position.y = -armH/2; rightArmPivot.add(rightArm);
        group.add(leftLegPivot, rightLegPivot, torso, head, leftArmPivot, rightArmPivot);
        
        group.userData = { isInhabitant: true, state: state, speed: 0.5 + Math.random() * 0.5, animSpeed: 5 + Math.random() * 2, offset: Math.random() * 100, walkingBounds: bounds, colliders: colliders, direction: new THREE.Vector3(Math.random()-0.5, 0, Math.random()-0.5).normalize(), parts: { leftLeg: leftLegPivot, rightLeg: rightLegPivot, leftArm: leftArmPivot, rightArm: rightArmPivot, group: group, torso: torso, head: head } };
        
        if (state === InhabitantState.SITTING || state === InhabitantState.DRIVING || state === InhabitantState.WORKING) { 
            leftLegPivot.rotation.x = -Math.PI / 2; rightLegPivot.rotation.x = -Math.PI / 2; 
            if (state === InhabitantState.SITTING || state === InhabitantState.WORKING) { group.position.y += 0.15; group.position.z -= 0.2; } 
        } else if (state === InhabitantState.SLEEPING) { 
            group.rotation.x = -Math.PI / 2; 
            group.position.y += 0.4; 
        } else if (state === InhabitantState.PACING) {
             // Setup pacing logic
             group.userData.paceTimer = 0;
             group.userData.paceDirection = 1;
        }
        return group;
    },

    createVehicle: (type: 'car' | 'taxi' | 'bus' | 'truck'): THREE.Group => {
        const group = new THREE.Group();
        const vehicleColors = CITY_THEME.colors.vehicles;
        const bodyColor = type === 'taxi' ? vehicleColors.taxi : (type === 'bus' ? vehicleColors.bus : (type === 'truck' ? vehicleColors.truck : vehicleColors.cars[Math.floor(Math.random()*vehicleColors.cars.length)]));
        const w = 2.0; const length = type === 'bus' ? 6.0 : (type === 'truck' ? 7.0 : 3.5); const height = type === 'bus' || type === 'truck' ? 2.2 : 1.4;
        const wheelPositions = [[-w/2, 0.3, -length/2 + 0.8], [w/2, 0.3, -length/2 + 0.8], [-w/2, 0.3, length/2 - 0.8], [w/2, 0.3, length/2 - 0.8]];
        wheelPositions.forEach(pos => { const wheel = createWireframeObject(0.3, 0.6, 0.6, 0x333333, 0.8, 'cylinder'); wheel.rotation.z = Math.PI / 2; wheel.position.set(pos[0], pos[1], pos[2]); group.add(wheel); });
        const chassisY = 0.6;
        const body = createWireframeObject(w, height - 0.6, length, bodyColor, 0.5); body.position.set(0, chassisY + (height-0.6)/2, 0); group.add(body); 
        if (type === 'car' || type === 'taxi') { const cabin = createWireframeObject(w-0.3, 0.45, length-1.7, bodyColor, 0.25); cabin.position.set(0, chassisY + height - 0.27, -0.15); group.add(cabin); }
        // 2026 modern accent: glowing side stripes
        const aL = createSolidObject(0.04, 0.06, length * 0.72, sharedMaterials.eyeGlow, 'box'); aL.position.set(-w/2 + 0.03, chassisY + 0.18, 0); group.add(aL);
        const aR = createSolidObject(0.04, 0.06, length * 0.72, sharedMaterials.eyeGlow, 'box'); aR.position.set(w/2 - 0.03, chassisY + 0.18, 0); group.add(aR);
        const hlL = createSolidObject(0.4, 0.4, 0.1, sharedMaterials.vehicleHeadlight, 'box'); hlL.position.set(-0.6, chassisY + 0.2, -length/2); group.add(hlL);
        const hlR = createSolidObject(0.4, 0.4, 0.1, sharedMaterials.vehicleHeadlight, 'box'); hlR.position.set(0.6, chassisY + 0.2, -length/2); group.add(hlR);
        const tlL = createSolidObject(0.4, 0.4, 0.1, sharedMaterials.vehicleTaillight, 'box'); tlL.position.set(-0.6, chassisY + 0.2, length/2); group.add(tlL);
        const tlR = createSolidObject(0.4, 0.4, 0.1, sharedMaterials.vehicleTaillight, 'box'); tlR.position.set(0.6, chassisY + 0.2, length/2); group.add(tlR);
        const driver = Life.createInhabitant(InhabitantState.DRIVING); driver.position.set(-0.4, 0.8, 0.5); group.add(driver);
        return group;
    },

    // --- AIRCRAFT (NEW) ---
    createDrone: (): THREE.Group => {
        const group = new THREE.Group();
        const mat = getMaterial(0x333333, false);
        
        // Body center
        const body = createSolidObject(0.5, 0.2, 0.5, mat, 'box');
        group.add(body);
        
        // Arms
        const arm1 = createSolidObject(1.5, 0.05, 0.1, mat, 'box');
        arm1.rotation.y = Math.PI / 4;
        const arm2 = createSolidObject(1.5, 0.05, 0.1, mat, 'box');
        arm2.rotation.y = -Math.PI / 4;
        group.add(arm1, arm2);
        
        // Propellers (Animated parts)
        const props: THREE.Group[] = [];
        const offsets = [
            {x: 0.5, z: 0.5}, {x: -0.5, z: -0.5},
            {x: 0.5, z: -0.5}, {x: -0.5, z: 0.5}
        ];
        
        offsets.forEach((off, i) => {
            const propGroup = new THREE.Group();
            propGroup.position.set(off.x, 0.1, off.z);
            const blade = createSolidObject(0.6, 0.02, 0.05, getMaterial(0xaaaaaa, false), 'box');
            propGroup.add(blade);
            group.add(propGroup);
            props.push(propGroup);
            
            // Light under prop
            const lightMat = i % 2 === 0 ? sharedMaterials.droneLightRed : sharedMaterials.droneLightGreen;
            const led = createSolidObject(0.1, 0.1, 0.1, lightMat, 'box');
            led.position.set(off.x, -0.1, off.z);
            group.add(led);
        });
        
        group.userData = { isAircraft: true, type: 'drone', rotors: props, speed: 2 + Math.random() * 2 };
        return group;
    },

    createHelicopter: (): THREE.Group => {
        const group = new THREE.Group();
        const color = 0x2244aa; // Police/News Blue
        
        // === BIG SCALE FOR 2 PEOPLE ===
        const scale = 2.5; 

        // Bubble Cockpit (Scaled up)
        const cockpit = createWireframeObject(1.5 * scale, 1.5 * scale, 2.5 * scale, color, 0.4, 'icosahedron');
        group.add(cockpit);
        
        // Add 2 Pilots inside
        const pilotMat = getMaterial(0xffaa00, false); // Orange flight suits
        const pilot1 = createSolidObject(0.4 * scale, 0.5 * scale, 0.4 * scale, pilotMat, 'box');
        pilot1.position.set(-0.4 * scale, 0, 0.5 * scale); // Left seat
        
        const pilot2 = createSolidObject(0.4 * scale, 0.5 * scale, 0.4 * scale, pilotMat, 'box');
        pilot2.position.set(0.4 * scale, 0, 0.5 * scale); // Right seat
        
        // Consoles
        const console = createSolidObject(1.2 * scale, 0.2 * scale, 0.5 * scale, getMaterial(0x111111, false), 'box');
        console.position.set(0, -0.2 * scale, 1.0 * scale);

        group.add(pilot1, pilot2, console);

        // Tail Boom
        const tail = createWireframeObject(0.5 * scale, 0.5 * scale, 3 * scale, 0x555555, 0.8, 'box');
        tail.position.set(0, 0, 2.5 * scale);
        group.add(tail);
        
        // Tail Rotor
        const tailRotorGroup = new THREE.Group();
        tailRotorGroup.position.set(0.3 * scale, 0, 4 * scale);
        tailRotorGroup.rotation.z = Math.PI / 2;
        const tBlade = createSolidObject(1.2 * scale, 0.1 * scale, 0.1 * scale, getMaterial(0xcccccc, false), 'box');
        tailRotorGroup.add(tBlade);
        group.add(tailRotorGroup);
        
        // Main Rotor
        const mainRotorGroup = new THREE.Group();
        mainRotorGroup.position.y = 1.0 * scale;
        const mBlade1 = createSolidObject(6 * scale, 0.05 * scale, 0.3 * scale, getMaterial(0x222222, false), 'box');
        const mBlade2 = createSolidObject(0.3 * scale, 0.05 * scale, 6 * scale, getMaterial(0x222222, false), 'box');
        mainRotorGroup.add(mBlade1, mBlade2);
        group.add(mainRotorGroup);
        
        // Skids
        const skidL = createWireframeObject(0.1 * scale, 0.1 * scale, 3 * scale, 0x333333, 1);
        skidL.position.set(-0.8 * scale, -1 * scale, 0);
        const skidR = createWireframeObject(0.1 * scale, 0.1 * scale, 3 * scale, 0x333333, 1);
        skidR.position.set(0.8 * scale, -1 * scale, 0);
        const leg1 = createSolidObject(1.6 * scale, 0.1 * scale, 0.1 * scale, getMaterial(0x333333, false), 'box'); leg1.position.set(0, -0.8 * scale, -0.5 * scale);
        const leg2 = createSolidObject(1.6 * scale, 0.1 * scale, 0.1 * scale, getMaterial(0x333333, false), 'box'); leg2.position.set(0, -0.8 * scale, 0.5 * scale);
        group.add(skidL, skidR, leg1, leg2);
        
        // Searchlight Cone (Fake volumetric)
        const coneHeight = 15 * scale;
        const coneGeo = getCachedGeometry(3 * scale, coneHeight, 3 * scale, 'cone');
        const coneMesh = new THREE.Mesh(coneGeo, sharedMaterials.searchLightBeam);
        // Le faisceau part sous l'appareil. On DÉCALE LE MESH, jamais la
        // géométrie : celle-ci est partagée par le cache, et la translater
        // déplaçait le faisceau de tous les hélicoptères — un peu plus loin à
        // chaque nouvel appareil. D'où ces grands plans blancs qui traversaient
        // le ciel toutes les quelques secondes, au rythme de leurs rondes.
        coneMesh.position.set(0, -1 * scale - coneHeight / 2, 0.5 * scale);
        // Un projecteur ne s'allume que la nuit. De jour, ce grand volume blanc
        // balayait la caméra à chaque ronde : un éclair d'une fraction de
        // seconde, revenant toutes les quelques secondes.
        coneMesh.userData.isSearchBeam = true;
        coneMesh.visible = false;
        coneMesh.rotation.x = -Math.PI / 8; // Point slightly forward
        group.add(coneMesh);

        group.userData = { isAircraft: true, type: 'helicopter', rotors: [mainRotorGroup, tailRotorGroup], speed: 8 + Math.random() * 5 };
        return group;
    }
};


