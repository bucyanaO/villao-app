/**
 * spawnAiNpcs — places the AI personas as tagged inhabitants in the city.
 * Each gets `userData.type = 'ai-agent'` + `userData.persona`, plus a small
 * glowing "halo" so the player can spot consultants at a distance.
 *
 * Call after `generateCity` (which resets the inhabitant list), so the AI NPCs
 * are registered for the animation loop and re-added on every city regeneration.
 */
import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import { CityAssets, InhabitantState, sharedMaterials } from '../assets';
import type { AnimState } from '../context';
import type { Persona } from './types';
import { findOpenGround } from '../world/zoning';

export function spawnAiNpcs(
  cityGroup: THREE.Group,
  animRef: MutableRefObject<AnimState>,
  personas: Persona[],
): THREE.Group[] {
  const npcs: THREE.Group[] = [];
  for (const persona of personas) {
    // Le point de la persona est calé sur un sol dégagé du plan courant : selon
    // le style de ville, sa position théorique peut tomber dans un mur ou sur
    // la chaussée. Le cadastre nous donne le point libre le plus proche.
    const spot = findOpenGround(persona.location, 2.5);
    // Walk near their spot (a small bounded patrol) so consultants feel alive,
    // but stay around their location so the player can still find & talk to them.
    const r = 6;
    const bounds = {
      minX: spot.x - r, maxX: spot.x + r,
      minZ: spot.z - r, maxZ: spot.z + r,
    };
    const npc = CityAssets.Life.createInhabitant(InhabitantState.WALKING, bounds);
    npc.position.set(spot.x, 0.2, spot.z);
    npc.rotation.y = Math.random() * Math.PI * 2;
    npc.userData.type = 'ai-agent';
    npc.userData.persona = persona;
    npc.userData.isAi = true;
    npc.userData.name = persona.name; // handy for debugging

    // AI indicator: a glowing diamond (octahedron) above the head — animated (bob + spin) in the loop.
    const halo = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), sharedMaterials.eyeGlow);
    halo.position.y = 2.3;
    halo.userData = { isHalo: true };
    npc.add(halo);
    npc.userData.halo = halo;

    cityGroup.add(npc);
    animRef.current.inhabitantsList.push(npc);
    npcs.push(npc);
  }
  return npcs;
}
