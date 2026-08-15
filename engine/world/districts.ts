/**
 * DISTRICTS — les quartiers procéduraux qui font grandir la ville.
 *
 * Chaque quartier est une « page » d'un catalogue d'architectures : faubourg,
 * tours de verre, vieille ville, jardins, zone industrielle (usines, entrepôts,
 * ateliers), cité béton, quartier futuriste, mégastructure. En avançant, on
 * traverse donc une anthologie de styles plutôt qu'une grille répétée.
 *
 * Deux garanties structurelles :
 *  - la rue est déclarée au cadastre AVANT de poser le moindre mur, et chaque
 *    bâtiment passe par `resolveBuildSite` : rien ne peut atterrir sur la voirie ;
 *  - tout est tiré d'un `Rng` de graine connue : le quartier se reconstruit à
 *    l'identique au rechargement (cf. `ledger.ts`).
 */
import * as THREE from 'three';
import { CITY_THEME } from '../theme';
import { CityAssets, InhabitantState, sharedMaterials, getMaterial } from '../assets';
import type { AnimState } from '../context';
import { occupy, addPlot, isBuildable, addRoad } from './zoning';
import { paveStreet } from './streets';
import { makeSignPost } from './signage';
import { createProgram, PROGRAM_FOOTPRINT, type ProgramKind } from './programs';
import { makeRng, type Rng } from './rng';

export type DistrictTheme =
  | 'faubourg' | 'tours' | 'vieille-ville' | 'industriel'
  | 'jardins' | 'brutaliste' | 'futuriste' | 'megastructure';

export const DISTRICT_THEMES: DistrictTheme[] = [
  'faubourg', 'tours', 'vieille-ville', 'jardins',
  'industriel', 'brutaliste', 'futuriste', 'megastructure',
];

export const DISTRICT_LABEL: Record<DistrictTheme, string> = {
  faubourg: 'Faubourg', tours: 'Quartier des Tours', 'vieille-ville': 'Vieille Ville',
  industriel: 'Zone Industrielle', jardins: 'Les Jardins', brutaliste: 'Cité Béton',
  futuriste: 'Nouveau Monde', megastructure: 'La Mégastructure',
};

/** Ce qu'on bâtit dans chaque quartier : un programme, ou une forme signature. */
type Slot = ProgramKind | 'F:oldtown' | 'F:brutal' | 'F:futur' | 'F:mega';

const THEME_MIX: Record<DistrictTheme, Slot[]> = {
  faubourg: ['maison', 'maison', 'maison', 'boulangerie', 'magasin', 'ecole', 'parc', 'cafe'],
  tours: ['bureau', 'bureau', 'immeuble', 'hotel', 'banque', 'cafe', 'clinique'],
  'vieille-ville': ['F:oldtown', 'F:oldtown', 'magasin', 'boulangerie', 'cafe', 'marche', 'musee', 'atelier'],
  industriel: ['usine', 'entrepot', 'entrepot', 'atelier', 'usine', 'station_service'],
  jardins: ['parc', 'maison', 'parc', 'ferme', 'magasin', 'ecole', 'bibliotheque'],
  brutaliste: ['F:brutal', 'F:brutal', 'immeuble', 'clinique', 'magasin', 'poste', 'cinema'],
  futuriste: ['F:futur', 'F:futur', 'bureau', 'telecom', 'magasin', 'parc'],
  megastructure: ['F:mega', 'F:futur', 'bureau', 'gare', 'entrepot', 'immeuble'],
};

export interface DistrictResult {
  group: THREE.Group;
  center: { x: number; z: number };
  radius: number;
  theme: DistrictTheme;
}

const STREET_W = 10;
const HALF = 48;             // demi-taille d'un quartier

