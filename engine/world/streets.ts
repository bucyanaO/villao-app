/**
 * STREETS — tracer une voie.
 *
 * Une seule fonction de pavage utilisée partout (quartiers, avenues
 * d'extension, rues ouvertes par le cabinet d'architectes) pour que toutes les
 * routes de la ville aient la même facture : asphalte, trottoirs, axe en
 * pointillés, lampadaires.
 *
 * `paveStreet` déclare TOUJOURS la voie au cadastre avant de dessiner quoi que
 * ce soit : à partir de cet instant, plus aucun bâtiment ne peut y être posé.
 */
import * as THREE from 'three';
import { CITY_THEME } from '../theme';
import { sharedMaterials, getMaterial } from '../assets';
import { addRoad, addPlot, isBuildable, isClear } from './zoning';

export interface Point { x: number; z: number; }

// géométries partagées par toutes les rues du monde
const DASH_GEO = new THREE.PlaneGeometry(0.22, 2.4);
const POLE_GEO = new THREE.BoxGeometry(0.16, 4.2, 0.16);
const HEAD_GEO = new THREE.BoxGeometry(0.34, 0.12, 0.34);

export interface PaveOptions {
  width?: number;
  /** axe central en pointillés */
  centerLine?: boolean;
  sidewalks?: boolean;
  /** espacement des lampadaires (0 = aucun) */
  lampEvery?: number;
  /** ouvre des parcelles constructibles de part et d'autre */
  plots?: { size: number; step: number; setback: number; label: string };
}

export interface PavedStreet {
  group: THREE.Group;
  a: Point; b: Point;
  angle: number;
  length: number;
  /** parcelles effectivement ouvertes le long de la voie */
  openedPlots: Point[];
}

/**
 * Inscrit une voie au cadastre — SANS créer le moindre mesh.
 *
 * C'est la moitié « registre » du monde streamé : une rue à 3 km du joueur
 * n'est pas dessinée, mais elle existe (on ne peut pas bâtir dessus, et les
 * parcelles qui la bordent restent constructibles).
 */
export function registerStreet(a: Point, b: Point, opts: PaveOptions = {}, owner?: number): Point[] {
  const width = opts.width ?? 10;
  addRoad(a.x, a.z, b.x, b.z, width, owner);

  const opened: Point[] = [];
  if (!opts.plots) return opened;

  const dx = b.x - a.x, dz = b.z - a.z;
  const length = Math.hypot(dx, dz) || 1;
  const ux = dx / length, uz = dz / length;
  const nx = uz, nz = -ux;
  const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
  const { size, step, setback, label } = opts.plots;
  const n = Math.floor((length - size) / step);
  for (let i = 0; i <= n; i++) {
    const t = -length / 2 + size / 2 + i * step;
    for (const s of [-1, 1]) {
      const px = mid.x + ux * t + nx * s * setback;
      const pz = mid.z + uz * t + nz * s * setback;
      if (isBuildable(px, pz, size) && addPlot(px, pz, size, label)) opened.push({ x: px, z: pz });
    }
  }
  return opened;
}

/**
 * Pave une voie de `a` à `b` et retourne le groupe (à ajouter à la scène).
 * Le cadastre est mis à jour en premier (inscription idempotente).
 */
