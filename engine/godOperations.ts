/**
 * God-mode operations: spawn/remove/recolor/resize/teleport/animate/camera/build,
 * plus `summonVehicle` which drives a vehicle to the player so they can enter it (F).
 */
import * as THREE from 'three';
import type { MutableRefObject } from 'react';
import { CityAssets, InhabitantState } from './assets';
import type { GodOperation } from './types';
import type { AnimState } from './context';
import { resolveBuildSite, findOpenGround, refreshPlotMarkers } from './world/zoning';
import type { ExpansionManager } from './world/expansion';

export interface GodOpsCtx {
  /** Le monde persistant : si présent, les constructions y sont INSCRITES
   *  (elles survivent donc au rechargement au lieu de s'évaporer). */
  worldRef?: MutableRefObject<ExpansionManager | null>;
  cityGroupRef: MutableRefObject<THREE.Group | null>;
  cameraRef: MutableRefObject<THREE.PerspectiveCamera | null>;
  controlsRef: MutableRefObject<any>; // OrbitControls (loosely typed to avoid a deep three import)
  aiBuildingsRef: MutableRefObject<THREE.Group>;
  animRef: MutableRefObject<AnimState>;
}

export interface SummonCtx {
  cityGroupRef: MutableRefObject<THREE.Group | null>;
  cameraRef: MutableRefObject<THREE.PerspectiveCamera | null>;
  animRef: MutableRefObject<AnimState>;
  walkModeRef: MutableRefObject<boolean>;
}