/** Emprise des formes signature (les programmes ont leur propre table). */
const FORM_FOOTPRINT: Record<string, number> = {
  'F:oldtown': 16, 'F:brutal': 24, 'F:futur': 22, 'F:mega': 36,
};
const slotFootprint = (s: Slot): number =>
  FORM_FOOTPRINT[s] ?? PROGRAM_FOOTPRINT[s as ProgramKind] ?? 20;

/** Trame d'un quartier : pas entre bâtiments et recul par rapport à la rue. */
const THEME_GRID: Record<DistrictTheme, { step: number; row: number }> = {
  faubourg: { step: 26, row: 18 }, tours: { step: 30, row: 20 },
  'vieille-ville': { step: 22, row: 15 }, jardins: { step: 30, row: 20 },
  industriel: { step: 42, row: 30 }, brutaliste: { step: 30, row: 22 },
  futuriste: { step: 30, row: 20 }, megastructure: { step: 42, row: 28 },
};

/**
 * PLAN d'un quartier — pur, déterministe, sans aucun objet 3D.
 *
 * Le plan est la vérité : il alimente le cadastre (routes + emprises) même
 * quand le quartier est trop loin pour être matérialisé. C'est ce qui garantit
 * qu'au retour, le quartier se reconstruit EXACTEMENT à l'identique.
 */
export interface DistrictPlan {
  actId: number;
  center: { x: number; z: number };
  angle: number;
  theme: DistrictTheme;
  seed: number;
  streets: { a: { x: number; z: number }; b: { x: number; z: number }; w: number }[];
  slots: { x: number; z: number; kind: Slot; footprint: number; face: number; level: number; skip?: boolean }[];
  freeSlots: { x: number; z: number }[];
}

export function planDistrict(args: {
  center: { x: number; z: number }; angle: number; theme: DistrictTheme; seed: number; actId: number;
}): DistrictPlan {
  const { center, angle, theme, seed, actId } = args;
  const rng = makeRng(seed);
  const fx = Math.sin(angle), fz = Math.cos(angle);
  const sx = Math.cos(angle), sz = -Math.sin(angle);
  const { step, row: rowOffset } = THEME_GRID[theme];
  const mix = THEME_MIX[theme];

  const streets = [
    { a: { x: center.x - fx * HALF, z: center.z - fz * HALF }, b: { x: center.x + fx * HALF, z: center.z + fz * HALF }, w: STREET_W },
    { a: { x: center.x - sx * 34, z: center.z - sz * 34 }, b: { x: center.x + sx * 34, z: center.z + sz * 34 }, w: 9 },
  ];

  const perRow = Math.max(2, Math.floor((HALF * 2 - 10) / step));
  const slots: DistrictPlan['slots'] = [];
  const freeSlots: DistrictPlan['freeSlots'] = [];
  let n = 0;
  for (const row of [-1, 1]) {
    for (let i = 0; i < perRow; i++) {
      const t = -HALF + step / 2 + 5 + i * step;
      const x = center.x + fx * t + sx * row * rowOffset;
      const z = center.z + fz * t + sz * row * rowOffset;
      // une dent laissée libre par rangée : le cabinet d'architectes viendra
      // la remplir plus tard — le quartier continue de se densifier.
      if (n % 4 === 3) { freeSlots.push({ x, z }); n++; continue; }
      const kind = mix[rng.int(0, mix.length - 1)];
      slots.push({ x, z, kind, footprint: slotFootprint(kind), face: row, level: rng.int(2, 4) });
      n++;
    }
  }

  return { actId, center, angle, theme, seed, streets, slots, freeSlots };
}

/**
 * Inscrit le plan au cadastre (routes, emprises, parcelles libres) SANS créer
 * un seul mesh. Appelé pour tous les quartiers du registre, y compris ceux qui
 * sont trop loin pour être affichés.
 */
