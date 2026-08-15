/**
 * PROGRAMMES — le catalogue de ce que la ville sait construire.
 *
 * Un « programme » c'est un usage : logement, commerce, entrepôt, usine,
 * équipement public… Chaque fabrique est DÉTERMINISTE (elle ne tire que dans le
 * `Rng` qu'on lui passe) : à graine égale, bâtiment identique. C'est ce qui
 * permet au registre de la ville de sauvegarder un édifice en quelques octets
 * et de le rebâtir à l'identique au rechargement.
 *
 * Le `level` (1→5) est le savoir-faire de l'architecte qui signe le projet :
 * plus il monte, plus le bâtiment gagne en étages, en matière et en détails.
 */
import * as THREE from 'three';
import { CITY_THEME } from '../theme';
import { CityAssets, InhabitantState, sharedMaterials, getMaterial } from '../assets';
import type { Rng } from './rng';
import { makeSign } from './signage';

export type ProgramKind =
  | 'maison' | 'immeuble' | 'bureau' | 'magasin' | 'marche'
  | 'entrepot' | 'usine' | 'ecole' | 'clinique' | 'mairie' | 'atelier' | 'parc';

/**
 * Emprise réservée au cadastre pour chaque programme.
 *
 * C'est une TABLE et non une mesure du volume construit : le cadastre doit
 * pouvoir être tenu sans rien instancier (le monde est streamé, la plupart des
 * bâtiments n'existent qu'en registre). Les fabriques ci-dessous restent dans
 * cette enveloppe.
 */
export const PROGRAM_FOOTPRINT: Record<ProgramKind, number> = {
  maison: 16, magasin: 16, atelier: 16,
  immeuble: 18, bureau: 18,
  marche: 30, ecole: 30, clinique: 30, mairie: 30, parc: 26,
  entrepot: 38, usine: 36,
};

export const PROGRAM_LABEL: Record<ProgramKind, string> = {
  maison: 'Maison', immeuble: 'Immeuble', bureau: 'Bureau', magasin: 'Magasin',
  marche: 'Marché', entrepot: 'Entrepôt', usine: 'Usine', ecole: 'École',
  clinique: 'Clinique', mairie: 'Mairie', atelier: 'Atelier', parc: 'Square',
};

export interface BuiltProgram {
  group: THREE.Group;
  footprint: number;         // emprise carrée à réserver au cadastre
  inhabitants: THREE.Group[];
  animated: { fans: THREE.Group[]; screens: THREE.Mesh[] };
  label: string;
}

const NAMES: Record<string, string[]> = {
  magasin: ['Épicerie du Coin', 'Chez Marc', 'Quincaillerie', 'Librairie Voxel', 'Fleuriste', 'Primeur'],
  marche: ['Halles Centrales', 'Marché Couvert'],
  entrepot: ['Dépôt Nord', 'Entrepôt 7', 'Logistique Villao', 'Docks'],
  usine: ['Fonderie', 'Manufacture', 'Usine Est', 'Atelier Mécanique'],
  ecole: ['École Hélène', 'Collège du Parc'],
  clinique: ['Clinique Sara', 'Dispensaire'],
  mairie: ['Hôtel de Ville'],
  atelier: ['Atelier de Léo', 'Garage de Sam', 'Fablab'],
  bureau: ['Tour Nord', 'Immeuble Cyan', 'Bureaux du Parc'],
};

const emptyAnimated = () => ({ fans: [] as THREE.Group[], screens: [] as THREE.Mesh[] });

/** Volume filaire standard (mêmes codes visuels que le reste de la ville). */
const box = (w: number, h: number, d: number, color: number, opacity = 0.5) =>
  CityAssets.primitives.createWireframeObject(w, h, d, color, opacity, 'box');

// --- Fabriques ---------------------------------------------------------------

