/**
 * ZONING — le cadastre de la ville.
 *
 * Un seul registre partagé qui sait, à tout instant :
 *  - où passent les ROUTES (segments avec largeur)   → on ne construit jamais dessus
 *  - ce qui est déjà OCCUPÉ (empreintes de bâtiments, parcs, places)
 *  - quelles PARCELLES sont libres et constructibles
 *
 * Tout ce qui construit (générateur de ville, quartiers, cabinet d'architectes,
 * God Mode « BUILD ») passe par `resolveBuildSite()` : une position demandée
 * n'importe où est ramenée sur la parcelle légale libre la plus proche. C'est ce
 * qui empêche les « maisons au milieu de la rue ».
 *
 * Deux propriétés indispensables au monde persistant/streamé :
 *  - chaque inscription porte un PROPRIÉTAIRE (l'acte du registre) ;
 *  - les inscriptions sont IDEMPOTENTES : rejouer un quartier ne duplique rien,
 *    et un acte peut ignorer ses propres empreintes quand il se reconstruit.
 */
import * as THREE from 'three';

export interface RoadSeg { x1: number; z1: number; x2: number; z2: number; w: number; owner?: number; }
export interface Footprint { x: number; z: number; r: number; owner?: number; }
export interface Plot { x: number; z: number; size: number; used: boolean; district: string; }

interface ZoningState {
  style: string;
  roads: RoadSeg[];
  occupied: Footprint[];
  plots: Plot[];
  keys: Set<string>;
  /** Index spatial : sans lui, chaque question au cadastre coûterait de plus en
   *  plus cher à mesure que la ville s'étend — et un monde infini deviendrait
   *  vite injouable. */
  roadCells: Map<string, RoadSeg[]>;
  occCells: Map<string, Footprint[]>;
  maxRoadW: number;
  maxFootR: number;
  /** Rayon urbanisé actuel (utilisé par la forêt et l'expansion). */
  cityRadius: number;
}

/** Côté d'une cellule d'index (m). */
const CELL = 64;
const HALF_DIAG = CELL * Math.SQRT1_2;

const Z: ZoningState = {
  style: '', roads: [], occupied: [], plots: [], keys: new Set(),
  roadCells: new Map(), occCells: new Map(), maxRoadW: 0, maxFootR: 0,
  cityRadius: 60,
};

export function resetZoning(style: string, cityRadius = 60): void {
  Z.style = style;
  Z.roads = [];
  Z.occupied = [];
  Z.plots = [];
  Z.keys.clear();
  Z.roadCells.clear();
  Z.occCells.clear();
  Z.maxRoadW = 0;
  Z.maxFootR = 0;
  Z.cityRadius = cityRadius;
}

const cellKey = (i: number, j: number) => `${i},${j}`;
const cellIndex = (v: number) => Math.floor(v / CELL);

/** Parcourt les cellules d'une boîte autour d'un point. */
function forEachCell(x: number, z: number, reach: number, fn: (key: string) => void): void {
  const i0 = cellIndex(x - reach), i1 = cellIndex(x + reach);
  const j0 = cellIndex(z - reach), j1 = cellIndex(z + reach);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) fn(cellKey(i, j));
}

/**
 * Le joueur tient de la place. Sans cette réserve, le cabinet d'architectes
 * finit par bâtir exactement là où l'on se tient : on se retrouve enfermé dans
 * la maçonnerie, écran noir. Elle suit le joueur et n'interdit que la
 * construction — les passants, eux, peuvent toujours nous approcher.
 */
let reserve: { x: number; z: number; r: number } | null = null;
export function setPlayerReserve(x: number, z: number, r = 9): void { reserve = { x, z, r }; }

export function zoningStyle(): string { return Z.style; }
export function cityRadius(): number { return Z.cityRadius; }
export function setCityRadius(r: number): void { Z.cityRadius = Math.max(Z.cityRadius, r); }

const k = (...parts: (string | number)[]) => parts.map((p) => typeof p === 'number' ? p.toFixed(1) : p).join('|');
/** Retourne false si la clé existait déjà (inscription ignorée). */
function once(key: string): boolean {
  if (Z.keys.has(key)) return false;
  Z.keys.add(key);
  return true;
}

// --- Déclaration du terrain -------------------------------------------------

function distToSeg(px: number, pz: number, s: RoadSeg): number {
  const dx = s.x2 - s.x1, dz = s.z2 - s.z1;
  const l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - s.x1) * dx + (pz - s.z1) * dz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = s.x1 + t * dx, cz = s.z1 + t * dz;
  return Math.hypot(px - cx, pz - cz);
}