export function registerDistrictPlan(plan: DistrictPlan): void {
  for (const s of plan.streets) addRoad(s.a.x, s.a.z, s.b.x, s.b.z, s.w, plan.actId);
  occupy(plan.center.x, plan.center.z, 6, plan.actId);
  for (const slot of plan.slots) {
    if (!isBuildable(slot.x, slot.z, slot.footprint, plan.actId)) { slot.skip = true; continue; }
    occupy(slot.x, slot.z, slot.footprint / 2, plan.actId);
  }
  for (const f of plan.freeSlots) addPlot(f.x, f.z, 14, DISTRICT_LABEL[plan.theme]);
}

interface Form { group: THREE.Group; footprint: number; inhabitants: THREE.Group[]; }

const box = (w: number, h: number, d: number, color: number, opacity = 0.5, shape: any = 'box') =>
  CityAssets.primitives.createWireframeObject(w, h, d, color, opacity, shape);

// --- Formes signature (celles qui n'ont pas d'équivalent « programme ») ------

function oldTownHouse(rng: Rng): Form {
  const g = new THREE.Group();
  const inhabitants: THREE.Group[] = [];
  const w = rng.range(6, 8), d = rng.range(7, 9);
  const floors = rng.int(3, 5);
  const wallColor = rng.pick([0xd8c8a0, 0xc8a884, 0xb9a37e, 0xa88f6d]);
  for (let i = 0; i < floors; i++) {
    // encorbellement : les étages débordent progressivement sur la rue
    const fw = w + i * 0.35, fd = d + i * 0.25;
    const f = box(fw, 3.1, fd, wallColor, 0.6);
    f.position.y = i * 3.1 + 1.55;
    g.add(f);
    if (i > 0) {
      const balc = CityAssets.Architecture.createBalcony(fw - 1.5, 'simple');
      balc.position.set(0, i * 3.1, fd / 2); g.add(balc);
    }
  }
  const roof = box(w + floors * 0.4, 2.6, d + floors * 0.3, 0x8a3b2a, 0.85, 'cone');
  roof.position.y = floors * 3.1 + 1.3; g.add(roof);
  for (const s of [-1, 1]) {
    const col = box(0.5, 3.1, 0.5, 0x6b5a45, 0.9, 'cylinder');
    col.position.set(s * (w / 2 - 0.4), 1.55, d / 2 + 1.1); g.add(col);
  }
  const lamp = new THREE.PointLight(0xffcc88, 0.6, 8);
  lamp.position.set(0, 3.4, d / 2 + 1.4); g.add(lamp);
  const layout = CityAssets.Layouts.createStudioApartment(w - 1.2, d - 1.2, { fans: [], screens: [] });
  layout.furniture.position.y = 3.2; g.add(layout.furniture);
  layout.inhabitants.forEach((i) => { i.position.y += 3.2; g.add(i); inhabitants.push(i); });
  return { group: g, footprint: Math.max(w, d) + 8, inhabitants };
}

function brutalistBlock(rng: Rng): Form {
  const g = new THREE.Group();
  const inhabitants: THREE.Group[] = [];
  const levels = rng.int(3, 6);
  let w = rng.range(13, 18), d = rng.range(11, 15);
  for (let i = 0; i < levels; i++) {
    const b = box(w, 3.6, d, 0x9a958c, 0.7);
    b.position.set(rng.range(-1.2, 1.2), i * 3.6 + 1.8, rng.range(-1.2, 1.2));
    g.add(b);
    const walk = CityAssets.primitives.createSolidObject(w + 1.6, 0.22, 1.4, sharedMaterials.sidewalkConcrete, 'box');
    walk.position.set(b.position.x, i * 3.6 + 3.4, b.position.z + d / 2 + 0.7); g.add(walk);
    w *= 0.94; d *= 0.94;
  }
  for (let i = 0; i < 4; i++) {
    const c = box(1, 3.6, 1, 0x8f8f8f, 0.9);
    c.position.set(i < 2 ? -5 : 5, 1.8, i % 2 === 0 ? -4 : 4); g.add(c);
  }
  return { group: g, footprint: 22, inhabitants };
}

