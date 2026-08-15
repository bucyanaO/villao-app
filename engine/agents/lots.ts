/**
 * BUILD_LOTS — the buildable plots in the residential city.
 *
 * Off-road, off-villa, off-park positions where autonomous agents may build.
 * The autonomy picks the nearest EMPTY lot to a persona (so buildings never land
 * on a road, and never overlap). `drawLotMarkers` shows them on the ground so you
 * can see WHERE construction is allowed.
 *
 * (Residential layout reference: stem road along x≈0 (z=15..160); loop road
 * radius ≈22 around the park; villas at x≈±32. Lots sit in the gaps, all at
 * radius > 26 from the centre → clear of the loop road and the park.)
 */
import * as THREE from 'three';

export interface Lot { x: number; z: number; }

export const BUILD_LOTS: Lot[] = [
  { x: 18, z: 40 }, { x: 18, z: 75 }, { x: 18, z: 110 }, { x: 18, z: 145 },
  { x: -18, z: 40 }, { x: -18, z: 75 }, { x: -18, z: 110 }, { x: -18, z: 145 },
  { x: 21, z: 21 }, { x: -21, z: 21 }, { x: 21, z: -21 }, { x: -21, z: -21 },
];

/** Pick the nearest unused lot to a position. Returns the lot or null if none free. */
export function nearestFreeLot(target: { x: number; z: number }, used: Set<number>): Lot | null {
  let best: Lot | null = null;
  let bestD = Infinity;
  for (let i = 0; i < BUILD_LOTS.length; i++) {
    if (used.has(i)) continue;
    const l = BUILD_LOTS[i];
    const d = (l.x - target.x) ** 2 + (l.z - target.z) ** 2;
    if (d < bestD) { bestD = d; best = l; }
  }
  return best;
}

/** Mark which lot index a given lot corresponds to (for the `used` set). */
export function lotIndex(lot: Lot): number {
  return BUILD_LOTS.findIndex((l) => l.x === lot.x && l.z === lot.z);
}

/** Draw faint ground markers for every buildable lot (so you can see the terrains). */
export function drawLotMarkers(cityGroup: THREE.Group) {
  const size = 11;
  const fillGeo = new THREE.PlaneGeometry(size, size);
  fillGeo.rotateX(-Math.PI / 2);
  const fillMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false });
  const edgeGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(size, size));
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.55 });
  const postGeo = new THREE.BoxGeometry(0.25, 1.4, 0.25);
  const postMat = new THREE.MeshBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.7 });
  const h = 5.5; // half-size of the lot
  for (const lot of BUILD_LOTS) {
    const fill = new THREE.Mesh(fillGeo, fillMat);
    fill.position.set(lot.x, 0.06, lot.z);
    fill.userData = { isLotMarker: true };
    cityGroup.add(fill);
    const edge = new THREE.LineSegments(edgeGeo, edgeMat);
    edge.position.set(lot.x, 0.07, lot.z);
    edge.userData = { isLotMarker: true };
    cityGroup.add(edge);
    // 4 glowing corner posts = clearly a buildable plot
    for (const [dx, dz] of [[-h,-h],[h,-h],[-h,h],[h,h]]) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(lot.x + dx, 0.7, lot.z + dz);
      post.userData = { isLotMarker: true };
      cityGroup.add(post);
    }
  }
}