export function addRoad(x1: number, z1: number, x2: number, z2: number, w: number, owner?: number): void {
  if (!once(k('r', x1, z1, x2, z2, w))) return;
  const seg: RoadSeg = { x1, z1, x2, z2, w, owner };
  Z.roads.push(seg);
  Z.maxRoadW = Math.max(Z.maxRoadW, w);
  // index : toute cellule dont le centre est à portée du tronçon
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  const minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
  const reach = w / 2 + HALF_DIAG;
  for (let i = cellIndex(minX - reach); i <= cellIndex(maxX + reach); i++) {
    for (let j = cellIndex(minZ - reach); j <= cellIndex(maxZ + reach); j++) {
      const cx = i * CELL + CELL / 2, cz = j * CELL + CELL / 2;
      if (distToSeg(cx, cz, seg) > reach) continue;
      const k2 = cellKey(i, j);
      const list = Z.roadCells.get(k2);
      if (list) list.push(seg); else Z.roadCells.set(k2, [seg]);
    }
  }
  // Une voie nouvelle peut traverser des parcelles déjà ouvertes : on les
  // déclasse immédiatement. Sinon on bâtirait, plus tard, en pleine chaussée.
  for (const p of Z.plots) {
    if (p.used) continue;
    if (distToSeg(p.x, p.z, seg) < w / 2 + p.size / 2 + 1.5) p.used = true;
  }
}

/** Route droite centrée en (x,z), le long d'un axe. */
export function addRoadAxis(axis: 'x' | 'z', constant: number, from: number, to: number, w: number, owner?: number): void {
  if (axis === 'z') addRoad(constant, from, constant, to, w, owner);
  else addRoad(from, constant, to, constant, w, owner);
}

/** Anneau routier (approximé par des segments). */
export function addRoadRing(cx: number, cz: number, radius: number, w: number, segments = 24, owner?: number): void {
  for (let i = 0; i < segments; i++) {
    const a1 = (i / segments) * Math.PI * 2;
    const a2 = ((i + 1) / segments) * Math.PI * 2;
    addRoad(cx + Math.sin(a1) * radius, cz + Math.cos(a1) * radius, cx + Math.sin(a2) * radius, cz + Math.cos(a2) * radius, w, owner);
  }
}

/** Marque une empreinte occupée (bâtiment, parc, place, statue…). */
export function occupy(x: number, z: number, r: number, owner?: number): void {
  if (!once(k('o', owner ?? 0, x, z, r))) return;
  const f: Footprint = { x, z, r, owner };
  Z.occupied.push(f);
  Z.maxFootR = Math.max(Z.maxFootR, r);
  forEachCell(x, z, r + HALF_DIAG, (key) => {
    const list = Z.occCells.get(key);
    if (list) list.push(f); else Z.occCells.set(key, [f]);
  });
}

/** Déclare une parcelle constructible (si elle est légale). */
export function addPlot(x: number, z: number, size = 13, district = 'centre'): boolean {
  if (!isBuildable(x, z, size)) return false;
  if (!once(k('p', x, z))) return false;
  Z.plots.push({ x, z, size, used: false, district });
  return true;
}

// --- Interrogation ----------------------------------------------------------


/** Vrai si (x,z) est sur la chaussée (avec une marge de sécurité). */
export function isOnRoad(x: number, z: number, margin = 0): boolean {
  let hit = false;
  forEachCell(x, z, margin + Z.maxRoadW / 2, (key) => {
    if (hit) return;
    const list = Z.roadCells.get(key);
    if (!list) return;
    for (const s of list) {
      if (distToSeg(x, z, s) < s.w / 2 + margin) { hit = true; return; }
    }
  });
  return hit;
}

/** Empreintes susceptibles de toucher un disque donné (via l'index). */
function occupiedNear(x: number, z: number, reach: number): Footprint[] {
  const out: Footprint[] = [];
  const seen = new Set<Footprint>();
  forEachCell(x, z, reach + Z.maxFootR, (key) => {
    const list = Z.occCells.get(key);
    if (!list) return;
    for (const f of list) if (!seen.has(f)) { seen.add(f); out.push(f); }
  });
  return out;
}

/**
 * Vrai si l'emprise carrée `size` centrée en (x,z) est libre de route ET
 * d'occupation. `ignoreOwner` permet à un acte de se reconstruire à l'identique
 * en ignorant ses propres empreintes déjà inscrites.
 */