function futuristTower(rng: Rng): Form {
  const g = new THREE.Group();
  const floors = rng.int(10, 22);
  const color = rng.pick(CITY_THEME.colors.buildings.walls);
  for (let i = 0; i < floors; i++) {
    const t = i / floors;
    const s = 9 * (1 - t * 0.55) * (1 + Math.sin(i * 0.7) * 0.12);
    const shape = i % 4 === 3 ? 'icosahedron' : (i % 2 === 0 ? 'cylinder' : 'box');
    const f = box(s, 3.4, s, color, 0.22, shape);
    f.position.y = i * 3.4 + 1.7;
    f.rotation.y = i * 0.22;
    g.add(f);
    const plate = box(s * 1.05, 0.18, s * 1.05, 0x00e5ff, 0.5, shape === 'box' ? 'box' : 'cylinder');
    plate.position.y = i * 3.4; g.add(plate);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(9, 0.25, 6, 28), sharedMaterials.eyeGlow);
  ring.rotation.x = Math.PI / 2; ring.position.y = floors * 3.4 * 0.62;
  g.add(ring);
  const spire = box(1.2, 12, 1.2, 0xffffff, 0.6, 'cone');
  spire.position.y = floors * 3.4 + 6; g.add(spire);
  return { group: g, footprint: 20, inhabitants: [] };
}

function megastructure(rng: Rng): Form {
  const g = new THREE.Group();
  const h = rng.range(34, 52);
  const color = rng.pick(CITY_THEME.colors.buildings.walls);
  for (const s of [-1, 1]) {
    const t = box(8, h, 8, color, 0.35);
    t.position.set(s * 9, h / 2, 0); g.add(t);
  }
  for (let i = 1; i <= 3; i++) {
    const y = (h / 4) * i;
    const bridge = box(20, 3, 5, color, 0.45);
    bridge.position.set(0, y, (i % 2 === 0 ? 1 : -1) * 1.5); g.add(bridge);
    const glow = CityAssets.primitives.createSolidObject(20.4, 0.12, 5.4, sharedMaterials.eyeGlow, 'box');
    glow.position.set(0, y - 1.5, bridge.position.z); g.add(glow);
  }
  const cap = box(24, 2.5, 10, 0x111111, 0.8);
  cap.position.y = h + 1.2; g.add(cap);
  return { group: g, footprint: 32, inhabitants: [] };
}

function makeSlot(slot: Slot, rng: Rng, level: number): Form {
  switch (slot) {
    case 'F:oldtown': return oldTownHouse(rng);
    case 'F:brutal': return brutalistBlock(rng);
    case 'F:futur': return futuristTower(rng);
    case 'F:mega': return megastructure(rng);
    default: {
      const p = createProgram(slot, rng, level);
      return { group: p.group, footprint: p.footprint, inhabitants: p.inhabitants };
    }
  }
}

// --- Rendu d'un quartier (à partir de son plan) ------------------------------

export interface BuildDistrictArgs {
  cityGroup: THREE.Group;
  animRef: { current: AnimState };
  plan: DistrictPlan;
}

/**
 * Matérialise un quartier DÉJÀ PLANIFIÉ. Aucune décision n'est prise ici : le
 * plan a fixé les rues, les emplacements et les programmes. On peut donc
 * décharger puis recharger un quartier autant de fois qu'on veut, il revient
 * identique.
 */
