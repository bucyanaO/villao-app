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
  // habiter
  | 'maison' | 'immeuble' | 'hotel'
  // travailler
  | 'bureau' | 'atelier' | 'usine' | 'entrepot' | 'ferme'
  // commercer / se retrouver
  | 'magasin' | 'boulangerie' | 'cafe' | 'marche' | 'banque'
  // apprendre, se soigner, se cultiver
  | 'ecole' | 'universite' | 'clinique' | 'bibliotheque' | 'musee' | 'cinema' | 'stade'
  // servir la ville
  | 'mairie' | 'poste' | 'caserne' | 'police' | 'gare' | 'station_service' | 'energie' | 'telecom'
  // respirer
  | 'parc';

/**
 * Emprise réservée au cadastre pour chaque programme.
 *
 * C'est une TABLE et non une mesure du volume construit : le cadastre doit
 * pouvoir être tenu sans rien instancier (le monde est streamé, la plupart des
 * bâtiments n'existent qu'en registre). Les fabriques ci-dessous restent dans
 * cette enveloppe.
 */
export const PROGRAM_FOOTPRINT: Record<ProgramKind, number> = {
  maison: 16, magasin: 16, atelier: 16, boulangerie: 16, cafe: 16, poste: 18, banque: 18,
  immeuble: 18, bureau: 18, telecom: 14, station_service: 22,
  hotel: 24, cinema: 28, bibliotheque: 26, musee: 30,
  marche: 30, ecole: 30, clinique: 30, mairie: 30, parc: 26, police: 26, caserne: 28,
  gare: 40, universite: 44, stade: 52, ferme: 46, energie: 44,
  entrepot: 38, usine: 36,
};

export const PROGRAM_LABEL: Record<ProgramKind, string> = {
  maison: 'Maison', immeuble: 'Immeuble', hotel: 'Hôtel',
  bureau: 'Bureau', atelier: 'Atelier', usine: 'Usine', entrepot: 'Entrepôt', ferme: 'Ferme',
  magasin: 'Magasin', boulangerie: 'Boulangerie', cafe: 'Café', marche: 'Marché', banque: 'Banque',
  ecole: 'École', universite: 'Université', clinique: 'Clinique', bibliotheque: 'Bibliothèque',
  musee: 'Musée', cinema: 'Cinéma', stade: 'Stade',
  mairie: 'Mairie', poste: 'Poste', caserne: 'Caserne', police: 'Police', gare: 'Gare',
  station_service: 'Station-service', energie: 'Parc énergétique', telecom: 'Relais télécom',
  parc: 'Square',
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
  boulangerie: ['Au Bon Pain', 'Boulangerie Marc', 'Le Fournil'],
  cafe: ['Café des Voxels', 'Le Comptoir', 'Bistrot du Parc', 'Chez Sara'],
  hotel: ['Hôtel du Parc', 'Grand Hôtel Villao'],
  banque: ['Banque de la Cité', 'Crédit Voxel'],
  poste: ['La Poste'],
  cinema: ['Cinéma Lumière', 'Le Rex'],
  bibliotheque: ['Bibliothèque Municipale'],
  musee: ["Musée d'Art Voxel", 'Musée de la Ville'],
  stade: ['Stade Municipal'],
  caserne: ['Caserne des Pompiers'],
  police: ['Commissariat Central'],
  gare: ['Gare Centrale', 'Gare du Nord'],
  universite: ['Université de Villao'],
  ferme: ['Ferme des Coteaux', 'Exploitation Sud'],
  station_service: ['Station Villao'],
  energie: ['Parc Solaire', 'Champ Éolien'],
  telecom: ['Relais Nord'],
};

const emptyAnimated = () => ({ fans: [] as THREE.Group[], screens: [] as THREE.Mesh[] });

/**
 * Bandeau de fenêtres allumées sur une façade.
 *
 * Le matériau `lampLight` s'éteint le jour et brille la nuit (cf. le préréglage
 * d'éclairage) : une seule instance par façade suffit à faire vivre le bâti
 * nocturne, sans coût de rendu notable.
 */
function litWindows(width: number, y: number, z: number, count: number, rng: Rng): THREE.InstancedMesh {
  const geo = new THREE.PlaneGeometry(0.9, 1.1);
  const im = new THREE.InstancedMesh(geo, sharedMaterials.lampLight, count);
  const dummy = new THREE.Object3D();
  const step = width / (count + 1);
  for (let i = 0; i < count; i++) {
    dummy.position.set(-width / 2 + step * (i + 1), y + rng.range(-0.15, 0.15), z);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
  }
  im.instanceMatrix.needsUpdate = true;
  return im;
}

/**
 * Arête lisible pour une façade claire.
 *
 * Les arêtes reprennent la couleur du mur. Sur un blanc d'hôpital ou un beige
 * de mairie, elles disparaissent : le volume perd sa structure et se lit comme
 * un bloc plein, hors du style de la ville. Au-delà d'un certain éclat, on les
 * assombrit donc.
 */
const edgeFor = (color: number): number => {
  const r = (color >> 16) & 255, g2 = (color >> 8) & 255, b = color & 255;
  const lum = (0.299 * r + 0.587 * g2 + 0.114 * b) / 255;
  if (lum < 0.72) return color;
  const k = 0.5;
  return (Math.round(r * k) << 16) | (Math.round(g2 * k) << 8) | Math.round(b * k);
};