export function isBuildable(x: number, z: number, size = 13, ignoreOwner?: number): boolean {
  const half = size / 2;
  if (reserve && Math.hypot(x - reserve.x, z - reserve.z) < half + reserve.r) return false;
  if (isOnRoad(x, z, half + 1.5)) return false;
  for (const f of occupiedNear(x, z, half)) {
    if (ignoreOwner !== undefined && f.owner === ignoreOwner) continue;
    if (Math.hypot(x - f.x, z - f.z) < f.r + half) return false;
  }
  return true;
}

export function plots(): readonly Plot[] { return Z.plots; }
export function freePlots(): Plot[] { return Z.plots.filter((p) => !p.used); }

/** Parcelle libre la plus proche d'une cible (optionnellement dans un rayon). */
export function nearestFreePlot(target: { x: number; z: number }, maxDist = Infinity): Plot | null {
  let best: Plot | null = null;
  let bestD = maxDist * maxDist;
  for (const p of Z.plots) {
    if (p.used) continue;
    const d = (p.x - target.x) ** 2 + (p.z - target.z) ** 2;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

export function plotIndex(plot: Plot): number { return Z.plots.indexOf(plot); }

/** Consomme les parcelles libres couvertes par une nouvelle emprise. */
export function consumePlotsAt(x: number, z: number, r: number): void {
  for (const p of Z.plots) {
    if (p.used) continue;
    if (Math.hypot(p.x - x, p.z - z) < r + p.size / 2) p.used = true;
  }
}

/** Réserve une parcelle (et l'inscrit comme occupée). */
export function claimPlot(plot: Plot, owner?: number): void {
  plot.used = true;
  occupy(plot.x, plot.z, plot.size / 2, owner);
}

/**
 * Ramène une position demandée sur un site LÉGAL et le réserve.
 * 1. si la position demandée est constructible → on la garde (et on la réserve)
 * 2. sinon → parcelle libre déclarée la plus proche
 * 3. sinon → recherche en spirale autour de la demande
 * 4. sinon → null (rien de constructible : l'appelant doit renoncer)
 */
export function resolveBuildSite(desired: { x: number; z: number }, size = 13, owner?: number): { x: number; z: number } | null {
  if (isBuildable(desired.x, desired.z, size, owner)) {
    occupy(desired.x, desired.z, size / 2, owner);
    const p = Z.plots.find((q) => !q.used && Math.hypot(q.x - desired.x, q.z - desired.z) < q.size / 2);
    if (p) p.used = true;
    return { x: desired.x, z: desired.z };
  }

  const near = nearestFreePlot(desired);
  if (near && Math.hypot(near.x - desired.x, near.z - desired.z) < 220) {
    claimPlot(near, owner);
    return { x: near.x, z: near.z };
  }

  for (let ring = 1; ring <= 14; ring++) {
    const r = ring * 8;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + ring * 0.37;
      const x = desired.x + Math.cos(a) * r;
      const z = desired.z + Math.sin(a) * r;
      if (isBuildable(x, z, size, owner)) {
        occupy(x, z, size / 2, owner);
        return { x, z };
      }
    }
  }
  return null;
}

/** Les tronçons de voirie proches d'un point (pour bâtir « sur rue »). */
export function roadsNear(p: { x: number; z: number }, radius: number): RoadSeg[] {
  const out: RoadSeg[] = [];
  const seen = new Set<RoadSeg>();
  forEachCell(p.x, p.z, radius, (key) => {
    const list = Z.roadCells.get(key);
    if (!list) return;
    for (const s of list) {
      if (seen.has(s)) continue;
      seen.add(s);
      if (distToSeg(p.x, p.z, s) < radius) out.push(s);
    }
  });
  return out;
}

/**
 * Extrémités du réseau viaire proches d'un point, avec la direction de la voie.
 *
 * C'est de là que partent naturellement les rues nouvelles : on PROLONGE le
 * réseau (ou on s'y greffe en équerre) plutôt que d'essayer de percer à travers
 * un tissu déjà bâti.
 */
export function roadEndpointsNear(p: { x: number; z: number }, radius: number): { x: number; z: number; angle: number }[] {
  const out: { x: number; z: number; angle: number }[] = [];
  for (const s of roadsNear(p, radius + 40)) {
    const angle = Math.atan2(s.x2 - s.x1, s.z2 - s.z1);
    if (Math.hypot(s.x1 - p.x, s.z1 - p.z) < radius) out.push({ x: s.x1, z: s.z1, angle: angle + Math.PI });
    if (Math.hypot(s.x2 - p.x, s.z2 - p.z) < radius) out.push({ x: s.x2, z: s.z2, angle });
  }
  return out;
}

/**
 * Le point est-il sur du BÂTI ? (les routes, elles, sont ignorées : une voie a
 * parfaitement le droit d'en croiser une autre — pas de passer sur une maison.)
 */
export function isBuilt(x: number, z: number, margin = 0, ignoreOwner?: number): boolean {
  for (const f of occupiedNear(x, z, margin)) {
    if (ignoreOwner !== undefined && f.owner === ignoreOwner) continue;
    if (Math.hypot(x - f.x, z - f.z) < f.r + margin) return true;
  }
  return false;
}

/** Le point est-il dégagé (ni bâti, ni chaussée) avec cette marge ? */
export function isClear(x: number, z: number, clearance = 2.5): boolean {
  if (isOnRoad(x, z, clearance)) return false;
  for (const f of occupiedNear(x, z, clearance)) {
    if (Math.hypot(x - f.x, z - f.z) < f.r + clearance) return false;
  }
  return true;
}

/**
 * Point le plus proche du réseau viaire existant.
 * Une rue nouvelle part TOUJOURS d'une rue existante : c'est ce qui garantit
 * qu'on obtient un réseau connecté et pas des tronçons orphelins.
 */
export function nearestRoadPoint(p: { x: number; z: number }, searchRadius = 400): { x: number; z: number; angle: number } | null {
  let best: { x: number; z: number; angle: number } | null = null;
  let bestD = Infinity;
  for (const s of roadsNear(p, searchRadius)) {
    const dx = s.x2 - s.x1, dz = s.z2 - s.z1;
    const l2 = dx * dx + dz * dz;
    let t = l2 > 0 ? ((p.x - s.x1) * dx + (p.z - s.z1) * dz) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = s.x1 + t * dx, cz = s.z1 + t * dz;
    const d = Math.hypot(p.x - cx, p.z - cz);
    if (d < bestD) { bestD = d; best = { x: cx, z: cz, angle: Math.atan2(dx, dz) }; }
  }
  return best;
}

/** Point au sol libre le plus proche (pour poser un PNJ sans le mettre dans un mur). */
export function findOpenGround(desired: { x: number; z: number }, clearance = 2.5): { x: number; z: number } {
  const free = (x: number, z: number) => isClear(x, z, clearance);
  if (free(desired.x, desired.z)) return { x: desired.x, z: desired.z };
  for (let ring = 1; ring <= 12; ring++) {
    const r = ring * 3;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + ring * 0.5;
      const x = desired.x + Math.cos(a) * r;
      const z = desired.z + Math.sin(a) * r;
      if (free(x, z)) return { x, z };
    }
  }
  return { x: desired.x, z: desired.z };
}