function maison(rng: Rng, level: number): BuiltProgram {
  const g = new THREE.Group();
  const inhabitants: THREE.Group[] = [];
  const animated = emptyAnimated();
  const palette = CITY_THEME.colors.buildings.modernWalls || CITY_THEME.colors.buildings.walls;
  const wall = rng.pick(palette);
  const w = rng.range(8, 10) + level * 0.3;
  const d = rng.range(8, 10);
  const floors = level >= 4 ? 2 : rng.chance(0.35) ? 2 : 1;
  const fh = 3.2;

  for (let i = 0; i < floors; i++) {
    const body = box(w - i * 0.6, fh, d - i * 0.4, wall, 0.55);
    body.position.y = i * fh + fh / 2;
    g.add(body);
  }
  // toit à deux pentes
  const roofColor = rng.pick(CITY_THEME.colors.buildings.modernRoofs || [0x8a3b2a]);
  const top = floors * fh;
  const slope = Math.atan2(2.1, w / 2);
  for (const s of [-1, 1]) {
    const pan = box(Math.hypot(w / 2, 2.1), 0.25, d + 0.6, roofColor, 0.9);
    pan.position.set((s * w) / 4, top + 1.05, 0);
    pan.rotation.z = -s * slope;
    g.add(pan);
  }
  // entrée + jardin
  const path = CityAssets.primitives.createSolidObject(1.6, 0.08, 4, sharedMaterials.sidewalkConcrete, 'box');
  path.position.set(0, 0.05, d / 2 + 2); g.add(path);
  const light = new THREE.PointLight(0xffdda0, 0.7, 7);
  light.position.set(0, 2.6, d / 2 + 0.4); g.add(light);
  if (level >= 2) {
    const hedge = CityAssets.Props.createFlowerBed(w - 1, 1.2);
    hedge.position.set(0, 0, d / 2 + 4.4); g.add(hedge);
  }
  if (level >= 3) {
    const tree = CityAssets.Props.createHolographicTree(rng.range(1, 1.6), CITY_THEME.colors.props.greenFoliage);
    tree.position.set(w / 2 + 2.2, 0, d / 2 + 1.5); g.add(tree);
  }
  if (level >= 4) {
    const car = CityAssets.Life.createVehicle('car');
    car.position.set(-w / 2 - 2, 0.1, d / 2 + 2); car.rotation.y = Math.PI;
    g.add(car);
  }
  // intérieur habité (les habitants restent ENFANTS du bâtiment)
  const layout = CityAssets.Layouts.createStudioApartment(w - 1.5, d - 1.5, animated);
  layout.furniture.position.set(0, 0.1, 0);
  g.add(layout.furniture);
  layout.inhabitants.forEach((i) => { i.position.y += 0.1; g.add(i); inhabitants.push(i); });

  return { group: g, footprint: Math.max(w, d) + 8, inhabitants, animated, label: PROGRAM_LABEL.maison };
}

function immeuble(rng: Rng, level: number): BuiltProgram {
  const floors = 3 + level + rng.int(0, 3);
  const wall = rng.pick(CITY_THEME.colors.buildings.walls);
  const style = rng.pick(['modern', 'cyberpunk', 'brutalist']);
  const bd = CityAssets.Layouts.createProceduralBuilding(12, 12, floors, style, wall);
  const g = bd.group;
  // socle commerçant au rez-de-chaussée dès que l'architecte sait faire
  if (level >= 3) {
    const awning = CityAssets.primitives.createSolidObject(12.6, 0.2, 2, getMaterial(0x223344, false), 'box');
    awning.position.set(0, 3.2, 6.4); g.add(awning);
    const sign = makeSign(rng.pick(NAMES.magasin), 5);
    sign.position.set(0, 3.9, 6.5); g.add(sign);
  }
  if (level >= 4) {
    // toiture végétalisée
    const roof = CityAssets.Props.createDeck(9, 9);
    roof.position.y = floors * 3.5 + 0.6; g.add(roof);
    for (let i = 0; i < 3; i++) {
      const p = CityAssets.Props.createPlant(rng.range(0.8, 1.4));
      p.position.set(rng.range(-3.5, 3.5), floors * 3.5 + 0.7, rng.range(-3.5, 3.5));
      g.add(p);
    }
  }
  return { group: g, footprint: 18, inhabitants: bd.inhabitants, animated: bd.animatedObjects, label: PROGRAM_LABEL.immeuble };
}