/** Volume filaire standard (mêmes codes visuels que le reste de la ville). */
const box = (w: number, h: number, d: number, color: number, opacity = 0.5) =>
  CityAssets.primitives.createWireframeObject(w, h, d, color, opacity, 'box', edgeFor(color));

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
  // fenêtres éclairées : la maison vit aussi la nuit
  for (let i = 0; i < floors; i++) {
    g.add(litWindows(w - 2, i * fh + fh * 0.55, d / 2 + 0.06, 2, rng));
  }

  // Cheminée et auvent d'entrée : deux détails qui suffisent à ce qu'une
  // maison cesse de se lire comme une boîte posée au sol.
  const chimney = box(0.9, 1.8, 0.9, roofColor, 0.95);
  chimney.position.set(w * 0.28, top + 1.9, -d * 0.18); g.add(chimney);
  const canopy = box(3, 0.18, 1.5, roofColor, 0.9);
  canopy.position.set(0, 2.5, d / 2 + 0.7); g.add(canopy);
  for (const s of [-1, 1]) {
    const post = box(0.16, 2.5, 0.16, wall, 0.9);
    post.position.set(s * 1.3, 1.25, d / 2 + 1.3); g.add(post);
  }

  // Une annexe une fois sur deux : c'est elle qui casse la répétition d'une rue
  // entière de pavillons identiques.
  if (rng.chance(0.5)) {
    const side = rng.chance(0.5) ? 1 : -1;
    const aw = 3.6, ad = 5.4, ah = 2.6;
    const annex = box(aw, ah, ad, wall, 0.55);
    annex.position.set(side * (w / 2 + aw / 2 - 0.2), ah / 2, -d * 0.1); g.add(annex);
    const flat = box(aw + 0.4, 0.2, ad + 0.4, roofColor, 0.9);
    flat.position.set(annex.position.x, ah + 0.1, annex.position.z); g.add(flat);
  }

  // entrée + jardin — clôture, haie et arbre pour TOUTES les maisons, quel que
  // soit le niveau de l'architecte : une maison neuve n'est pas un terrain vague.
  const path = CityAssets.primitives.createSolidObject(1.6, 0.08, 4, sharedMaterials.sidewalkConcrete, 'box');
  path.position.set(0, 0.05, d / 2 + 2); g.add(path);
  const light = new THREE.PointLight(0xffdda0, 0.7, 7);
  light.position.set(0, 2.6, d / 2 + 0.4); g.add(light);

  const fenceZ = d / 2 + 4.6;
  const rail = box(w + 2, 0.12, 0.12, roofColor, 0.8);
  rail.position.set(0, 0.85, fenceZ); g.add(rail);
  for (const s of [-1, 0, 1]) {
    if (s === 0) continue;                       // l'allée passe au milieu
    const post = box(0.14, 1, 0.14, roofColor, 0.85);
    post.position.set(s * (w / 2 + 1), 0.5, fenceZ); g.add(post);
  }
  const hedge = CityAssets.Props.createFlowerBed(w / 2 - 0.5, 1.1);
  hedge.position.set(-(w / 4 + 0.6), 0, fenceZ - 1.1); g.add(hedge);
  const tree = CityAssets.Props.createHolographicTree(rng.range(1, 1.6), CITY_THEME.colors.props.greenFoliage);
  tree.position.set(w / 2 + 2.2, 0, d / 2 + 1.5); g.add(tree);
  if (level >= 3) {
    const hedge2 = CityAssets.Props.createFlowerBed(w / 2 - 0.5, 1.1);
    hedge2.position.set(w / 4 + 0.6, 0, fenceZ - 1.1); g.add(hedge2);
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
  const trim = edgeFor(wall);

  for (let i = 0; i < floors; i++) {
    const body = box(w, fh, d, wall, 0.4);
    body.position.y = i * fh + fh / 2; g.add(body);
    // le plancher de chaque niveau : c'est lui qui donne à voir l'intérieur
    const slab = CityAssets.primitives.createSolidObject(w - 0.8, 0.16, d - 0.8, getMaterial(trim, false), 'box');
    slab.position.y = i * fh + 0.08; g.add(slab);
  }
  for (let i = 0; i < floors; i++) {
    g.add(litWindows(w - 3, i * fh + fh * 0.55, d / 2 + 0.06, 4, rng));
  }

  // portique d'entrée à colonnes : ça se lit tout de suite comme un équipement
  const cols = 4;
  for (let i = 0; i < cols; i++) {
    const c = CityAssets.primitives.createWireframeObject(0.7, floors * fh - 0.4, 0.7, wall, 0.9, 'cylinder', trim);
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


// --- Commerces de proximité --------------------------------------------------

/** Petit commerce type (boulangerie, café) : même grammaire, ambiances différentes. */
function commerceDeRue(
  rng: Rng, level: number, kind: 'boulangerie' | 'cafe',
): BuiltProgram {
  const g = new THREE.Group();
  const inhabitants: THREE.Group[] = [];
  const w = rng.range(8, 10), d = rng.range(8, 9), h = 4;
  const wall = kind === 'boulangerie' ? rng.pick([0xe8d8b0, 0xd8c49a]) : rng.pick([0x2f4f4f, 0x3d5a5a, 0x6b3f3f]);

  const body = box(w, h, d, wall, 0.6); body.position.y = h / 2; g.add(body);
  const vitrine = box(w - 1.4, 2.4, 0.2, CITY_THEME.colors.buildings.glass, 0.35);
  vitrine.position.set(0, 1.5, d / 2); g.add(vitrine);
  const store = CityAssets.primitives.createSolidObject(w - 0.4, 0.16, 2, getMaterial(kind === 'boulangerie' ? 0xb03030 : 0x2f7f5f, false), 'box');
  store.position.set(0, 3.1, d / 2 + 0.9); store.rotation.x = 0.2; g.add(store);
  const sign = makeSign(rng.pick(NAMES[kind]), w - 1.2, kind === 'boulangerie' ? '#ffe9c0' : '#d6fff6');
  sign.position.set(0, 4.4, d / 2 + 0.12); g.add(sign);
  const lamp = new THREE.PointLight(kind === 'boulangerie' ? 0xffcf90 : 0xffe0b0, 0.9, 11);
  lamp.position.set(0, 3.6, d / 2 + 1.6); g.add(lamp);

  if (kind === 'cafe') {
    // terrasse : tables, chaises, clients — c'est là que la rue devient vivante
    const nTables = 2 + level;
    for (let i = 0; i < nTables; i++) {
      const tx = -w / 2 + 1.5 + (i % 3) * 2.4;
      const tz = d / 2 + 2 + Math.floor(i / 3) * 2.2;
      const table = CityAssets.Furniture.createTableSet();
      table.position.set(tx, 0, tz); table.scale.setScalar(0.8); g.add(table);
      if (rng.chance(0.7)) {
        const client = CityAssets.Life.createInhabitant(InhabitantState.SITTING);
        client.position.set(tx + 0.7, 0.2, tz); client.rotation.y = -Math.PI / 2;
        g.add(client); inhabitants.push(client);
      }
    }
  } else {
    // fournil : pétrin, four, présentoirs
    for (let i = 0; i < 3; i++) {
      const shelf = box(w - 3, 1.2, 0.6, 0x8a6b45, 0.7);
      shelf.position.set(0, 0.6, -d / 2 + 1.4 + i * 1.5); g.add(shelf);
    }
    const four = box(2.4, 2.2, 1.6, 0x552222, 0.85);
    four.position.set(w / 2 - 2, 1.1, -d / 2 + 1.4); g.add(four);
  }
  const staff = CityAssets.Life.createInhabitant(InhabitantState.WORKING);
  staff.position.set(-w / 4, 0.15, -0.5); g.add(staff); inhabitants.push(staff);

  return { group: g, footprint: PROGRAM_FOOTPRINT[kind], inhabitants, animated: emptyAnimated(), label: PROGRAM_LABEL[kind] };
}

function hotel(rng: Rng, level: number): BuiltProgram {
  const floors = 4 + level;
  const wall = rng.pick(CITY_THEME.colors.buildings.walls);
  const bd = CityAssets.Layouts.createProceduralBuilding(13, 12, floors, 'modern', wall);
  const g = bd.group;
  // marquise d'entrée + enseigne verticale : la signature d'un hôtel
  const marquise = CityAssets.primitives.createSolidObject(9, 0.3, 4, getMaterial(0x1b2a3a, false), 'box');
  marquise.position.set(0, 3.4, 7.5); g.add(marquise);
  for (const sx of [-4, 4]) {
    const col = box(0.4, 3.4, 0.4, 0xd8d0c0, 0.9);
    col.position.set(sx, 1.7, 9.2); g.add(col);
  }
  const banner = makeSign(rng.pick(NAMES.hotel), 3.2, '#ffe9c0');
  banner.position.set(6.8, floors * 1.8, 6.2);
  banner.rotation.z = Math.PI / 2; g.add(banner);
  const light = new THREE.PointLight(0xffd9a0, 1.1, 16);
  light.position.set(0, 3.6, 8.5); g.add(light);
  return { group: g, footprint: PROGRAM_FOOTPRINT.hotel, inhabitants: bd.inhabitants, animated: bd.animatedObjects, label: PROGRAM_LABEL.hotel };
}

function banque(rng: Rng, level: number): BuiltProgram {
  const g = new THREE.Group();
  const inhabitants: THREE.Group[] = [];
  const animated = emptyAnimated();
  const w = 13, d = 11, h = 4.6 + level * 0.3;
  const body = box(w, h, d, 0xdcd6c8, 0.7); body.position.y = h / 2; g.add(body);
  // fronton à colonnes
  for (let i = 0; i < 4; i++) {
    const col = CityAssets.primitives.createWireframeObject(0.8, h, 0.8, 0xefe9dc, 0.95, 'cylinder');
    col.position.set(-4.5 + i * 3, h / 2, d / 2 + 1.4); g.add(col);
  }
  g.add(litWindows(w - 3, h * 0.55, d / 2 + 0.06, 4, rng));
  const fronton = CityAssets.primitives.createSolidObject(w, 1.2, 3.4, getMaterial(0xefe9dc, false), 'box');
  fronton.position.set(0, h + 0.6, d / 2 + 1.2); g.add(fronton);
  const sign = makeSign(rng.pick(NAMES.banque), 8, '#1b2a3a', 'rgba(240,236,225,0.95)');
  sign.position.set(0, h + 0.6, d / 2 + 2.95); g.add(sign);
  const layout = CityAssets.Layouts.createGroundFloorLayout('lobby', w - 2, d - 2, animated);
  layout.furniture.position.y = 0.1; g.add(layout.furniture);
  layout.inhabitants.forEach((i) => { i.position.y += 0.1; g.add(i); inhabitants.push(i); });
  return { group: g, footprint: PROGRAM_FOOTPRINT.banque, inhabitants, animated, label: PROGRAM_LABEL.banque };
}

// --- Culture & loisirs -------------------------------------------------------

function cinema(rng: Rng, level: number): BuiltProgram {
  const g = new THREE.Group();
  const inhabitants: THREE.Group[] = [];
  const w = 18, d = 14, h = 8;
  const body = box(w, h, d, 0x3a2a3a, 0.65); body.position.y = h / 2; g.add(body);
  // auvent lumineux + affiches
  const auvent = CityAssets.primitives.createSolidObject(w + 1.5, 0.5, 3.2, getMaterial(0xffcc33, false), 'box');
  auvent.position.set(0, 4.2, d / 2 + 1.4); g.add(auvent);
  const sign = makeSign(rng.pick(NAMES.cinema), 10, '#1b1020', 'rgba(255,204,51,0.95)');
  sign.position.set(0, 5.6, d / 2 + 0.15); g.add(sign);
  for (let i = 0; i < 3; i++) {
    const affiche = box(1.8, 2.6, 0.15, rng.pick([0xff4477, 0x44aaff, 0xffdd44]), 0.8);
    affiche.position.set(-6 + i * 6, 1.6, d / 2 + 0.1); g.add(affiche);
  }
  const glow = new THREE.PointLight(0xffcc55, 1.3, 20);
  glow.position.set(0, 4.6, d / 2 + 3); g.add(glow);
  for (let i = 0; i < 2 + level; i++) {
    const p = CityAssets.Life.createInhabitant(InhabitantState.IDLE);
    p.position.set(rng.range(-w / 3, w / 3), 0.2, d / 2 + rng.range(2.5, 5));
    p.rotation.y = Math.PI; g.add(p); inhabitants.push(p);
  }
  return { group: g, footprint: PROGRAM_FOOTPRINT.cinema, inhabitants, animated: emptyAnimated(), label: PROGRAM_LABEL.cinema };
}

function bibliotheque(rng: Rng, level: number): BuiltProgram {
  const g = new THREE.Group();
  const inhabitants: THREE.Group[] = [];
  const w = 16, d = 13, h = 7;
  const body = box(w, h, d, 0xd9cfae, 0.65); body.position.y = h / 2; g.add(body);
  const roof = CityAssets.primitives.createSolidObject(w + 1, 0.4, d + 1, getMaterial(0x8a7f60, false), 'box');
  roof.position.y = h + 0.2; g.add(roof);
  // grandes verrières + rayonnages visibles
  for (let i = 0; i < 4; i++) {
    const bay = box(2.4, h - 2, 0.2, CITY_THEME.colors.buildings.glass, 0.3);
    bay.position.set(-6 + i * 4, h / 2, d / 2); g.add(bay);
  }
  g.add(litWindows(w - 3, h * 0.6, d / 2 + 0.12, 4, rng));
  for (let i = 0; i < 4 + level; i++) {
    const stack = box(w - 4, 2.2, 0.7, 0x6b5a45, 0.8);
    stack.position.set(0, 1.1, -d / 2 + 1.6 + i * 1.6); g.add(stack);
  }
  const reader = CityAssets.Life.createInhabitant(InhabitantState.SITTING);
  reader.position.set(2, 0.2, 2); g.add(reader); inhabitants.push(reader);
  const sign = makeSign(rng.pick(NAMES.bibliotheque), 8);
  sign.position.set(0, h - 1, d / 2 + 0.12); g.add(sign);
  return { group: g, footprint: PROGRAM_FOOTPRINT.bibliotheque, inhabitants, animated: emptyAnimated(), label: PROGRAM_LABEL.bibliotheque };
}

function musee(rng: Rng, level: number): BuiltProgram {
  const g = new THREE.Group();
  const inhabitants: THREE.Group[] = [];
  const w = 20, d = 16, h = 9;
  // volume sculpté : un musée doit se remarquer
  const body = box(w, h, d, 0xf0efe9, 0.6); body.position.y = h / 2; g.add(body);
  const wing = box(w * 0.5, h * 0.6, d * 0.7, 0xe3e0d4, 0.7);
  wing.position.set(w * 0.4, h * 0.3, -d * 0.35); wing.rotation.y = 0.35; g.add(wing);
  const prisme = CityAssets.primitives.createWireframeObject(7, 7, 7, CITY_THEME.colors.buildings.glass, 0.25, 'icosahedron');
  prisme.position.set(-w * 0.25, h + 2, d * 0.1); g.add(prisme);
  const parvis = CityAssets.primitives.createSolidObject(w + 6, 0.08, 8, sharedMaterials.sidewalkConcrete, 'box');
  parvis.position.set(0, 0.05, d / 2 + 4); g.add(parvis);
  const statue = CityAssets.Props.createHoloStatue();
  statue.position.set(0, 0.1, d / 2 + 4); g.add(statue);
  const sign = makeSign(rng.pick(NAMES.musee), 9);
  sign.position.set(0, h - 1.5, d / 2 + 0.12); g.add(sign);
  for (let i = 0; i < 2 + level; i++) {
    const v = CityAssets.Life.createInhabitant(InhabitantState.WALKING, {
      minX: -w / 2, maxX: w / 2, minZ: d / 2 + 1, maxZ: d / 2 + 7,
    });
    v.position.set(rng.range(-w / 2, w / 2), 0.2, d / 2 + rng.range(1.5, 6.5));
    g.add(v); inhabitants.push(v);
  }
  return { group: g, footprint: PROGRAM_FOOTPRINT.musee, inhabitants, animated: emptyAnimated(), label: PROGRAM_LABEL.musee };
}

function stade(rng: Rng, level: number): BuiltProgram {
  const g = new THREE.Group();
  const inhabitants: THREE.Group[] = [];
  const rx = 24, rz = 18;
  // pelouse + piste
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(rx * 1.1, rz * 1.1), sharedMaterials.grassGreen);
  pitch.rotation.x = -Math.PI / 2; pitch.position.y = 0.03; g.add(pitch);
  const line = new THREE.Mesh(new THREE.RingGeometry(4, 4.3, 24), sharedMaterials.crosswalkWhite);
  line.rotation.x = -Math.PI / 2; line.position.y = 0.05; g.add(line);
  // gradins : un anneau de blocs inclinés
  const segs = 20;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const stand = box(6.5, 6, 4, rng.pick([0x334455, 0x3b4f63]), 0.75);
    stand.position.set(Math.cos(a) * (rx * 0.78), 3, Math.sin(a) * (rz * 0.9));
    stand.rotation.y = -a;
    g.add(stand);
  }
  // projecteurs
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const mast = box(0.8, 20, 0.8, 0x9aa0a6, 0.9);
    mast.position.set(sx * rx * 0.8, 10, sz * rz * 1.0); g.add(mast);
    const lampBox = CityAssets.primitives.createSolidObject(3, 0.8, 1, sharedMaterials.lampLight, 'box');
    lampBox.position.set(sx * rx * 0.8, 19.5, sz * rz * 1.0); g.add(lampBox);
    const l = new THREE.PointLight(0xffffee, 0.8, 45);
    l.position.set(sx * rx * 0.6, 18, sz * rz * 0.7); g.add(l);
  }
  for (let i = 0; i < 4 + level * 2; i++) {
    const p = CityAssets.Life.createInhabitant(InhabitantState.WALKING, {
      minX: -rx / 2, maxX: rx / 2, minZ: -rz / 2, maxZ: rz / 2,
    });
    p.position.set(rng.range(-rx / 2, rx / 2), 0.2, rng.range(-rz / 2, rz / 2));
    g.add(p); inhabitants.push(p);
  }
  const sign = makeSign(rng.pick(NAMES.stade), 10);
  sign.position.set(0, 7.5, rz * 1.05); g.add(sign);
  return { group: g, footprint: PROGRAM_FOOTPRINT.stade, inhabitants, animated: emptyAnimated(), label: PROGRAM_LABEL.stade };
}