export function paveStreet(a: Point, b: Point, opts: PaveOptions = {}): PavedStreet {
  const width = opts.width ?? 10;
  const dx = b.x - a.x, dz = b.z - a.z;
  const length = Math.hypot(dx, dz) || 1;
  const angle = Math.atan2(dx, dz);
  const ux = dx / length, uz = dz / length;      // le long de la voie
  const nx = uz, nz = -ux;                        // normale (côté trottoir)
  const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };

  // 1. CADASTRE (avant tout dessin)
  addRoad(a.x, a.z, b.x, b.z, width);

  const group = new THREE.Group();
  group.userData = { isStreet: true };

  // 2. chaussée
  const road = new THREE.Mesh(new THREE.PlaneGeometry(width, length), sharedMaterials.roadAsphalt);
  road.rotation.x = -Math.PI / 2;
  road.rotation.z = -angle;
  road.position.set(mid.x, 0.02, mid.z);
  group.add(road);

  // 3. trottoirs
  if (opts.sidewalks !== false) {
    for (const s of [-1, 1]) {
      const sw = new THREE.Mesh(new THREE.PlaneGeometry(3, length), sharedMaterials.sidewalkConcrete);
      sw.rotation.x = -Math.PI / 2;
      sw.rotation.z = -angle;
      sw.position.set(mid.x + nx * s * (width / 2 + 1.5), 0.03, mid.z + nz * s * (width / 2 + 1.5));
      group.add(sw);
    }
  }

  // 4. axe en pointillés — une seule instance pour toute la rue :
  //    un mesh par tiret, c'était 40 appels de dessin par rue.
  if (opts.centerLine !== false) {
    const n = Math.floor(length / 5);
    if (n > 0) {
      const dashes = new THREE.InstancedMesh(DASH_GEO, sharedMaterials.crosswalkWhite, n);
      const dummy = new THREE.Object3D();
      for (let i = 0; i < n; i++) {
        const t = -length / 2 + 2.5 + i * 5;
        dummy.position.set(mid.x + ux * t, 0.045, mid.z + uz * t);
        dummy.rotation.set(-Math.PI / 2, 0, -angle);
        dummy.updateMatrix();
        dashes.setMatrixAt(i, dummy.matrix);
      }
      dashes.instanceMatrix.needsUpdate = true;
      group.add(dashes);
    }
  }

  // 5. lampadaires
  const lampEvery = opts.lampEvery ?? 18;
  if (lampEvery > 0) {
    const poleMat = getMaterial(CITY_THEME.colors.props.lampPost, false);
    const spots: { x: number; z: number }[] = [];
    const count = Math.floor(length / lampEvery);
    for (let i = 0; i <= count; i++) {
      const t = -length / 2 + i * lampEvery + lampEvery / 2;
      if (Math.abs(t) > length / 2 - 2) continue;
      const s = i % 2 === 0 ? 1 : -1;
      spots.push({
        x: mid.x + ux * t + nx * s * (width / 2 + 2.4),
        z: mid.z + uz * t + nz * s * (width / 2 + 2.4),
      });
    }
    if (spots.length) {
      // 2 instances (mâts + luminaires) au lieu de 2 meshes par lampadaire
      const poles = new THREE.InstancedMesh(POLE_GEO, poleMat, spots.length);
      const heads = new THREE.InstancedMesh(HEAD_GEO, sharedMaterials.lampLight, spots.length);
      const dummy = new THREE.Object3D();
      spots.forEach((p, i) => {
        dummy.rotation.set(0, 0, 0);
        dummy.position.set(p.x, 2.1, p.z); dummy.updateMatrix();
        poles.setMatrixAt(i, dummy.matrix);
        dummy.position.set(p.x, 4.15, p.z); dummy.updateMatrix();
        heads.setMatrixAt(i, dummy.matrix);
      });
      poles.instanceMatrix.needsUpdate = true;
      heads.instanceMatrix.needsUpdate = true;
      group.add(poles, heads);
    }
  }

  // 6. parcelles de part et d'autre (inscription idempotente : c'est le même
  //    calcul que `registerStreet`, qu'on ait affiché la rue ou non)
  const openedPlots = registerStreet(a, b, opts);

  return { group, a, b, angle, length, openedPlots };
}

/**
 * Cherche jusqu'où une rue peut être poussée depuis `from` dans une direction,
 * sans traverser ni bâti ni chaussée. Retourne l'extrémité, ou null si le
 * couloir est trop court pour valoir une rue.
 *
 * C'est la contrainte qui fait qu'une voie nouvelle s'insère dans le tissu
 * existant au lieu de le trancher.
 */
export function traceCorridor(
  from: Point,
  angle: number,
  width: number,
  maxLen = 220,
  minLen = 70,
): Point | null {
  const step = 8;
  const sx = Math.sin(angle), sz = Math.cos(angle);
  let reached = 0;
  for (let t = step; t <= maxLen; t += step) {
    const x = from.x + sx * t, z = from.z + sz * t;
    // on tolère les tout premiers mètres : ils sont sur la rue d'origine
    const clearance = width / 2 + 3;
    if (t > width && !isClear(x, z, clearance)) break;
    reached = t;
  }
  if (reached < minLen) return null;
  return { x: from.x + sx * reached, z: from.z + sz * reached };
}

/**
 * Le corridor entre deux points est-il libre ? (bâti existant, pas la voirie)
 *
 * Sert à décider si une liaison routière peut être tracée : sans ce contrôle,
 * une rocade tirée « au cordeau » traverserait les quartiers déjà construits.
 */
export function isCorridorClear(a: Point, b: Point, width = 10, margin = 12): boolean {
  const dx = b.x - a.x, dz = b.z - a.z;
  const len = Math.hypot(dx, dz);
  if (len < 1) return false;
  const ux = dx / len, uz = dz / len;
  for (let t = margin; t <= len - margin; t += 8) {
    if (!isClear(a.x + ux * t, a.z + uz * t, width / 2 + 2)) return false;
  }
  return true;
}

/** Petite place pavée (carrefour, parvis) — purement décorative. */
export function paveSquare(center: Point, size: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), sharedMaterials.sidewalkConcrete);
  m.rotation.x = -Math.PI / 2;
  m.position.set(center.x, 0.035, center.z);
  return m;
}