function bureau(rng: Rng, level: number): BuiltProgram {
  const floors = 6 + level * 2 + rng.int(0, 4);
  const wall = rng.pick(CITY_THEME.colors.buildings.walls);
  const bd = CityAssets.Layouts.createProceduralBuilding(11, 11, floors, 'modern', wall);
  const g = bd.group;
  const glass = CITY_THEME.colors.buildings.glass;
  // double peau de verre : la signature des tours de bureaux
  const skin = box(12.2, floors * 3.5, 12.2, glass, 0.12);
  skin.position.y = (floors * 3.5) / 2; g.add(skin);
  if (level >= 3) {
    const crown = CityAssets.primitives.createSolidObject(12.6, 0.3, 12.6, sharedMaterials.eyeGlow, 'box');
    crown.position.y = floors * 3.5 + 0.8; g.add(crown);
  }
  if (level >= 4) {
    const mast = box(0.6, 10, 0.6, 0xffffff, 0.7);
    mast.position.y = floors * 3.5 + 5.5; g.add(mast);
  }
  const sign = makeSign(rng.pick(NAMES.bureau), 6);
  sign.position.set(0, 4.4, 6.3); g.add(sign);
  return { group: g, footprint: 19, inhabitants: bd.inhabitants, animated: bd.animatedObjects, label: PROGRAM_LABEL.bureau };
}

function magasin(rng: Rng, level: number): BuiltProgram {
  const g = new THREE.Group();
  const inhabitants: THREE.Group[] = [];
  const animated = emptyAnimated();
  const w = rng.range(9, 12), d = rng.range(8, 10), h = 4.2;
  const wall = rng.pick(CITY_THEME.colors.buildings.walls);

  const body = box(w, h, d, wall, 0.5); body.position.y = h / 2; g.add(body);
  // vitrine sur rue
  const window = box(w - 1.5, 2.6, 0.2, CITY_THEME.colors.buildings.glass, 0.35);
  window.position.set(0, 1.6, d / 2); g.add(window);
  // store rayé
  const awning = CityAssets.primitives.createSolidObject(w - 0.5, 0.18, 2.2, getMaterial(rng.pick([0xcc4444, 0x2f7f5f, 0x2244aa]), false), 'box');
  awning.position.set(0, 3.3, d / 2 + 1); awning.rotation.x = 0.18; g.add(awning);
  const sign = makeSign(rng.pick(NAMES.magasin), w - 1.5);
  sign.position.set(0, 4.6, d / 2 + 0.15); g.add(sign);
  const lamp = new THREE.PointLight(0xffe0b0, 0.9, 10);
  lamp.position.set(0, 4, d / 2 + 1.5); g.add(lamp);

  // étal + cageots devant, clients qui font la queue
  if (level >= 2) {
    for (let i = 0; i < 3; i++) {
      const crate = CityAssets.primitives.createSolidObject(0.9, 0.7, 0.9, getMaterial(CITY_THEME.colors.props.wood, false), 'box');
      crate.position.set(-w / 2 + 1.2 + i * 1.2, 0.35, d / 2 + 2.2); g.add(crate);
    }
  }
  if (level >= 3) {
    const client = CityAssets.Life.createInhabitant(InhabitantState.IDLE);
    client.position.set(1.5, 0.2, d / 2 + 2.6); client.rotation.y = Math.PI;
    g.add(client); inhabitants.push(client);
  }
  // intérieur : rayonnages
  const shelves = level >= 2 ? 4 : 2;
  for (let i = 0; i < shelves; i++) {
    const shelf = box(w - 3, 1.8, 0.6, 0x777777, 0.6);
    shelf.position.set(0, 0.9, -d / 2 + 1.4 + i * 1.6); g.add(shelf);
  }
  const seller = CityAssets.Life.createInhabitant(InhabitantState.WORKING);
  seller.position.set(-w / 4, 0.15, -1); g.add(seller); inhabitants.push(seller);

  return { group: g, footprint: Math.max(w, d) + 7, inhabitants, animated, label: PROGRAM_LABEL.magasin };
}