// --- Services publics --------------------------------------------------------

function caserne(rng: Rng, level: number, police = false): BuiltProgram {
  const g = new THREE.Group();
  const inhabitants: THREE.Group[] = [];
  const w = 16, d = 12, h = 6;
  const wall = police ? 0x2b3f66 : 0x8c2f2f;
  const body = box(w, h, d, wall, 0.7); body.position.y = h / 2; g.add(body);
  // grandes portes de remise / entrée surveillée
  const bays = police ? 1 : 2 + Math.floor(level / 2);
  for (let i = 0; i < bays; i++) {
    const door = box(4, 4.2, 0.3, 0x101418, 0.9);
    door.position.set(-w / 2 + 3 + i * 5, 2.1, d / 2 + 0.2); g.add(door);
  }
  g.add(litWindows(w - 4, h * 0.7, d / 2 + 0.06, 4, rng));
  const tour = box(3, h + 5, 3, wall, 0.8);
  tour.position.set(w / 2 - 2, (h + 5) / 2, -d / 2 + 2); g.add(tour);
  const gyro = CityAssets.primitives.createSolidObject(1.2, 0.4, 1.2, getMaterial(police ? 0x3388ff : 0xff3322, false), 'box');
  gyro.position.set(w / 2 - 2, h + 5.4, -d / 2 + 2); g.add(gyro);
  const l = new THREE.PointLight(police ? 0x3388ff : 0xff3322, 1.2, 18);
  l.position.copy(gyro.position); g.add(l);
  const veh = CityAssets.Life.createVehicle('truck');
  veh.position.set(-w / 4, 0.1, d / 2 + 5); veh.rotation.y = Math.PI; g.add(veh);
  const agent = CityAssets.Life.createInhabitant(InhabitantState.WORKING);
  agent.position.set(w / 4, 0.15, d / 2 + 2.5); g.add(agent); inhabitants.push(agent);
  const sign = makeSign(rng.pick(NAMES[police ? 'police' : 'caserne']), 8);
  sign.position.set(0, h - 0.8, d / 2 + 0.12); g.add(sign);
  return { group: g, footprint: PROGRAM_FOOTPRINT[police ? 'police' : 'caserne'], inhabitants, animated: emptyAnimated(), label: PROGRAM_LABEL[police ? 'police' : 'caserne'] };
}

