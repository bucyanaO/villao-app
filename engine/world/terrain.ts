/**
 * TERRAIN — le sol et la forêt, à l'infini.
 *
 * Le monde n'a pas de bord : le sol est une grille de tuiles engendrées autour
 * du joueur et détruites derrière lui. Chaque tuile porte son couvert végétal,
 * semé de façon DÉTERMINISTE (graine = coordonnées de la tuile) : on peut
 * revenir sur ses pas, la forêt est la même.
 *
 * La densité n'est pas décidée « à la main » : un arbre pousse là où le
 * cadastre dit que le sol est libre (`isClear`), et il pousse plus dru quand
 * aucune route n'est proche. Résultat : clairsemé en ville, dense dès qu'on
 * s'en éloigne, sans qu'aucune limite ne soit jamais visible.
 *
 * Le lointain est mangé par le brouillard volumétrique (`haze.ts`), qui cache
 * la frontière de génération.
 */
import * as THREE from 'three';
import { CITY_THEME } from '../theme';
import { isClear, roadsNear } from './zoning';
import { makeRng } from './rng';

const TILE = 300;              // côté d'une tuile (m)
const KEEP_RING = 2;           // tuiles chargées autour du joueur (5×5 = 1,5 km)
const DROP_RING = 3;           // au-delà, on décharge
const TREES_PER_TILE = 260;    // tentatives (filtrées par le cadastre)
const BUILD_BUDGET = 3;        // tuiles semées au maximum par passage

const groundMat = new THREE.MeshBasicMaterial({ color: 0x16240f, side: THREE.DoubleSide });
const groundFarMat = new THREE.MeshBasicMaterial({ color: 0x111d0d, side: THREE.DoubleSide });
const trunkMat = new THREE.MeshBasicMaterial({ color: 0x3f2d26 });
const foliageMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });
const rockMat = new THREE.MeshBasicMaterial({ color: 0x1b2e1c });

const coneGeo = new THREE.ConeGeometry(0.5, 1, 6);
const blobGeo = new THREE.IcosahedronGeometry(0.5, 0);
const trunkGeo = new THREE.BoxGeometry(1, 1, 1);
const rockGeo = new THREE.IcosahedronGeometry(1, 0);

export interface Terrain {
  update(player: { x: number; z: number }): void;
  /** À appeler quand on bâtit : les tuiles touchées sont resemées (sinon des arbres resteraient dans les murs). */
  invalidate(x: number, z: number, radius?: number): void;
  dispose(): void;
  tileCount(): number;
}

const key = (i: number, j: number) => `${i}:${j}`;