export function buildDistrict(args: BuildDistrictArgs): DistrictResult {
  const { cityGroup, animRef, plan } = args;
  const { center, angle, theme, actId } = plan;
  const rng = makeRng(plan.seed ^ 0x9e3779b9); // flux séparé : le décor ne décale pas les programmes
  const group = new THREE.Group();
  group.userData = { isDistrict: true, theme, actId };

  const fx = Math.sin(angle), fz = Math.cos(angle);
  const sx = Math.cos(angle), sz = -Math.sin(angle);

  // 1) les rues (le cadastre les connaît déjà : ici, c'est du pavage)
  for (const st of plan.streets) {
    const paved = paveStreet(st.a, st.b, {
      width: st.w,
      lampEvery: st.w >= 10 ? 16 : 0,
      centerLine: st.w >= 10,
    });
    group.add(paved.group);
  }

  // 2) les bâtiments du plan
  for (const slot of plan.slots) {
    if (slot.skip) continue;
    const form = makeSlot(slot.kind, makeRng(plan.seed + slot.x * 131 + slot.z * 17), slot.level);
    form.group.position.set(slot.x, 0, slot.z);
    form.group.rotation.y = angle + (slot.face === 1 ? Math.PI : 0);
    form.group.userData = { ...form.group.userData, isBuilding: true, expanded: false, district: theme, actId };
    group.add(form.group);
    animRef.current.buildingsList.push(form.group as THREE.Group);
    form.inhabitants.forEach((inh) => { inh.userData.actId = actId; animRef.current.inhabitantsList.push(inh); });
  }

  // 3) vie de rue : alignement d'arbres, piétons sur le trottoir, une voiture
  if (theme !== 'industriel') {
    for (let i = -3; i <= 3; i += 2) {
      const t = i * 16;
      for (const s of [-1, 1]) {
        const tree = CityAssets.Props.createHolographicTree(rng.range(0.8, 1.4), CITY_THEME.colors.props.greenFoliage);
        tree.position.set(
          center.x + fx * t + sx * s * (STREET_W / 2 + 4.6),
          0,
          center.z + fz * t + sz * s * (STREET_W / 2 + 4.6),
        );
        group.add(tree);
      }
    }
  }

  const pedestrians = theme === 'industriel' ? 2 : 4;
  for (let i = 0; i < pedestrians; i++) {
    const s = i % 2 === 0 ? 1 : -1;
    const t = rng.range(-HALF + 8, HALF - 8);
    const px = center.x + fx * t + sx * s * (STREET_W / 2 + 2.2);
    const pz = center.z + fz * t + sz * s * (STREET_W / 2 + 2.2);
    // bornes de marche : le long du trottoir, jamais au milieu de la chaussée
    const bounds = { minX: px - 10, maxX: px + 10, minZ: pz - 10, maxZ: pz + 10 };
    const p = CityAssets.Life.createInhabitant(InhabitantState.WALKING, bounds);
    p.position.set(px, 0.2, pz);
    p.userData.actId = actId;
    group.add(p);
    animRef.current.inhabitantsList.push(p);
  }

  const main = plan.streets[0];
  const v = CityAssets.Life.createVehicle(theme === 'industriel' ? 'truck' : 'car');
  v.position.set(center.x + sx * 2.5, 0.1, center.z + sz * 2.5);
  v.rotation.y = angle;
  v.userData.type = 'vehicle';
  v.userData.actId = actId;
  v.userData.speed = rng.range(4, 8); v.userData.maxSpeed = v.userData.speed;
  v.userData.districtLane = { ax: main.a.x, az: main.a.z, bx: main.b.x, bz: main.b.z, dir: 1, angle };
  group.add(v);
  animRef.current.vehiclesList.push(v);

  // panneau d'entrée + point d'intérêt (les habitants viennent le regarder)
  const sign = makeSignPost(DISTRICT_LABEL[theme]);
  sign.position.set(center.x - fx * (HALF - 4) + sx * 7, 0, center.z - fz * (HALF - 4) + sz * 7);
  sign.rotation.y = angle + Math.PI / 2;
  group.add(sign);
  animRef.current.pois.push(new THREE.Vector3(center.x, 1, center.z));

  cityGroup.add(group);
  return { group, center, radius: HALF, theme };
}

export const DISTRICT_HALF = HALF;