function poste(rng: Rng, level: number): BuiltProgram {
  const g = new THREE.Group();
  const inhabitants: THREE.Group[] = [];
  const w = 12, d = 10, h = 5;
  const body = box(w, h, d, rng.pick([0xe8c840, 0xefd35a, 0xdcbe33]), 0.6);
  body.position.y = h / 2; g.add(body);
  g.add(litWindows(w - 3, h * 0.45, d / 2 + 0.06, 3, rng));
  const band = CityAssets.primitives.createSolidObject(w + 0.3, 0.7, d + 0.3, getMaterial(0x1b3fa0, false), 'box');
  band.position.y = h - 1; g.add(band);
  const sign = makeSign(NAMES.poste[0], 7, '#ffffff', 'rgba(27,63,160,0.95)');
  sign.position.set(0, h - 1, d / 2 + 0.2); g.add(sign);
  for (let i = 0; i < 1 + Math.floor(level / 2); i++) {
    const van = CityAssets.Life.createVehicle('truck');
    van.position.set(-w / 2 + 2 + i * 4, 0.1, d / 2 + 5); van.rotation.y = Math.PI; g.add(van);
  }
  const agent = CityAssets.Life.createInhabitant(InhabitantState.WORKING);
  agent.position.set(0, 0.15, -1); g.add(agent); inhabitants.push(agent);
  return { group: g, footprint: PROGRAM_FOOTPRINT.poste, inhabitants, animated: emptyAnimated(), label: PROGRAM_LABEL.poste };
}