export function createTerrain(scene: THREE.Object3D): Terrain {
  const tiles = new Map<string, THREE.Group>();

  const buildTile = (i: number, j: number): THREE.Group => {
    const g = new THREE.Group();
    g.userData = { isTerrain: true, tile: key(i, j) };
    const cx = i * TILE, cz = j * TILE;
    const rng = makeRng((i * 73856093) ^ (j * 19349663));

    // sol
    const far = Math.abs(i) + Math.abs(j) > 2;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(TILE, TILE), far ? groundFarMat : groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(cx, -0.08, cz);
    g.add(ground);

    // Couvert végétal : palette STRICTEMENT verte. Les feuillages fluo du thème
    // sont réservés aux arbres « holographiques » de la ville — la forêt, elle,
    // doit rester une forêt.
    const palette: number[] = CITY_THEME.colors.props.greenFoliage || [0x2e8b57];
    const trunks: THREE.Matrix4[] = [];
    const cones: { m: THREE.Matrix4; c: number }[] = [];
    const blobs: { m: THREE.Matrix4; c: number }[] = [];
    const rocks: THREE.Matrix4[] = [];
    const dummy = new THREE.Object3D();

    for (let n = 0; n < TREES_PER_TILE; n++) {
      const x = cx + rng.range(-TILE / 2, TILE / 2);
      const z = cz + rng.range(-TILE / 2, TILE / 2);
      // le cadastre a le dernier mot : jamais sur une route ni sur du bâti
      if (!isClear(x, z, 9)) continue;
      // les abords immédiats des rues appartiennent à la ville (alignements,
      // trottoirs, jardins) : la forêt sauvage n'y pousse pas
      if (roadsNear({ x, z }, 34).length > 0) continue;
      // puis : clairsemée autour de la ville, drue dès qu'on s'en éloigne
      if (roadsNear({ x, z }, 160).length > 0 && !rng.chance(0.12)) continue;
      // clairières : de grandes respirations dans la masse
      if (Math.sin(x * 0.013) * Math.cos(z * 0.011) > 0.72) continue;

      const scale = rng.range(0.9, 2.4);
      const trunkH = 2.2 * scale;
      const color = rng.pick(palette);

      dummy.position.set(x, trunkH / 2, z);
      dummy.scale.set(0.45 * scale, trunkH, 0.45 * scale);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      trunks.push(dummy.matrix.clone());

      if (rng.chance(0.55)) {
        let y = trunkH * 0.75;
        for (let l = 0; l < 3; l++) {
          const w = (4 - l) * 0.85 * scale;
          const h = 1.6 * scale;
          dummy.position.set(x, y + h / 2, z);
          dummy.scale.set(w, h, w);
          dummy.rotation.set(0, rng.range(0, Math.PI), 0);
          dummy.updateMatrix();
          cones.push({ m: dummy.matrix.clone(), c: color });
          y += h * 0.62;
        }
      } else {
        const size = rng.range(2.2, 3.8) * scale;
        dummy.position.set(x, trunkH + size * 0.35, z);
        dummy.scale.set(size, size * rng.range(0.75, 1.25), size);
        dummy.rotation.set(rng.range(0, 1), rng.range(0, Math.PI), rng.range(0, 0.4));
        dummy.updateMatrix();
        blobs.push({ m: dummy.matrix.clone(), c: color });
      }
    }

    // buttes lointaines : uniquement en pleine nature, pour la silhouette
    for (let n = 0; n < 5; n++) {
      const x = cx + rng.range(-TILE / 2, TILE / 2);
      const z = cz + rng.range(-TILE / 2, TILE / 2);
      if (!isClear(x, z, 22) || roadsNear({ x, z }, 260).length > 0) continue;
      const s = rng.range(10, 26);
      dummy.position.set(x, s * 0.3, z);
      dummy.scale.set(s, s * rng.range(0.5, 1.1), s);
      dummy.rotation.set(rng.range(0, 0.4), rng.range(0, Math.PI), rng.range(0, 0.4));
      dummy.updateMatrix();
      rocks.push(dummy.matrix.clone());
    }

    const addInstanced = (geo: THREE.BufferGeometry, mat: THREE.Material, mats: THREE.Matrix4[], colors?: number[]) => {
      if (!mats.length) return;
      const im = new THREE.InstancedMesh(geo, mat, mats.length);
      const col = new THREE.Color();
      mats.forEach((m, idx) => {
        im.setMatrixAt(idx, m);
        if (colors) im.setColorAt(idx, col.setHex(colors[idx]));
      });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.frustumCulled = true;
      g.add(im);
    };
    addInstanced(trunkGeo, trunkMat, trunks);
    addInstanced(coneGeo, foliageMat, cones.map((c) => c.m), cones.map((c) => c.c));
    addInstanced(blobGeo, foliageMat, blobs.map((c) => c.m), blobs.map((c) => c.c));
    addInstanced(rockGeo, rockMat, rocks);

    scene.add(g);
    return g;
  };

  /**
   * Libère une tuile. Les géométries partagées (arbres, rochers) ne sont jamais
   * détruites, mais le sol et surtout les tampons d'instances le sont : sans
   * cela, une longue session accumule des mégaoctets sur la carte graphique et
   * finit par faire perdre le contexte WebGL — écran noir.
   */
  const disposeTile = (g: THREE.Group) => {
    g.traverse((c: any) => {
      if (c.isInstancedMesh) c.dispose();
      if (c.geometry && c.geometry !== coneGeo && c.geometry !== blobGeo
          && c.geometry !== trunkGeo && c.geometry !== rockGeo) {
        c.geometry.dispose();
      }
    });
    g.parent?.remove(g);
  };

  return {
    update(player) {
      const pi = Math.round(player.x / TILE);
      const pj = Math.round(player.z / TILE);

      // On sème au plus quelques tuiles par passage, les plus proches d'abord :
      // semer 25 tuiles d'un coup ferait tomber une image. Le brouillard couvre
      // largement le temps qu'il faut pour compléter la couronne.
      const missing: { i: number; j: number; d: number }[] = [];
      for (let i = pi - KEEP_RING; i <= pi + KEEP_RING; i++) {
        for (let j = pj - KEEP_RING; j <= pj + KEEP_RING; j++) {
          if (tiles.has(key(i, j))) continue;
          missing.push({ i, j, d: (i - pi) ** 2 + (j - pj) ** 2 });
        }
      }
      missing.sort((a, b) => a.d - b.d);
      for (const m of missing.slice(0, BUILD_BUDGET)) tiles.set(key(m.i, m.j), buildTile(m.i, m.j));
      for (const [kk, g] of [...tiles]) {
        const [i, j] = kk.split(':').map(Number);
        if (Math.abs(i - pi) > DROP_RING || Math.abs(j - pj) > DROP_RING) {
          disposeTile(g);
          tiles.delete(kk);
        }
      }
    },
    invalidate(x, z, radius = 60) {
      const i0 = Math.round((x - radius) / TILE), i1 = Math.round((x + radius) / TILE);
      const j0 = Math.round((z - radius) / TILE), j1 = Math.round((z + radius) / TILE);
      for (let i = i0; i <= i1; i++) {
        for (let j = j0; j <= j1; j++) {
          const kk = key(i, j);
          const g = tiles.get(kk);
          if (!g) continue;
          disposeTile(g);
          tiles.delete(kk);   // resemée à la prochaine mise à jour, cadastre à jour
        }
      }
    },
    dispose() {
      for (const [, g] of tiles) disposeTile(g);
      tiles.clear();
    },
    tileCount: () => tiles.size,
  };
}

/**
 * Le terrain doit être régénéré quand le cadastre change beaucoup (nouvelle
 * ville) : on jette tout, la prochaine mise à jour resème.
 */
export function resetTerrain(terrain: Terrain, player: { x: number; z: number }): void {
  terrain.dispose();
  terrain.update(player);
}