// --- GOD MODE COMMAND PROCESSOR ---
export const executeGodOperations = (ops: GodOperation[], ctx: GodOpsCtx) => {
    if (!ctx.cityGroupRef.current) return;

    ops.forEach(op => {
        // --- ACTION: BUILD (Architect Mode) ---
        if (op.action === 'BUILD' && op.params?.position) {
             const { position, floors, style, color } = op.params;
             const hexColor = color ? parseInt(color.replace('#','0x')) : 0x00aaff;

             // URBANISME : la position demandée est ramenée sur un terrain légal
             // (jamais sur la chaussée, jamais sur un bâtiment existant).
             const site = resolveBuildSite({ x: position.x, z: position.z }, 14);
             if (!site) return; // plus rien de constructible ici : on n'entasse pas

             // Si le monde persistant est disponible, on passe par lui : le
             // bâtiment entre au registre et sera rebâti à chaque session.
             const world = ctx.worldRef?.current;
             if (world) {
                 const floorsN = floors || 10;
                 const kind = floorsN >= 9 ? 'bureau' : floorsN >= 4 ? 'immeuble' : 'maison';
                 const level = Math.max(1, Math.min(5, Math.round(floorsN / 3)));
                 world.place(kind, site.x, site.z, Math.atan2(-site.x, -site.z), level, 'God Mode');
                 return;
             }

             const buildingData = CityAssets.Layouts.createProceduralBuilding(
                 12, 12, floors || 10, style || 'modern', hexColor
             );

             const b = buildingData.group;
             b.position.set(site.x, 0, site.z);
             b.userData = { isBuilding: true, expanded: false, isPersistent: true };

             // Add to AI persistent group so it survives weather changes
             ctx.aiBuildingsRef.current.add(b);
             ctx.animRef.current.buildingsList.push(b);

             // Register internals.
             buildingData.animatedObjects.fans.forEach(f => ctx.animRef.current.fanList.push(f));
             buildingData.animatedObjects.screens.forEach(s => ctx.animRef.current.screenList.push(s));
             // Les habitants sont des ENFANTS des étages : leurs coordonnées sont
             // locales. Y ajouter la position du bâtiment les projetait dehors,
             // en l'air (« personnages qui flottent »). On ne touche donc à rien.
             buildingData.inhabitants.forEach(i => {
                 ctx.animRef.current.inhabitantsList.push(i);
             });
             if (ctx.cityGroupRef.current) refreshPlotMarkers(ctx.cityGroupRef.current);
             return;
        }

        // --- ACTION: CAMERA ---
        if (op.action === 'CAMERA' && op.params?.position && ctx.cameraRef.current && ctx.controlsRef.current) {
            // Force Move Camera
            const pos = op.params.position;
            ctx.cameraRef.current.position.set(pos.x, pos.y, pos.z);
            if (op.params.lookAt) {
                ctx.controlsRef.current.target.set(op.params.lookAt.x, op.params.lookAt.y, op.params.lookAt.z);
                ctx.cameraRef.current.lookAt(op.params.lookAt.x, op.params.lookAt.y, op.params.lookAt.z);
            }
            ctx.controlsRef.current.update();
            return; // Camera op handles itself
        }

        // --- ACTION: SPAWN ---
        if (op.action === 'SPAWN' && op.params?.type) {
            let obj: THREE.Group | null = null;
            const pos = op.params.position || { x: 0, y: 0, z: 0 };
            const scale = op.params.scale || 1;
            
            if (op.params.type === 'tree') {
                // Map color string to hex if present, else default
                let colors = undefined;
                if (op.params.color) {
                     const colorMap: Record<string, number> = { "red": 0xff0000, "gold": 0xffd700, "blue": 0x0000ff };
                     const hex = colorMap[op.params.color.toLowerCase()] || parseInt(op.params.color.replace('#', '0x'));
                     if (!isNaN(hex)) colors = [hex];
                }
                obj = CityAssets.Props.createHolographicTree(scale, colors);
                obj.userData.type = 'tree';
            } else if (op.params.type === 'car') {
                obj = CityAssets.Life.createVehicle('car');
                obj.userData.type = 'vehicle';
                ctx.animRef.current.vehiclesList.push(obj);
            } else if (op.params.type === 'person') {
                obj = CityAssets.Life.createInhabitant(InhabitantState.IDLE);
                obj.userData.type = 'inhabitant';
                ctx.animRef.current.inhabitantsList.push(obj);
            } else if (op.params.type === 'sculpture') {
                obj = CityAssets.Props.createHoloStatue();
                obj.userData.type = 'sculpture';
            }

            if (obj) {
                // Arbres, statues et passants : posés sur un sol dégagé, pas au
                // milieu d'une voie ni dans un mur.
                if (op.params.type !== 'car' && (pos.y ?? 0) < 1) {
                    const g = findOpenGround({ x: pos.x, z: pos.z }, op.params.type === 'person' ? 1.5 : 3);
                    pos.x = g.x; pos.z = g.z;
                }
                obj.position.set(pos.x, pos.y, pos.z);
                if (scale !== 1) obj.scale.setScalar(scale);
                // Override color if provided and not handled by factory
                if (op.params.color && op.params.type !== 'tree') {
                    const c = new THREE.Color(op.params.color);
                    obj.traverse((child: any) => { if (child.material && !Array.isArray(child.material)) child.material.color.set(c); });
                    obj.userData.colorHex = c.getHex();
                }
                ctx.cityGroupRef.current?.add(obj);
            }
            return;
        }

        // --- SELECTION LOGIC FOR EXISTING OBJECTS ---
        let targets: THREE.Object3D[] = [];
        
        const getPotentialTargets = () => {
            if (op.selector.type === 'vehicle') return ctx.animRef.current.vehiclesList;
            if (op.selector.type === 'inhabitant') return ctx.animRef.current.inhabitantsList;
            if (op.selector.type === 'building') return ctx.animRef.current.buildingsList;
            if (op.selector.type === 'tree') {
                // Trees are tricky because they are often instanced or just static props without a list
                // We scan cityGroup children
                return ctx.cityGroupRef.current?.children.filter(c => c.userData.type === 'tree') || [];
            }
            if (op.selector.type === 'all') return [...ctx.animRef.current.vehiclesList, ...ctx.animRef.current.inhabitantsList, ...ctx.animRef.current.buildingsList];
            return [];
        };

        const candidates = getPotentialTargets();

        // Filter by Color (Approximate)
        targets = candidates.filter(obj => {
            if (!op.selector.color) return true;
            if (obj.userData.colorHex) {
                const objColor = new THREE.Color(obj.userData.colorHex);
                const colorMap: Record<string, number> = {
                    "red": 0xff0000, "green": 0x00ff00, "blue": 0x0000ff, "white": 0xffffff,
                    "black": 0x000000, "yellow": 0xffff00, "cyan": 0x00ffff, "magenta": 0xff00ff,
                    "grey": 0x888888, "gray": 0x888888, "purple": 0x800080, "orange": 0xffa500, "gold": 0xffd700
                };
                const targetHex = colorMap[op.selector.color.toLowerCase()];
                if (targetHex !== undefined) {
                     const targetColor = new THREE.Color(targetHex);
                     const dist = Math.abs(objColor.r - targetColor.r) + Math.abs(objColor.g - targetColor.g) + Math.abs(objColor.b - targetColor.b);
                     return dist < 1.0; 
                }
            }
            return true;
        });

        // Limit Count
        if (op.selector.count && typeof op.selector.count === 'number') {
            targets = targets.slice(0, op.selector.count);
        }

        // 2. APPLY ACTIONS
        targets.forEach(target => {
            if (op.action === 'REMOVE') {
                target.visible = false;
                target.position.y = -500; 
            }
            else if (op.action === 'RECOLOR') {
                if (op.params?.color) {
                    const newColor = new THREE.Color(op.params.color);
                    target.traverse((child) => {
                        if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
                            if (!Array.isArray(child.material)) {
                                child.material = child.material.clone();
                                (child.material as any).color.set(newColor);
                            }
                        }
                    });
                    target.userData.colorHex = newColor.getHex();
                }
            }
            else if (op.action === 'RESIZE') {
                if (op.params?.scale) {
                    const s = op.params.scale;
                    target.scale.set(s, s, s);
                }
            }
            else if (op.action === 'TELEPORT') {
                if (op.params?.position) {
                    target.position.set(op.params.position.x, op.params.position.y, op.params.position.z);
                    if (target.userData.speed) target.userData.speed = 0;
                    if (target.userData.lane) delete target.userData.lane; 
                }
            }
            else if (op.action === 'ANIMATE') {
                if (op.params?.animationState !== undefined) {
                    target.userData.state = op.params.animationState;
                }
            }
        });
    });
};