function marche(rng: Rng, level: number): BuiltProgram {
  const g = new THREE.Group();
  const inhabitants: THREE.Group[] = [];
  const w = 20 + level, d = 14;
  // halle : charpente ouverte
  for (let i = 0; i <= 5; i++) {
    const t = -w / 2 + (i * w) / 5;
    const arch = box(0.4, 6, d, 0x9aa0a6, 0.8);
    arch.position.set(t, 3, 0); g.add(arch);
  }
  const roof = CityAssets.primitives.createSolidObject(w + 1.5, 0.3, d + 1.5, getMaterial(0x2f3e46, false), 'box');
  roof.position.y = 6.2; g.add(roof);
  const sign = makeSign(rng.pick(NAMES.marche), 8);
  sign.position.set(0, 7.2, 0.1); g.add(sign);

  // étals colorés + marchands
  const stalls = 4 + level;
  for (let i = 0; i < stalls; i++) {
    const x = rng.range(-w / 2 + 2, w / 2 - 2);
    const z = rng.range(-d / 2 + 2, d / 2 - 2);
    const canopy = CityAssets.primitives.createSolidObject(2.6, 0.12, 2.2, getMaterial(rng.pick([0xcc4444, 0xddaa33, 0x3388aa, 0x44aa66]), false), 'box');
    canopy.position.set(x, 2.4, z); g.add(canopy);
    const table = box(2.4, 0.9, 1.8, CITY_THEME.colors.props.wood, 0.8);
    table.position.set(x, 0.45, z); g.add(table);
    if (rng.chance(0.6)) {
      const p = CityAssets.Life.createInhabitant(InhabitantState.WORKING);
      p.position.set(x, 0.15, z - 1.4); g.add(p); inhabitants.push(p);
    }
  }
  return { group: g, footprint: Math.max(w, d) + 8, inhabitants, animated: emptyAnimated(), label: PROGRAM_LABEL.marche };
}

function entrepot(rng: Rng, level: number): BuiltProgram {
  const g = new THREE.Group();
  const inhabitants: THREE.Group[] = [];
  const w = 20 + level * 2, d = 14 + level, h = 8;
  const body = box(w, h, d, 0x6b7280, 0.55); body.position.y = h / 2; g.add(body);
  // bardage : nervures verticales
  for (let i = 0; i <= 8; i++) {
    const rib = CityAssets.primitives.createSolidObject(0.18, h, 0.18, getMaterial(0x9aa0a6, false), 'box');
    rib.position.set(-w / 2 + (i * w) / 8, h / 2, d / 2 + 0.1); g.add(rib);
  }
  // quais de chargement + rampes
  const docks = 2 + Math.floor(level / 2);
  for (let i = 0; i < docks; i++) {
    const x = -w / 2 + 3 + i * ((w - 6) / Math.max(1, docks - 1 || 1));
    const door = box(3.2, 3.6, 0.3, 0x1c2128, 0.85);
    door.position.set(x, 1.8, d / 2 + 0.2); g.add(door);
    const ramp = CityAssets.primitives.createSolidObject(3.4, 0.15, 3, sharedMaterials.sidewalkConcrete, 'box');
    ramp.position.set(x, 0.9, d / 2 + 1.8); ramp.rotation.x = 0.18; g.add(ramp);
  }
  const sign = makeSign(rng.pick(NAMES.entrepot), 7);
  sign.position.set(0, h - 1.2, d / 2 + 0.2); g.add(sign);

  // cour : conteneurs empilés et un camion à quai
  const containers = 3 + level;
  for (let i = 0; i < containers; i++) {
    const cont = box(2.4, 2.4, 5.6, rng.pick([0xcc5533, 0x2f6f9f, 0x4a8f4a, 0xbfa030]), 0.85);
    cont.position.set(rng.range(-w / 2, w / 2), 1.2 + (rng.chance(0.35) ? 2.5 : 0), d / 2 + rng.range(6, 11));
    cont.rotation.y = rng.chance(0.5) ? 0 : Math.PI / 2;
    g.add(cont);
  }
  const truck = CityAssets.Life.createVehicle('truck');
  truck.position.set(w / 2 - 4, 0.1, d / 2 + 5); truck.rotation.y = Math.PI;
  g.add(truck);
  const worker = CityAssets.Life.createInhabitant(InhabitantState.WORKING);
  worker.position.set(-w / 4, 0.15, d / 2 + 3); g.add(worker); inhabitants.push(worker);

  return { group: g, footprint: Math.max(w, d) + 16, inhabitants, animated: emptyAnimated(), label: PROGRAM_LABEL.entrepot };
}

