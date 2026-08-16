/**
 * MARCHE — les murs sont durs.
 *
 * Sans cela, le promeneur traverse les façades et se retrouve au milieu de la
 * maçonnerie : l'écran devient tout noir, sans que rien ne l'explique.
 *
 * On ne recalcule aucune géométrie : chaque bâtiment porte déjà, pour son
 * niveau de détail, une boîte englobante (`lodProxy`). Elle sert ici de volume
 * de collision. Deux règles seulement :
 *  - on teste X et Z séparément, ce qui fait GLISSER le long d'un mur au lieu
 *    de coller net ;
 *  - on ne bloque qu'un passage dehors → dedans. Si l'on est déjà enfermé
 *    (une construction posée autour de soi), on peut toujours ressortir.
 */
import * as THREE from 'three';

/** Demi-largeur du promeneur (m). */
const BODY = 0.6;

interface Box { x: number; z: number; hx: number; hz: number; }

const boxes: Box[] = [];
const center = new THREE.Vector3();

/** Boîtes des bâtiments proches, en coordonnées monde. */
function collect(buildings: readonly THREE.Object3D[], x: number, z: number, reach: number): Box[] {
  boxes.length = 0;
  for (const b of buildings) {
    const proxy = b.userData.lodProxy as THREE.Group | undefined;
    if (!proxy || b.userData.forcedHidden || b.userData.expanded) continue;
    const mesh = proxy.children[0] as THREE.Mesh | undefined;
    if (!mesh) continue;
    proxy.getWorldPosition(center);
    const hx = mesh.scale.x / 2, hz = mesh.scale.z / 2;
    if (Math.abs(center.x - x) > hx + reach || Math.abs(center.z - z) > hz + reach) continue;
    boxes.push({ x: center.x, z: center.z, hx, hz });
  }
  return boxes;
}

const inside = (bs: Box[], x: number, z: number) =>
  bs.some((b) => Math.abs(x - b.x) < b.hx + BODY && Math.abs(z - b.z) < b.hz + BODY);

/**
 * Corrige un déplacement pour qu'il ne pénètre pas dans un bâtiment.
 * Retourne la position retenue (éventuellement glissée le long du mur).
 */
export function walkAgainstBuildings(
  buildings: readonly THREE.Object3D[],
  fromX: number, fromZ: number,
  toX: number, toZ: number,
): { x: number; z: number } {
  const step = Math.hypot(toX - fromX, toZ - fromZ);
  if (step < 1e-4) return { x: toX, z: toZ };

  const bs = collect(buildings, toX, toZ, step + BODY + 1);
  if (!bs.length) return { x: toX, z: toZ };
  if (inside(bs, fromX, fromZ)) return { x: toX, z: toZ };   // déjà dedans : on laisse sortir
  if (!inside(bs, toX, toZ)) return { x: toX, z: toZ };

  if (!inside(bs, toX, fromZ)) return { x: toX, z: fromZ };  // on glisse en X
  if (!inside(bs, fromX, toZ)) return { x: fromX, z: toZ };  // on glisse en Z
  return { x: fromX, z: fromZ };
}
