/**
 * WORLD / EXPANSION — le monde qui se développe presque à l'infini.
 *
 * Trois rôles, tous pilotés par le registre (`ledger.ts`) :
 *
 *  1. CROISSANCE — quand le joueur approche de la frontière urbaine, un nouveau
 *     quartier naît devant lui, relié au réseau : une avenue radiale vers le
 *     centre PLUS une rocade vers le quartier voisin le plus proche. Les villes
 *     et les quartiers forment donc un vrai réseau, pas une étoile.
 *
 *  2. STREAMING — seuls les actes proches du joueur sont instanciés en 3D. Les
 *     autres restent des lignes de registre (quelques octets) et sont rejoués à
 *     l'identique quand on y revient. La mémoire reste bornée, le monde non.
 *
 *  3. PERSISTANCE — tout ce qui a été bâti est dans le registre sauvegardé :
 *     au rechargement, la ville est exactement celle qu'on avait laissée.
 */
import * as THREE from 'three';
import type { AnimState } from '../context';
import { setCityRadius, refreshPlotMarkers, occupy, isOnRoad, consumePlotsAt, setPlayerReserve } from './zoning';
import {
  buildDistrict, planDistrict, registerDistrictPlan,
  DISTRICT_THEMES, DISTRICT_HALF, DISTRICT_LABEL,
  type DistrictTheme, type DistrictPlan,
} from './districts';
import { paveStreet, registerStreet, isCorridorClear } from './streets';
import { createProgram, PROGRAM_FOOTPRINT, PROGRAM_LABEL, type ProgramKind } from './programs';
import { makeRng, newSeed } from './rng';
import { attachLod } from './lod';
import {
  openLedger, record, setFrontier, frontier as ledgerFrontier, save,
  districts as ledgerDistricts, buildings as ledgerBuildings, streets as ledgerStreets,
  type Act, type BuildingAct, type DistrictAct, type StreetAct,
} from './ledger';

export interface ExpansionCtx {
  cityGroup: THREE.Group;
  animRef: { current: AnimState };
  /** notification (HUD / console) quand quelque chose sort de terre */
  onDistrict?: (label: string, index: number) => void;
  onBuilding?: (label: string, by: string) => void;
  /** le sol/la végétation doivent être resemés autour de ce point */
  onGroundChanged?: (x: number, z: number, radius: number) => void;
}

export interface ExpansionManager {
  /** À appeler ~1×/s depuis la boucle : croissance + streaming. */
  update(playerPos: THREE.Vector3): void;
  /** Après `generateCity` : ouvre le registre du style et rejoue la ville. */
  reset(baseRadius: number, style: string, anchors?: { x: number; z: number }[]): void;
  /** Force la naissance d'un quartier (commande God Mode / cabinet). */
  grow(angle?: number): string | null;
  /** Inscrit ET matérialise un bâtiment (utilisé par le cabinet d'architectes). */
  place(kind: ProgramKind, x: number, z: number, angle: number, level: number, by: string): boolean;
  /** Ouvre une voie nouvelle (et les parcelles qui la bordent). */
  /** Trace une voie. Retourne false si le couloir n'était pas libre. */
  openStreet(a: { x: number; z: number }, b: { x: number; z: number }, width?: number, plots?: boolean): boolean;
  count(): number;
  frontier(): number;
  /** Recensement des programmes bâtis dans les quartiers (hors registre). */
  census(): Record<string, number>;
  /** Tous les lieux (ouvrages du registre + bâtiments des quartiers) près d'un point. */
  places(p: { x: number; z: number }, radius: number): { x: number; z: number; kind: string }[];
}

const LOAD_RADIUS = 430;     // au-delà, un acte n'est plus matérialisé…
const UNLOAD_RADIUS = 620;   // …et on ne le retire qu'un peu plus loin (hystérésis)