// Summon a vehicle that drives to the player, then waits to be entered (F).
export const summonVehicle = (type: 'car' | 'taxi' | 'truck' | 'bus', _label: string | undefined, ctx: SummonCtx) => {
    if (!ctx.cityGroupRef.current || !ctx.cameraRef.current) return;

    const isFPS = ctx.walkModeRef.current;
    const camPos = ctx.cameraRef.current.position.clone();
    // In walk mode the camera IS the player. Otherwise centre on the city.
    const playerPos = isFPS ? new THREE.Vector3(camPos.x, 0, camPos.z) : new THREE.Vector3(0, 0, 0);

    let forward = new THREE.Vector3();
    if (isFPS) ctx.cameraRef.current.getWorldDirection(forward);
    else forward.set(0, 0, -1);
    forward.y = 0;
    if (forward.lengthSq() < 0.0001) forward.set(0, 0, -1);
    forward.normalize();

    // Stop a few metres in front of the player so the car lands in the crosshair.
    const stopDistance = 6;
    const spawnDistance = 34;
    const target = playerPos.clone().add(forward.clone().multiplyScalar(stopDistance));
    const spawn = playerPos.clone().add(forward.clone().multiplyScalar(spawnDistance));

    const v = CityAssets.Life.createVehicle(type);
    v.position.set(spawn.x, 0.1, spawn.z);
    v.userData.type = 'vehicle';
    v.userData.summonTarget = target.clone();
    v.userData.summoned = true;
    v.userData.speed = 0;
    v.userData.maxSpeed = 16;

    ctx.cityGroupRef.current.add(v);
    ctx.animRef.current.vehiclesList.push(v);
};