function usine(rng: Rng, level: number): BuiltProgram {
  const g = new THREE.Group();
  const inhabitants: THREE.Group[] = [];
  const animated = emptyAnimated();
  const w = 18 + level * 2, d = 13 + level, h = 7;
  const body = box(w, h, d, 0x5a6068, 0.5); body.position.y = h / 2; g.add(body);
  // toiture en sheds vitrés (l'atelier prend le jour du nord)
  const teeth = Math.max(3, Math.floor(w / 5));
  for (let i = 0; i < teeth; i++) {
    const t = box(w / teeth, 2, d, CITY_THEME.colors.buildings.glass, 0.3);
    t.position.set(-w / 2 + (i + 0.5) * (w / teeth), h + 0.9, 0);
    t.rotation.z = 0.5; g.add(t);
  }
  // cheminées fumantes + silos
  const stacks = 1 + Math.floor(level / 2);
  for (let i = 0; i < stacks; i++) {
    const sh = rng.range(13, 20) + level;
    const stack = CityAssets.primitives.createWireframeObject(1.9, sh, 1.9, 0x8a8f96, 0.8, 'cylinder');
    stack.position.set(rng.range(-w / 2 + 2, w / 2 - 2), sh / 2, -d / 2 - 2.5);
    g.add(stack);
    const ember = CityAssets.primitives.createSolidObject(2.2, 0.3, 2.2, getMaterial(0xff5522, false), 'cylinder');
    ember.position.set(stack.position.x, sh, stack.position.z); g.add(ember);
  }
  const silo = CityAssets.primitives.createWireframeObject(4.5, 10, 4.5, 0xb0b6bd, 0.7, 'cylinder');
  silo.position.set(w / 2 + 4, 5, -d / 4); g.add(silo);
  // ventilateurs animés (branchés sur la boucle d'animation)
  if (level >= 2) {
    const fan = CityAssets.Architecture.createRooftopDetail(6, 6, 'box');
    fan.position.set(0, h + 0.4, d / 4); g.add(fan);
  }
  const sign = makeSign(rng.pick(NAMES.usine), 7);
  sign.position.set(0, h - 1.5, d / 2 + 0.2); g.add(sign);
  for (let i = 0; i < 1 + Math.floor(level / 2); i++) {
    const p = CityAssets.Life.createInhabitant(InhabitantState.WORKING);
    p.position.set(rng.range(-w / 3, w / 3), 0.15, d / 2 + rng.range(2, 5));
    g.add(p); inhabitants.push(p);
  }
  return { group: g, footprint: Math.max(w, d) + 16, inhabitants, animated, label: PROGRAM_LABEL.usine };
}