function gare(rng: Rng, level: number): BuiltProgram {
  const g = new THREE.Group();
  const inhabitants: THREE.Group[] = [];
  const w = 26, d = 14, h = 9;
  const hall = box(w, h, d, 0xcfd6dd, 0.55); hall.position.y = h / 2; g.add(hall);
  // verrière + horloge
  const verriere = box(w - 2, 1.2, d - 2, CITY_THEME.colors.buildings.glass, 0.3);
  verriere.position.y = h + 0.4; g.add(verriere);
  const clock = makeSign('08:42', 2.6, '#111111', '#f5f0e0');
  clock.position.set(0, h - 1.4, d / 2 + 0.12); g.add(clock);
  const sign = makeSign(rng.pick(NAMES.gare), 10);
  sign.position.set(0, h - 4, d / 2 + 0.12); g.add(sign);
  // quais et voies : deux rails filants + un quai central
  for (const s of [-1, 1]) {
    const rail = CityAssets.primitives.createSolidObject(60, 0.12, 0.25, getMaterial(0x9aa0a6, false), 'box');
    rail.position.set(0, 0.1, -d / 2 - 4 + s * 1.4); g.add(rail);
  }
  const quai = CityAssets.primitives.createSolidObject(50, 0.5, 4, sharedMaterials.sidewalkConcrete, 'box');
  quai.position.set(0, 0.25, -d / 2 - 9); g.add(quai);
  for (let i = 0; i < 3 + level; i++) {
    const p = CityAssets.Life.createInhabitant(InhabitantState.WALKING, {
      minX: -20, maxX: 20, minZ: -d / 2 - 11, maxZ: -d / 2 - 7,
    });
    p.position.set(rng.range(-18, 18), 0.7, -d / 2 - 9);
    g.add(p); inhabitants.push(p);
  }
  const bus = CityAssets.Life.createVehicle('bus');
  bus.position.set(-w / 3, 0.1, d / 2 + 6); bus.rotation.y = Math.PI / 2; g.add(bus);
  return { group: g, footprint: PROGRAM_FOOTPRINT.gare, inhabitants, animated: emptyAnimated(), label: PROGRAM_LABEL.gare };
}