// --- Visualisation ----------------------------------------------------------

let markerGroup: THREE.Group | null = null;
let lastNear = { x: 0, z: 0 };

/** Nombre max de parcelles balisées : au-delà, l'écran devient un damier vert. */
const MAX_MARKERS = 8;

/**
 * Dessine les parcelles LIBRES (discrètement) — les terrains où l'on peut bâtir.
 * Seules les plus proches du point de référence sont balisées.
 */
export function drawPlotMarkers(cityGroup: THREE.Group, near: { x: number; z: number } = lastNear): void {
  lastNear = near;
  if (markerGroup && markerGroup.parent) markerGroup.parent.remove(markerGroup);
  markerGroup = new THREE.Group();
  markerGroup.userData = { isLotMarker: true };

  const fillMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.35 });
  const postMat = new THREE.MeshBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.5 });
  const postGeo = new THREE.BoxGeometry(0.2, 1.1, 0.2);

  const shown = freePlots()
    .sort((a, b) => ((a.x - near.x) ** 2 + (a.z - near.z) ** 2) - ((b.x - near.x) ** 2 + (b.z - near.z) ** 2))
    .slice(0, MAX_MARKERS);

  for (const plot of shown) {
    const s = plot.size;
    const fillGeo = new THREE.PlaneGeometry(s, s); fillGeo.rotateX(-Math.PI / 2);
    const fill = new THREE.Mesh(fillGeo, fillMat);
    fill.position.set(plot.x, 0.06, plot.z);
    markerGroup.add(fill);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(fillGeo), edgeMat);
    edge.position.set(plot.x, 0.07, plot.z);
    markerGroup.add(edge);
    const h = s / 2;
    for (const [dx, dz] of [[-h, -h], [h, -h], [-h, h], [h, h]]) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(plot.x + dx, 0.55, plot.z + dz);
      markerGroup.add(post);
    }
  }
  cityGroup.add(markerGroup);
}

/** Rafraîchit les repères (après une construction). */
export function refreshPlotMarkers(cityGroup: THREE.Group, near?: { x: number; z: number }): void {
  if (markerGroup) drawPlotMarkers(cityGroup, near ?? lastNear);
}