function atelier(rng: Rng, level: number): BuiltProgram {
  const g = new THREE.Group();
  const inhabitants: THREE.Group[] = [];
  const w = 11, d = 9, h = 5;
  const body = box(w, h, d, 0x7a6a5a, 0.55); body.position.y = h / 2; g.add(body);
  const door = box(5, 3.6, 0.25, 0x1c2128, 0.85); door.position.set(0, 1.8, d / 2); g.add(door);
  const sign = makeSign(rng.pick(NAMES.atelier), 5);
  sign.position.set(0, 4.3, d / 2 + 0.15); g.add(sign);
  const car = CityAssets.Life.createVehicle(rng.chance(0.5) ? 'car' : 'taxi');
  car.position.set(0, 0.1, d / 2 + 4); car.rotation.y = Math.PI; g.add(car);
  const mech = CityAssets.Life.createInhabitant(InhabitantState.WORKING);
  mech.position.set(-1.5, 0.15, d / 2 + 2.4); g.add(mech); inhabitants.push(mech);
  if (level >= 3) {
    const lift = box(3, 0.3, 2, 0xffaa00, 0.9); lift.position.set(2.5, 1.4, 0); g.add(lift);
  }
  return { group: g, footprint: Math.max(w, d) + 8, inhabitants, animated: emptyAnimated(), label: PROGRAM_LABEL.atelier };
}

function equipement(kind: 'ecole' | 'clinique' | 'mairie', rng: Rng, level: number): BuiltProgram {
  const g = new THREE.Group();
  const inhabitants: THREE.Group[] = [];
  const animated = emptyAnimated();
  const w = kind === 'mairie' ? 18 : 16 + level;
  const d = 12 + level;
  const floors = kind === 'mairie' ? 2 : rng.int(1, 2) + (level >= 4 ? 1 : 0);
  const fh = 3.8;
  const wall = kind === 'clinique' ? 0xf2f5f7 : kind === 'ecole' ? 0xe8d8b0 : 0xd9d2c5;

  for (let i = 0; i < floors; i++) {
    const body = box(w, fh, d, wall, 0.6);
    body.position.y = i * fh + fh / 2; g.add(body);
  }
  // portique d'entrée à colonnes : ça se lit tout de suite comme un équipement
  const cols = 4;
  for (let i = 0; i < cols; i++) {
    const c = CityAssets.primitives.createWireframeObject(0.7, floors * fh - 0.4, 0.7, wall, 0.9, 'cylinder');
    c.position.set(-w / 4 + (i * w) / (2 * (cols - 1)) * 2 - w / 8, (floors * fh - 0.4) / 2, d / 2 + 1.6);
    g.add(c);
  }
  const canopy = CityAssets.primitives.createSolidObject(w * 0.7, 0.4, 4, getMaterial(wall, false), 'box');
  canopy.position.set(0, floors * fh - 0.2, d / 2 + 1.6); g.add(canopy);

  if (kind === 'mairie') {
    const belfry = box(4, 6, 4, wall, 0.8); belfry.position.y = floors * fh + 3; g.add(belfry);
    const clock = makeSign('14:00', 2.4, '#111111', '#f5f0e0');
    clock.position.set(0, floors * fh + 4, 2.1); g.add(clock);
    const flag = CityAssets.primitives.createSolidObject(0.12, 5, 0.12, getMaterial(0xcccccc, false), 'box');
    flag.position.set(w / 2 - 1.5, floors * fh + 2.5, d / 2 - 1); g.add(flag);
  }
  if (kind === 'ecole') {
    // cour de récréation + terrain
    const yard = CityAssets.primitives.createSolidObject(w, 0.06, 10, sharedMaterials.sidewalkConcrete, 'box');
    yard.position.set(0, 0.04, -d / 2 - 6); g.add(yard);
    for (let i = 0; i < 3 + level; i++) {
      const kid = CityAssets.Life.createInhabitant(InhabitantState.WALKING, {
        minX: -w / 2, maxX: w / 2, minZ: -d / 2 - 10, maxZ: -d / 2 - 2,
      });
      kid.position.set(rng.range(-w / 2, w / 2), 0.2, -d / 2 - rng.range(2, 9));
      kid.scale.setScalar(0.75);
      g.add(kid); inhabitants.push(kid);
    }
  }
  if (kind === 'clinique') {
    const cross1 = CityAssets.primitives.createSolidObject(2.4, 0.5, 0.3, getMaterial(0xff4444, false), 'box');
    cross1.position.set(0, floors * fh + 1.2, d / 2 + 0.2); g.add(cross1);
    const cross2 = CityAssets.primitives.createSolidObject(0.5, 2.4, 0.3, getMaterial(0xff4444, false), 'box');
    cross2.position.set(0, floors * fh + 1.2, d / 2 + 0.2); g.add(cross2);
    const amb = CityAssets.Life.createVehicle('truck');
    amb.position.set(w / 2 - 3, 0.1, d / 2 + 5); amb.rotation.y = Math.PI; g.add(amb);
  }

  const sign = makeSign(rng.pick(NAMES[kind]), 7);
  sign.position.set(0, floors * fh - 1.2, d / 2 + 3.7); g.add(sign);

  const layout = CityAssets.Layouts.createGroundFloorLayout('lobby', w - 2, d - 2, animated);
  layout.furniture.position.y = 0.1; g.add(layout.furniture);
  layout.inhabitants.forEach((i) => { i.position.y += 0.1; g.add(i); inhabitants.push(i); });

  return { group: g, footprint: Math.max(w, d) + 12, inhabitants, animated, label: PROGRAM_LABEL[kind] };
}