function universite(rng: Rng, level: number): BuiltProgram {
  const g = new THREE.Group();
  const inhabitants: THREE.Group[] = [];
  const animated = emptyAnimated();
  // campus : trois ailes autour d'une cour
  const wall = 0xdccfb4;
  const specs: [number, number, number, number, number][] = [
    [0, -12, 26, 10, 8], [-13, 2, 10, 22, 7], [13, 2, 10, 22, 7],
  ];
  for (const [x, z, w, d, h] of specs) {
    const b = box(w, h, d, wall, 0.65);
    b.position.set(x, h / 2, z); g.add(b);
    const roof = CityAssets.primitives.createSolidObject(w + 0.8, 0.4, d + 0.8, getMaterial(0x6b5a45, false), 'box');
    roof.position.set(x, h + 0.2, z); g.add(roof);
  }
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(22, 20), sharedMaterials.grassGreen);
  lawn.rotation.x = -Math.PI / 2; lawn.position.set(0, 0.03, 4); g.add(lawn);
  for (let i = 0; i < 4; i++) {
    const t = CityAssets.Props.createHolographicTree(rng.range(1.2, 2), CITY_THEME.colors.props.greenFoliage);
    t.position.set(rng.range(-9, 9), 0, rng.range(-4, 12)); g.add(t);
  }
  const sign = makeSign(NAMES.universite[0], 10);
  sign.position.set(0, 7, -12 + 5.2); g.add(sign);
  for (let i = 0; i < 4 + level * 2; i++) {
    const st = CityAssets.Life.createInhabitant(InhabitantState.WALKING, {
      minX: -10, maxX: 10, minZ: -6, maxZ: 13,
    });
    st.position.set(rng.range(-9, 9), 0.2, rng.range(-5, 12));
    g.add(st); inhabitants.push(st);
  }
  return { group: g, footprint: PROGRAM_FOOTPRINT.universite, inhabitants, animated, label: PROGRAM_LABEL.universite };
}