export function createExpansionManager(ctx: ExpansionCtx): ExpansionManager {
  let nextTheme = 0;
  let anchors: { x: number; z: number }[] = [{ x: 0, z: 0 }];
  const loaded = new Map<number, THREE.Object3D>();
  /** plans de quartier, calculés une fois puis conservés (cadastre + rendu) */
  const plans = new Map<number, DistrictPlan>();

  const dist2 = (a: { x: number; z: number }, b: { x: number; z: number }) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;

  /** Options de parcellaire d'une rue nouvelle (identiques cadastre / rendu). */
  const streetPlotOpts = (act: StreetAct) => (act.plots
    ? { size: 13, step: 24, setback: act.w / 2 + 11, label: 'Rue nouvelle' }
    : undefined);

  // --- CADASTRE : inscrire un acte sans rien dessiner -----------------------

  /**
   * Le cadastre connaît TOUS les actes, même ceux qui sont à des kilomètres.
   * C'est la condition pour que la ville se reconstruise à l'identique : les
   * décisions de constructibilité voient toujours le même terrain.
   */
  const registerAct = (act: Act): void => {
    if (act.t === 'district') {
      const plan = planDistrict({
        center: { x: act.x, z: act.z }, angle: act.angle,
        theme: act.theme as DistrictTheme, seed: act.seed, actId: act.id,
      });
      plans.set(act.id, plan);
      registerDistrictPlan(plan);
      return;
    }
    if (act.t === 'street') {
      registerStreet({ x: act.ax, z: act.az }, { x: act.bx, z: act.bz },
        { width: act.w, plots: streetPlotOpts(act) }, act.id);
      return;
    }
    occupy(act.x, act.z, (PROGRAM_FOOTPRINT[act.kind as ProgramKind] ?? 20) / 2, act.id);
  };

  // --- matérialisation d'un acte -------------------------------------------

  const materialize = (act: Act): THREE.Object3D | null => {
    if (act.t === 'district') {
      const plan = plans.get(act.id);
      if (!plan) return null;   // le cadastre passe toujours avant le rendu
      const built = buildDistrict({ cityGroup: ctx.cityGroup, animRef: ctx.animRef, plan });
      // chaque bâtiment du quartier a son proxy : de loin, un quartier entier
      // ne coûte plus que quelques dizaines d'appels de dessin
      for (const b of ctx.animRef.current.buildingsList) {
        if (b.userData.actId === act.id) attachLod(b);
      }
      return built.group;
    }
    if (act.t === 'street') {
      const paved = paveStreet({ x: act.ax, z: act.az }, { x: act.bx, z: act.bz }, {
        width: act.w, lampEvery: 22, plots: streetPlotOpts(act),
      });
      paved.group.userData.actId = act.id;
      ctx.cityGroup.add(paved.group);
      return paved.group;
    }
    // bâtiment signé par un architecte
    const b = act as BuildingAct;
    const prog = createProgram(b.kind as ProgramKind, makeRng(b.seed), b.level);
    prog.group.position.set(b.x, 0, b.z);
    prog.group.rotation.y = b.angle;
    prog.group.userData = { ...prog.group.userData, isBuilding: true, expanded: false, actId: b.id, program: b.kind, by: b.by, footprint: prog.footprint };
    ctx.cityGroup.add(prog.group);
    ctx.animRef.current.buildingsList.push(prog.group);
    prog.inhabitants.forEach((i) => { i.userData.actId = b.id; ctx.animRef.current.inhabitantsList.push(i); });
    prog.animated.fans.forEach((f) => ctx.animRef.current.fanList.push(f));
    prog.animated.screens.forEach((s) => ctx.animRef.current.screenList.push(s));
    attachLod(prog.group);
    return prog.group;
  };

  const dematerialize = (actId: number) => {
    const obj = loaded.get(actId);
    if (!obj) return;
    loaded.delete(actId);
    // les proxies LOD sont des frères : on les retire avec l'acte
    for (const b of ctx.animRef.current.buildingsList) {
      if (b.userData.actId === actId && b.userData.lodProxy) {
        const p = b.userData.lodProxy as THREE.Object3D;
        p.parent?.remove(p);
      }
    }
    obj.traverse((c: any) => { if (c.geometry) c.geometry.dispose(); });
    obj.parent?.remove(obj);
    const A = ctx.animRef.current;
    const keep = (o: any) => o.userData?.actId !== actId;
    A.inhabitantsList = A.inhabitantsList.filter(keep);
    A.vehiclesList = A.vehiclesList.filter(keep);
    A.buildingsList = A.buildingsList.filter(keep);
  };

  /** Charge/décharge les actes selon la distance au joueur. */
  const stream = (player: { x: number; z: number }) => {
    const load2 = LOAD_RADIUS ** 2, unload2 = UNLOAD_RADIUS ** 2;
    const all: Act[] = [...ledgerDistricts(), ...ledgerStreets(), ...ledgerBuildings()];
    for (const act of all) {
      const p = act.t === 'street'
        ? { x: (act.ax + act.bx) / 2, z: (act.az + act.bz) / 2 }
        : { x: (act as any).x, z: (act as any).z };
      const d2 = dist2(p, player);
      const isLoaded = loaded.has(act.id);
      if (!isLoaded && d2 < load2) {
        const obj = materialize(act);
        if (obj) loaded.set(act.id, obj);
      } else if (isLoaded && d2 > unload2) {
        dematerialize(act.id);
      }
    }
  };

  // --- croissance -----------------------------------------------------------

  /**
   * Relie deux points par une voie inscrite au registre.
   * Refuse si le tracé traverserait du bâti : une route ne passe jamais à
   * travers un quartier déjà construit.
   */
  const link = (a: { x: number; z: number }, b: { x: number; z: number }, width = 12, plotsAlong = false): boolean => {
    if (!isCorridorClear(a, b, width)) return false;
    const act = record({ t: 'street', ax: a.x, az: a.z, bx: b.x, bz: b.z, w: width, plots: plotsAlong }) as StreetAct;
    registerAct(act);
    const obj = materialize(act);
    if (obj) loaded.set(act.id, obj);
    return true;
  };

  const grow = (angleHint?: number): string | null => {
    const existing = ledgerDistricts();
    // on évite d'empiler deux quartiers dans la même direction
    let angle = angleHint ?? Math.random() * Math.PI * 2;
    for (let tries = 0; tries < 16; tries++) {
      const clash = existing.some((dact) => {
        const a = Math.atan2(dact.x, dact.z);
        const delta = Math.abs(Math.atan2(Math.sin(a - angle), Math.cos(a - angle)));
        const sameRing = Math.abs(Math.hypot(dact.x, dact.z) - ledgerFrontier()) < DISTRICT_HALF * 2;
        return delta < 0.55 && sameRing;
      });
      if (!clash) break;
      angle += 0.62;
    }

    const dist = ledgerFrontier() + DISTRICT_HALF + 12;
    const center = { x: Math.sin(angle) * dist, z: Math.cos(angle) * dist };

    // Choix du thème : on parcourt le catalogue (pour la variété) mais on
    // respecte les distances de priorité — une zone industrielle ne s'ouvre pas
    // à côté d'un quartier habité, et réciproquement.
    const HEAVY: DistrictTheme[] = ['industriel', 'megastructure'];
    const conflicts = (t: DistrictTheme) => existing.some((d) => {
      const near = Math.hypot(d.x - center.x, d.z - center.z) < 230;
      if (!near) return false;
      const heavyHere = HEAVY.includes(t);
      const heavyThere = HEAVY.includes(d.theme as DistrictTheme);
      return heavyHere !== heavyThere;   // lourd contre habité : refusé
    });
    let theme: DistrictTheme = DISTRICT_THEMES[nextTheme % DISTRICT_THEMES.length];
    for (let i = 0; i < DISTRICT_THEMES.length; i++) {
      const candidate = DISTRICT_THEMES[(nextTheme + i) % DISTRICT_THEMES.length];
      if (!conflicts(candidate)) { theme = candidate; nextTheme += i; break; }
    }
    nextTheme++;

    // 1. l'avenue radiale (le lien avec la ville d'origine)
    link(
      { x: Math.sin(angle) * (ledgerFrontier() - 10), z: Math.cos(angle) * (ledgerFrontier() - 10) },
      { x: Math.sin(angle) * (dist - DISTRICT_HALF + 4), z: Math.cos(angle) * (dist - DISTRICT_HALF + 4) },
      12,
    );

    // 2. la rocade vers le voisin le plus proche (villes/quartiers connectés)
    const neighbours = [...existing.map((d) => ({ x: d.x, z: d.z })), ...anchors.slice(1)];
    let best: { x: number; z: number } | null = null;
    let bestD = Infinity;
    for (const n of neighbours) {
      const d2 = dist2(n, center);
      if (d2 < bestD) { bestD = d2; best = n; }
    }
    if (best && bestD > 400 && bestD < 420 ** 2) link(best, center, 10);

    // 3. le quartier lui-même
    const act = record({ t: 'district', x: center.x, z: center.z, angle, theme, seed: newSeed() }) as DistrictAct;
    registerAct(act);
    const obj = materialize(act);
    if (obj) loaded.set(act.id, obj);

    ctx.onGroundChanged?.(center.x, center.z, DISTRICT_HALF + 20);
    setFrontier(dist + DISTRICT_HALF * 0.8);
    setCityRadius(ledgerFrontier());
    refreshPlotMarkers(ctx.cityGroup, center);
    save();

    const label = DISTRICT_LABEL[theme];
    ctx.onDistrict?.(label, ledgerDistricts().length);
    return label;
  };

  return {
    update(playerPos: THREE.Vector3) {
      const player = { x: playerPos.x, z: playerPos.z };
      setPlayerReserve(player.x, player.z);   // on ne bâtit pas sur le joueur
      const d = Math.hypot(player.x, player.z);
      if (d > ledgerFrontier() - 90) grow(Math.atan2(player.x, player.z));
      stream(player);
    },

    reset(radius: number, style: string, cityAnchors?: { x: number; z: number }[]) {
      // on repart du noyau : plus rien de matérialisé, le registre reprend la main
      for (const id of [...loaded.keys()]) dematerialize(id);
      nextTheme = 0;
      anchors = [{ x: 0, z: 0 }, ...(cityAnchors ?? [])];
      plans.clear();
      openLedger(style, radius);
      setFrontier(radius);
      setCityRadius(ledgerFrontier());
      // 1. tout le cadastre est rejoué, dans l'ordre d'origine (déterminisme) ;
      // 2. seul le proche est matérialisé (le monde peut être immense).
      for (const act of [...ledgerDistricts(), ...ledgerStreets(), ...ledgerBuildings()].sort((x, y) => x.id - y.id)) {
        registerAct(act);
      }
        stream({ x: 0, z: 0 });
    },

    grow,

    place(kind: ProgramKind, x: number, z: number, angle: number, level: number, by: string) {
      // dernier verrou : jamais un ouvrage sur la chaussée, même si une voie a
      // été percée après l'ouverture de la parcelle
      const foot = PROGRAM_FOOTPRINT[kind] ?? 20;
      if (isOnRoad(x, z, foot / 2)) return false;
      const act = record({ t: 'building', kind, x, z, angle, level, seed: newSeed(), by }) as BuildingAct;
      registerAct(act);
      consumePlotsAt(x, z, foot / 2);
      const obj = materialize(act);
      if (!obj) return false;
      loaded.set(act.id, obj);
      save();   // un ouvrage livré est un ouvrage acquis : on l'écrit tout de suite
      setFrontier(Math.hypot(x, z) + 40);
      setCityRadius(ledgerFrontier());
        refreshPlotMarkers(ctx.cityGroup, { x, z });
      ctx.onGroundChanged?.(x, z, foot);
      ctx.onBuilding?.(PROGRAM_LABEL[kind], by);
      return true;
    },

    openStreet(a, b, width = 10, plots = true) {
      if (!link(a, b, width, plots)) return false;
      ctx.onGroundChanged?.((a.x + b.x) / 2, (a.z + b.z) / 2, Math.hypot(b.x - a.x, b.z - a.z) / 2 + 30);
      save();
      return true;
    },

    count: () => ledgerDistricts().length,
    frontier: () => ledgerFrontier(),

    places(p, radius) {
      // Les citoyens vivent dans TOUTE la ville, y compris les quartiers dont
      // les bâtiments ne sont pas des actes individuels.
      const r2 = radius * radius;
      const out: { x: number; z: number; kind: string }[] = [];
      for (const b of ledgerBuildings()) {
        if ((b.x - p.x) ** 2 + (b.z - p.z) ** 2 < r2) out.push({ x: b.x, z: b.z, kind: b.kind });
      }
      const FORM_AS: Record<string, string> = {
        'F:oldtown': 'maison', 'F:brutal': 'immeuble', 'F:futur': 'bureau', 'F:mega': 'immeuble',
      };
      for (const plan of plans.values()) {
        if ((plan.center.x - p.x) ** 2 + (plan.center.z - p.z) ** 2 > (radius + 90) ** 2) continue;
        for (const slot of plan.slots) {
          if (slot.skip) continue;
          if ((slot.x - p.x) ** 2 + (slot.z - p.z) ** 2 > r2) continue;
          out.push({ x: slot.x, z: slot.z, kind: FORM_AS[slot.kind as string] ?? (slot.kind as string) });
        }
      }
      return out;
    },

    census() {
      // Les bâtiments d'un quartier ne sont pas des actes individuels (c'est le
      // quartier qui l'est). Sans ce recensement, le cabinet croirait la ville
      // vide et bâtirait des équipements pour personne.
      const out: Record<string, number> = {};
      const FORM_AS: Record<string, string> = {
        'F:oldtown': 'maison', 'F:brutal': 'immeuble', 'F:futur': 'bureau', 'F:mega': 'immeuble',
      };
      for (const plan of plans.values()) {
        for (const slot of plan.slots) {
          if (slot.skip) continue;
          const kind = FORM_AS[slot.kind as string] ?? (slot.kind as string);
          out[kind] = (out[kind] ?? 0) + 1;
        }
      }
      return out;
    },
  };
}