function parc(rng: Rng, level: number): BuiltProgram {
  const g = new THREE.Group();
  const inhabitants: THREE.Group[] = [];
  const size = 16 + level * 2;
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(size, size), sharedMaterials.grassGreen);
  lawn.rotation.x = -Math.PI / 2; lawn.position.y = 0.02; g.add(lawn);
  // allées en croix
  for (const rot of [0, Math.PI / 2]) {
    const path = new THREE.Mesh(new THREE.PlaneGeometry(2.4, size), sharedMaterials.sidewalkConcrete);
    path.rotation.x = -Math.PI / 2; path.rotation.z = rot; path.position.y = 0.03; g.add(path);
  }
  const trees = 5 + level * 2;
  for (let i = 0; i < trees; i++) {
    const t = CityAssets.Props.createHolographicTree(rng.range(1, 2.2), CITY_THEME.colors.props.greenFoliage);
    t.position.set(rng.range(-size / 2 + 2, size / 2 - 2), 0, rng.range(-size / 2 + 2, size / 2 - 2));
    g.add(t);
  }
  if (level >= 3) {
    const statue = CityAssets.Props.createHoloStatue();
    statue.position.set(0, 0.1, 0); g.add(statue);
  }
  for (let i = 0; i < 2; i++) {
    const p = CityAssets.Life.createInhabitant(InhabitantState.WALKING, {
      minX: -size / 2, maxX: size / 2, minZ: -size / 2, maxZ: size / 2,
    });
    p.position.set(rng.range(-4, 4), 0.2, rng.range(-4, 4));
    g.add(p); inhabitants.push(p);
  }
  return { group: g, footprint: size + 4, inhabitants, animated: emptyAnimated(), label: PROGRAM_LABEL.parc };
}

/** Fabrique un programme. `level` = savoir-faire de l'architecte (1→5). */
export function createProgram(kind: ProgramKind, rng: Rng, level: number): BuiltProgram {
  const built = buildProgram(kind, rng, level);
  // l'emprise annoncée est toujours celle du cadastre (cf. PROGRAM_FOOTPRINT)
  built.footprint = PROGRAM_FOOTPRINT[kind];
  return built;
}

function buildProgram(kind: ProgramKind, rng: Rng, level: number): BuiltProgram {
  const lv = Math.max(1, Math.min(5, Math.round(level)));
  switch (kind) {
    case 'maison': return maison(rng, lv);
    case 'immeuble': return immeuble(rng, lv);
    case 'bureau': return bureau(rng, lv);
    case 'magasin': return magasin(rng, lv);
    case 'marche': return marche(rng, lv);
    case 'entrepot': return entrepot(rng, lv);
    case 'usine': return usine(rng, lv);
    case 'atelier': return atelier(rng, lv);
    case 'ecole': return equipement('ecole', rng, lv);
    case 'clinique': return equipement('clinique', rng, lv);
    case 'mairie': return equipement('mairie', rng, lv);
    case 'parc': return parc(rng, lv);
  }
}