// --- Production & réseaux ----------------------------------------------------

function ferme(rng: Rng, level: number): BuiltProgram {
  const g = new THREE.Group();
  const inhabitants: THREE.Group[] = [];
  // corps de ferme + grange
  const house = box(10, 4, 8, 0xd8c8a0, 0.6); house.position.set(-9, 2, 0); g.add(house);
  const roofSlope = Math.atan2(2, 5);
  for (const s of [-1, 1]) {
    const pan = box(Math.hypot(5, 2), 0.25, 8.6, 0x8a3b2a, 0.9);
    pan.position.set(-9 + s * 2.5, 5, 0); pan.rotation.z = -s * roofSlope; g.add(pan);
  }
  const grange = box(12, 6, 9, 0x8c3a2a, 0.7); grange.position.set(6, 3, -2); g.add(grange);
  const silo = CityAssets.primitives.createWireframeObject(4, 9, 4, 0xb0b6bd, 0.75, 'cylinder');
  silo.position.set(14, 4.5, -2); g.add(silo);
  // champs cultivés : bandes régulières (instanciées par bande)
  const rows = 5 + level;
  for (let i = 0; i < rows; i++) {
    const field = CityAssets.primitives.createSolidObject(26, 0.06, 2.2, getMaterial(rng.pick([0x5a6b2a, 0x6d7a30, 0x7d6b2a]), false), 'box');
    field.position.set(0, 0.04, 8 + i * 2.6); g.add(field);
  }
  const tracteur = CityAssets.Life.createVehicle('truck');
  tracteur.position.set(-2, 0.1, 6); tracteur.rotation.y = Math.PI / 2; g.add(tracteur);
  const paysan = CityAssets.Life.createInhabitant(InhabitantState.WORKING);
  paysan.position.set(2, 0.15, 9); g.add(paysan); inhabitants.push(paysan);
  const sign = makeSign(rng.pick(NAMES.ferme), 6);
  sign.position.set(-9, 4.6, 4.2); g.add(sign);
  return { group: g, footprint: PROGRAM_FOOTPRINT.ferme, inhabitants, animated: emptyAnimated(), label: PROGRAM_LABEL.ferme };
}

function energie(rng: Rng, level: number): BuiltProgram {
  const g = new THREE.Group();
  const solaire = rng.chance(0.5);
  if (solaire) {
    // champ de panneaux : inclinés plein sud, alignés
    const rows = 4 + level, cols = 5;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const panel = CityAssets.primitives.createSolidObject(4, 0.12, 2.2, getMaterial(0x1b2a5a, false), 'box');
        panel.position.set(-12 + c * 5, 1.2, -10 + r * 4);
        panel.rotation.x = -0.5; g.add(panel);
        const leg = box(0.15, 1.2, 0.15, 0x888888, 0.9);
        leg.position.set(-12 + c * 5, 0.6, -10 + r * 4); g.add(leg);
      }
    }
  } else {
    // éoliennes : mât, nacelle, trois pales (les pales tournent dans la boucle)
    for (let i = 0; i < 2 + Math.floor(level / 2); i++) {
      const x = -10 + i * 12, z = rng.range(-8, 8);
      const mast = CityAssets.primitives.createWireframeObject(1, 26, 1, 0xe8e8e8, 0.85, 'cylinder');
      mast.position.set(x, 13, z); g.add(mast);
      const rotor = new THREE.Group();
      rotor.position.set(x, 26, z);
      for (let b = 0; b < 3; b++) {
        const blade = CityAssets.primitives.createSolidObject(0.5, 11, 0.2, getMaterial(0xf5f5f5, false), 'box');
        blade.position.set(0, 5.5, 0);
        const holder = new THREE.Group();
        holder.rotation.z = (b / 3) * Math.PI * 2;
        holder.add(blade);
        rotor.add(holder);
      }
      rotor.userData = { isRotor: true };
      g.add(rotor);
    }
  }
  const poste = box(4, 3, 3, 0x9aa0a6, 0.8); poste.position.set(14, 1.5, 10); g.add(poste);
  const sign = makeSign(solaire ? NAMES.energie[0] : NAMES.energie[1], 6);
  sign.position.set(14, 3.6, 11.6); g.add(sign);
  return { group: g, footprint: PROGRAM_FOOTPRINT.energie, inhabitants: [], animated: emptyAnimated(), label: PROGRAM_LABEL.energie };
}

function stationService(rng: Rng, level: number): BuiltProgram {
  const g = new THREE.Group();
  const inhabitants: THREE.Group[] = [];
  const canopy = CityAssets.primitives.createSolidObject(14, 0.5, 9, getMaterial(0xf0f0f0, false), 'box');
  canopy.position.set(0, 5, 0); g.add(canopy);
  for (const [x, z] of [[-6, -3.5], [6, -3.5], [-6, 3.5], [6, 3.5]]) {
    const col = box(0.5, 5, 0.5, 0xd0d0d0, 0.9); col.position.set(x, 2.5, z); g.add(col);
  }
  // plus la station est cotée, plus elle a de pistes
  const pumps = level >= 4 ? [-5, -1.5, 2, 5.5] : level >= 2 ? [-3, 0, 3] : [-3, 3];
  for (const x of pumps) {
    const pump = box(1, 1.8, 0.8, 0x2f7f5f, 0.9); pump.position.set(x, 0.9, 0); g.add(pump);
  }
  const shop = box(8, 3.4, 6, 0xe8e8e8, 0.65); shop.position.set(0, 1.7, -9); g.add(shop);
  const sign = makeSign(NAMES.station_service[0], 6, '#ffffff', 'rgba(20,90,60,0.95)');
  sign.position.set(0, 3.8, -5.9); g.add(sign);
  const light = new THREE.PointLight(0xffffee, 1.0, 18); light.position.set(0, 4.5, 0); g.add(light);
  const car = CityAssets.Life.createVehicle(rng.chance(0.5) ? 'car' : 'taxi');
  car.position.set(3, 0.1, 2.5); g.add(car);
  const pompiste = CityAssets.Life.createInhabitant(InhabitantState.WORKING);
  pompiste.position.set(-3, 0.15, 1.5); g.add(pompiste); inhabitants.push(pompiste);
  return { group: g, footprint: PROGRAM_FOOTPRINT.station_service, inhabitants, animated: emptyAnimated(), label: PROGRAM_LABEL.station_service };
}

function telecom(rng: Rng, level: number): BuiltProgram {
  const g = new THREE.Group();
  const h = 22 + level * 4 + rng.range(-3, 5);
  // pylône treillis : quatre montants + entretoises
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = box(0.3, h, 0.3, 0xb8bec4, 0.9);
    leg.position.set(sx * 1.6, h / 2, sz * 1.6);
    leg.rotation.z = -sx * 0.02; leg.rotation.x = sz * 0.02;
    g.add(leg);
  }
  for (let i = 1; i < 6; i++) {
    const ring = box(3.6, 0.15, 3.6, 0xb8bec4, 0.8);
    ring.position.y = (h / 6) * i; g.add(ring);
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const dish = CityAssets.primitives.createWireframeObject(1.6, 1.6, 0.4, 0xdddddd, 0.85, 'cylinder');
    dish.position.set(Math.cos(a) * 2.2, h - 3, Math.sin(a) * 2.2);
    dish.rotation.z = Math.PI / 2; dish.rotation.y = a; g.add(dish);
  }
  const beacon = CityAssets.primitives.createSolidObject(0.6, 0.6, 0.6, getMaterial(0xff3322, false), 'box');
  beacon.position.y = h + 0.4; g.add(beacon);
  const l = new THREE.PointLight(0xff3322, 0.9, 20); l.position.y = h; g.add(l);
  return { group: g, footprint: PROGRAM_FOOTPRINT.telecom, inhabitants: [], animated: emptyAnimated(), label: PROGRAM_LABEL.telecom };
}

/** Fabrique un programme. `level` = savoir-faire de l'architecte (1→5). */
/** Programmes qui sont du paysage plus que du bâti : pas de silhouette LOD. */
const LANDSCAPE: ReadonlySet<ProgramKind> = new Set(['parc', 'ferme', 'energie', 'stade']);

export function createProgram(kind: ProgramKind, rng: Rng, level: number): BuiltProgram {
  const built = buildProgram(kind, rng, level);
  // l'emprise annoncée est toujours celle du cadastre (cf. PROGRAM_FOOTPRINT)
  built.footprint = PROGRAM_FOOTPRINT[kind];
  built.group.userData.program = kind;
  if (LANDSCAPE.has(kind)) built.group.userData.noLod = true;
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
    case 'boulangerie': return commerceDeRue(rng, lv, 'boulangerie');
    case 'cafe': return commerceDeRue(rng, lv, 'cafe');
    case 'hotel': return hotel(rng, lv);
    case 'banque': return banque(rng, lv);
    case 'cinema': return cinema(rng, lv);
    case 'bibliotheque': return bibliotheque(rng, lv);
    case 'musee': return musee(rng, lv);
    case 'stade': return stade(rng, lv);
    case 'caserne': return caserne(rng, lv, false);
    case 'police': return caserne(rng, lv, true);
    case 'poste': return poste(rng, lv);
    case 'gare': return gare(rng, lv);
    case 'universite': return universite(rng, lv);
    case 'ferme': return ferme(rng, lv);
    case 'energie': return energie(rng, lv);
    case 'station_service': return stationService(rng, lv);
    case 'telecom': return telecom(rng, lv);
  }
}
