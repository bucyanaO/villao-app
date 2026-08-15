/**
 * CABINET D'ARCHITECTES — « Atelier Villao ».
 *
 * Cinq agents autonomes qui font grandir la ville ensemble :
 *
 *  - PLAN D'URBANISME : le cabinet compare le parc bâti au programme visé
 *    (logements, commerces, industrie, équipements, espaces verts) et choisit
 *    le programme le plus DÉFICITAIRE. La ville se complète au lieu de se répéter.
 *
 *  - COORDINATION : le chantier est confié à l'agent le plus compétent pour ce
 *    programme, en tenant compte de sa charge de travail — et jamais deux fois
 *    le même programme d'affilée pour un même agent : c'est ce qui produit la
 *    variation architecturale.
 *
 *  - TERRAIN : on cherche une parcelle libre adaptée (l'industrie s'éloigne du
 *    centre, les commerces se posent sur rue, les équipements près des
 *    logements). S'il n'y a plus de terrain, le cabinet OUVRE UNE RUE : la
 *    voirie précède toujours le bâti.
 *
 *  - APPRENTISSAGE : chaque ouvrage livré donne de l'expérience ; le niveau
 *    monte (1→5) et débloque des bâtiments plus riches (étages, toitures
 *    végétalisées, enseignes, quais de chargement…). La progression est
 *    sauvegardée : les agents restent compétents d'une session à l'autre.
 */
import * as THREE from 'three';
import type { ExpansionManager } from '../world/expansion';
import type { ProgramKind } from '../world/programs';
import { PROGRAM_LABEL, PROGRAM_FOOTPRINT } from '../world/programs';
import { freePlots, cityRadius, nearestRoadPoint, roadEndpointsNear, roadsNear, isBuildable } from '../world/zoning';
import { countByKind, buildings as ledgerBuildings, districts as ledgerDistricts } from '../world/ledger';
import { evaluateSite, CLASS_OF, CLUSTERS } from '../world/landuse';
import { traceCorridor } from '../world/streets';

interface Site { x: number; z: number; angle: number; }

export interface Architect {
  id: string;
  name: string;
  title: string;
  /** goût/compétence par programme (0→1), évolue avec la pratique */
  affinity: Partial<Record<ProgramKind, number>>;
  skill: number;      // 1 → 5
  xp: number;
  works: number;
  lastKind?: ProgramKind;
}

export interface StudioEvent {
  t: number;
  text: string;
  kind?: ProgramKind;
  by?: string;
}

const STORE_KEY = 'villao.studio.v1';

const BASE_ROSTER: Architect[] = [
  { id: 'nadia', name: 'Nadia', title: 'Urbaniste en chef', affinity: { mairie: 0.9, parc: 0.8, marche: 0.7 }, skill: 2, xp: 0, works: 0 },
  { id: 'yassine', name: 'Yassine', title: 'Logement', affinity: { maison: 0.9, immeuble: 0.9, hotel: 0.6 }, skill: 2, xp: 0, works: 0 },
  { id: 'iris', name: 'Iris', title: 'Commerce & vie de rue', affinity: { magasin: 0.95, boulangerie: 0.9, cafe: 0.9, marche: 0.85, banque: 0.6 }, skill: 1, xp: 0, works: 0 },
  { id: 'bruno', name: 'Bruno', title: 'Industrie & logistique', affinity: { usine: 0.95, entrepot: 0.95, atelier: 0.8 }, skill: 1, xp: 0, works: 0 },
  { id: 'kenji', name: 'Kenji', title: 'Grande hauteur', affinity: { bureau: 0.95, immeuble: 0.7, hotel: 0.7 }, skill: 2, xp: 0, works: 0 },
  { id: 'omar', name: 'Omar', title: 'Équipements publics', affinity: { ecole: 0.95, universite: 0.9, clinique: 0.9, caserne: 0.85, police: 0.85, poste: 0.8, mairie: 0.7 }, skill: 2, xp: 0, works: 0 },
  { id: 'zoe', name: 'Zoé', title: 'Culture & tourisme', affinity: { musee: 0.95, bibliotheque: 0.9, cinema: 0.9, hotel: 0.8, stade: 0.6 }, skill: 1, xp: 0, works: 0 },
  { id: 'lea', name: 'Léa', title: 'Paysage & agriculture', affinity: { parc: 0.95, ferme: 0.9, stade: 0.7, marche: 0.6 }, skill: 1, xp: 0, works: 0 },
  { id: 'raf', name: 'Raf', title: 'Réseaux & énergie', affinity: { energie: 0.95, telecom: 0.9, gare: 0.85, station_service: 0.85 }, skill: 1, xp: 0, works: 0 },
];

/**
 * MODÈLE DE VILLE — ce que le cabinet a en tête quand il décide.
 *
 * Rien n'est tiré au sort : on déduit la POPULATION du parc de logements, les
 * EMPLOIS des activités, puis on compare les équipements existants à ce qu'une
 * ville de cette taille doit offrir. Le programme retenu est celui dont la
 * ville manque le plus. C'est ce qui la rend cohérente : une école arrive quand
 * il y a des habitants, un stade quand il y a une vraie population, une gare
 * quand la ville est devenue grande.
 */
const HOUSING: Partial<Record<ProgramKind, number>> = { maison: 4, immeuble: 26 };

/** Emplois offerts par programme. */
const JOBS: Partial<Record<ProgramKind, number>> = {
  usine: 45, entrepot: 18, bureau: 60, atelier: 6, ferme: 9, hotel: 22,
  magasin: 4, boulangerie: 3, cafe: 4, marche: 14, banque: 10,
  ecole: 14, universite: 60, clinique: 18, mairie: 20, poste: 8,
  caserne: 14, police: 16, gare: 12, musee: 8, bibliotheque: 6, cinema: 6,
  stade: 8, energie: 6, telecom: 1, station_service: 3, parc: 0, maison: 0, immeuble: 0,
};

/** Un équipement pour N habitants (le service que la ville se doit). */
const SERVICE_PER_CAPITA: Partial<Record<ProgramKind, number>> = {
  boulangerie: 220, magasin: 150, cafe: 260, marche: 900,
  ecole: 320, clinique: 520, parc: 300, poste: 1100, banque: 1300,
  caserne: 1500, police: 1400, bibliotheque: 1200, cinema: 1600,
  station_service: 900, energie: 700, telecom: 1200,
  gare: 2000, musee: 2400, mairie: 2500, stade: 4000, universite: 5000,
};

/** Part des habitants qui doit trouver un emploi dans la ville. */
const ACTIVITY_RATE = 0.48;

/** Programmes d'emploi mobilisables quand le travail manque. */
const EMPLOYERS: ProgramKind[] = ['magasin', 'boulangerie', 'cafe', 'atelier', 'bureau', 'usine', 'entrepot', 'ferme', 'hotel'];

export interface CityReport {
  population: number;
  jobs: number;
  /** Ce qui manque, du plus criant au moins urgent. */
  needs: { kind: ProgramKind; missing: number }[];
}

/**
 * Distance à un CENTRE (centre-ville ou coeur de quartier) — en mètres.
 *
 * On raisonne par rapport au centre le PLUS PROCHE, jamais par rapport au
 * rayon global : dans un monde qui s'étend sans fin, « le centre » est une
 * notion locale. Une usine doit être loin d'un centre habité ; une mairie ou un
 * marché doivent être dedans.
 */
const CENTER_RULE: Partial<Record<ProgramKind, { min?: number; max?: number; ideal?: number }>> = {
  // production et réseaux : à l'écart
  usine: { min: 150 }, entrepot: { min: 140 }, ferme: { min: 240 },
  energie: { min: 200 }, telecom: { min: 130 }, atelier: { min: 60 },
  // le coeur de ville
  mairie: { max: 120, ideal: 60 }, marche: { max: 160, ideal: 70 },
  banque: { max: 180, ideal: 70 }, poste: { max: 200, ideal: 80 },
  bureau: { max: 260, ideal: 90 }, hotel: { max: 220, ideal: 80 },
  gare: { max: 240, ideal: 110 }, cinema: { max: 240, ideal: 110 },
  musee: { max: 260, ideal: 120 }, bibliotheque: { max: 240, ideal: 110 },
  // le quotidien, au pied des logements
  boulangerie: { ideal: 70 }, cafe: { ideal: 80 }, magasin: { ideal: 90 },
  ecole: { min: 40, ideal: 130 }, clinique: { min: 40, ideal: 140 },
  caserne: { min: 60, ideal: 170 }, police: { min: 50, ideal: 160 },
  station_service: { min: 80, ideal: 200 },
  // les grandes emprises, en périphérie
  universite: { min: 80, ideal: 260 }, stade: { min: 140, ideal: 300 },
  maison: { ideal: 170 }, immeuble: { ideal: 110 }, parc: { ideal: 120 },
};

/** Au-delà, on ne bâtit pas : le chantier doit rester dans le monde vécu. */
const WORK_RADIUS = 620;

export interface StudioCtx {
  world: ExpansionManager;
  cityGroup: THREE.Group;
  /** position courante du joueur (pour bâtir là où on peut le voir) */
  playerPos: () => THREE.Vector3;
  onEvent?: (e: StudioEvent) => void;
}

export interface StudioOptions {
  intervalMs?: number;
  /** nombre maximum d'ouvrages par session (0 = illimité : le monde est infini) */
  maxBuilds?: number;
}

export interface Studio {
  start(): void;
  stop(): void;
  roster(): Architect[];
  /** Population, emplois et manques : ce que le cabinet a sous les yeux. */
  report(): CityReport;
  journal(): StudioEvent[];
  /** déclenche un chantier immédiatement (commande console / God Mode) */
  commission(kind?: ProgramKind): string | null;
}

function loadRoster(): Architect[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Architect[];
      if (Array.isArray(saved) && saved.length) {
        // on repart du roster de base et on réapplique la progression sauvegardée
        return BASE_ROSTER.map((a) => {
          const s = saved.find((x) => x.id === a.id);
          return s ? { ...a, skill: s.skill, xp: s.xp, works: s.works, affinity: { ...a.affinity, ...s.affinity } } : a;
        });
      }
    }
  } catch { /* pas de stockage : on démarre à neuf */ }
  return BASE_ROSTER.map((a) => ({ ...a, affinity: { ...a.affinity } }));
}

function saveRoster(roster: Architect[]): void {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(roster)); } catch { /* quota */ }
}

export function createStudio(ctx: StudioCtx, opts: StudioOptions = {}): Studio {
  const intervalMs = opts.intervalMs ?? 9000;
  const maxBuilds = opts.maxBuilds ?? 0;
  const roster = loadRoster();
  const events: StudioEvent[] = [];
  let timer: ReturnType<typeof setInterval> | null = null;
  let sessionBuilds = 0;
  let streetsOpened = 0;

  /** Programmes momentanément infaisables (on n'insiste pas, on y revient). */
  const stalled = new Map<ProgramKind, number>();

  const say = (text: string, extra: Partial<StudioEvent> = {}) => {
    const e: StudioEvent = { t: Date.now(), text, ...extra };
    events.push(e);
    if (events.length > 60) events.shift();
    ctx.onEvent?.(e);
  };

  /** Photographie de la ville : population, emplois, manques. */
  const survey = (): CityReport => {
    const counts = countByKind();
    let population = 0;
    let jobs = 0;
    for (const [kind, n] of Object.entries(counts) as [ProgramKind, number][]) {
      population += (HOUSING[kind] ?? 0) * n;
      jobs += (JOBS[kind] ?? 0) * n;
    }

    const needs: { kind: ProgramKind; missing: number }[] = [];
    const have = (k: ProgramKind) => counts[k] ?? 0;

    // Toutes les urgences sont ramenées à une même échelle de « pression »
    // (0 → 3). Sans cela, le besoin d'emploi — qui se compte en dizaines de
    // postes — écrasait tous les autres et la ville se couvrait de boulangeries.
    const press = (v: number) => Math.max(0, Math.min(3, v));

    // a) les services dus à la population
    for (const [kind, per] of Object.entries(SERVICE_PER_CAPITA) as [ProgramKind, number][]) {
      const required = Math.floor(population / per);
      const missing = required - have(kind);
      if (missing > 0) needs.push({ kind, missing: press(missing) });
    }

    // b) l'emploi : une ville doit faire vivre ses habitants
    const jobsNeeded = Math.round(population * ACTIVITY_RATE) - jobs;
    if (jobsNeeded > 0) {
      const pressure = press(jobsNeeded / 150);
      for (const kind of EMPLOYERS) {
        // à pression égale, on privilégie ce dont la ville a le moins
        needs.push({ kind, missing: pressure - Math.min(1.2, have(kind) / 6) });
      }
    }

    // c) le logement : s'il y a plus d'emplois que d'actifs, on loge
    const housingNeeded = Math.round(jobs / ACTIVITY_RATE) - population;
    if (housingNeeded > 0 || population < 60) {
      needs.push({ kind: 'maison', missing: press(housingNeeded / 60) + (population < 60 ? 2 : 0) });
      needs.push({ kind: 'immeuble', missing: press(housingNeeded / 160) });
    }

    needs.sort((a, b) => b.missing - a.missing);
    return { population, jobs, needs };
  };

  /**
   * Le programme dont la ville manque le plus — avec une petite part de hasard
   * parmi les trois premiers, pour que deux villes ne se ressemblent jamais.
   */
  const chooseKind = (): ProgramKind => {
    const { needs } = survey();
    const open = needs.filter((n) => (stalled.get(n.kind) ?? 0) <= 0);
    if (!open.length) return 'maison';
    const pool = open.slice(0, 3);
    return pool[Math.floor(Math.random() * pool.length)].kind;
  };

  /** L'agent le plus indiqué : compétence d'abord, équité ensuite, variation enfin. */
  const chooseArchitect = (kind: ProgramKind): Architect => {
    let best = roster[0];
    let bestScore = -Infinity;
    const avgWorks = roster.reduce((s, a) => s + a.works, 0) / roster.length;
    for (const a of roster) {
      let score = (a.affinity[kind] ?? 0.2) * 2 + a.skill * 0.15;
      score -= Math.max(0, a.works - avgWorks) * 0.25;      // on partage le travail
      if (a.lastKind === kind) score -= 0.6;                 // on varie les projets
      if (score > bestScore) { bestScore = score; best = a; }
    }
    return best;
  };

  /**
   * Choisit la meilleure parcelle libre pour ce programme.
   *
   * Trois filtres successifs :
   *  1. la BANDE d'éloignement du centre propre au programme ;
   *  2. les DISTANCES DE PRIORITÉ (`landuse.ts`) — c'est ce qui interdit
   *     l'usine à côté des maisons et l'école à côté de l'usine ;
   *  3. le SCORE : proximité du joueur (on voit la ville se faire), et
   *     regroupement en pôle pour l'industrie / dispersion pour le reste.
   */
  /**
   * Cherche un terrain « sur rue » pour ce programme.
   *
   * On ne dépend pas d'un lotissement pré-découpé : on échantillonne le long
   * des VOIES existantes autour du joueur, des deux côtés, au recul qui
   * convient à l'emprise. C'est la façon dont une ville se densifie réellement,
   * et ça marche sur un plan infini — il suffit qu'il y ait une rue.
   *
   * Filtres, dans l'ordre :
   *  1. rester dans le monde vécu (rayon de chantier autour du joueur) ;
   *  2. terrain physiquement libre (cadastre : ni chaussée, ni bâti) ;
   *  3. position par rapport au CENTRE le plus proche (une usine n'est pas
   *     downtown, une mairie si) ;
   *  4. distances de priorité entre familles d'usages (`landuse.ts`).
   */
  const chooseSite = (kind: ProgramKind): Site | null => {
    const player = ctx.playerPos();
    const foot = PROGRAM_FOOTPRINT[kind] ?? 20;
    const existing = ledgerBuildings();
    const cls = CLASS_OF[kind];
    const clusterR = CLUSTERS[cls];
    const rule = CENTER_RULE[kind] ?? {};
    const centers = [{ x: 0, z: 0 }, ...ledgerDistricts().map((d) => ({ x: d.x, z: d.z }))];
    const distToCenter = (x: number, z: number) =>
      Math.min(...centers.map((c) => Math.hypot(c.x - x, c.z - z)));

    let best: Site | null = null;
    let bestScore = -Infinity;
    let tested = 0;

    const consider = (x: number, z: number, angle: number) => {
      if (tested++ > 1400) return;                       // budget par chantier
      const dp = Math.hypot(x - player.x, z - player.z);
      if (dp > WORK_RADIUS) return;
      if (!isBuildable(x, z, foot)) return;

      const dc = distToCenter(x, z);
      if (rule.min !== undefined && dc < rule.min) return;
      if (rule.max !== undefined && dc > rule.max) return;

      const verdict = evaluateSite(kind, x, z, existing);
      if (!verdict.ok) return;

      let score = -dp / 220;
      if (rule.ideal !== undefined) score -= Math.abs(dc - rule.ideal) / 320;
      if (clusterR) {
        score += verdict.poleDistance === Infinity ? 0 : Math.max(0, 1 - verdict.poleDistance / (clusterR * 3)) * 1.5;
      } else if (verdict.poleDistance !== Infinity) {
        score += Math.min(verdict.poleDistance, 120) / 300;
      }
      if (score > bestScore) { bestScore = score; best = { x, z, angle }; }
    };

    // 1) les parcelles déjà loties (les dents creuses des quartiers)
    // (la taille déclarée de la parcelle n'est qu'indicative : le juge de paix,
    //  c'est `isBuildable`, qui regarde le voisinage réel)
    for (const p of freePlots()) consider(p.x, p.z, Math.atan2(-p.x, -p.z));

    // 2) le long des rues : la vraie source de terrain, infinie
    for (const seg of roadsNear(player, WORK_RADIUS)) {
      const dx = seg.x2 - seg.x1, dz = seg.z2 - seg.z1;
      const len = Math.hypot(dx, dz);
      if (len < 6) continue;              // même les arcs d'un rond-point comptent
      const ux = dx / len, uz = dz / len;
      const nx = uz, nz = -ux;
      const setback = seg.w / 2 + foot / 2 + 2.5;
      const step = Math.max(14, foot * 0.85);
      for (let t = Math.min(step / 2, len / 2); t <= len; t += step) {
        for (const side of [-1, 1]) {
          const x = seg.x1 + ux * t + nx * side * setback;
          const z = seg.z1 + uz * t + nz * side * setback;
          // la façade regarde la rue
          consider(x, z, Math.atan2(-side * nx, -side * nz));
        }
      }
    }

    return best;
  };

  /**
   * Direction dans laquelle ouvrir du foncier pour ce programme.
   * L'industrie va TOUJOURS vers son pôle (ou en crée un à l'écart du joueur) :
   * c'est ainsi qu'on obtient une vraie zone d'activités, pas des usines
   * saupoudrées entre les maisons.
   */
  const angleFor = (kind: ProgramKind): number => {
    const player = ctx.playerPos();
    if (CLASS_OF[kind] === 'industrie') {
      const pole = ledgerBuildings().find((b) => CLASS_OF[b.kind as ProgramKind] === 'industrie');
      if (pole) return Math.atan2(pole.x, pole.z);
      // pas encore de zone d'activités : on l'amorce vers l'extérieur, dans le
      // prolongement du rayon qui passe par le joueur (donc atteignable, mais
      // en périphérie).
      return Math.atan2(player.x, player.z);
    }
    return Math.atan2(player.x, player.z) + (Math.random() - 0.5) * 0.8;
  };

  /**
   * Plus de terrain adapté : on ouvre une rue NEUVE.
   *
   * On ne perce jamais à travers le bâti. On PROLONGE le réseau existant par
   * ses extrémités, ou on s'y greffe en équerre là où le couloir est libre —
   * exactement comme une ville gagne du terrain. Chaque rue ouverte crée du
   * foncier des deux côtés, et le monde peut donc s'étendre indéfiniment.
   */
  const openNewStreet = (kind: ProgramKind = 'maison'): boolean => {
    const R = Math.max(80, cityRadius());
    const player = ctx.playerPos();

    // vers où ? l'industrie rejoint son pôle, le reste se greffe près du joueur
    let target = { x: player.x, z: player.z };
    if (CLASS_OF[kind] === 'industrie') {
      const pole = ledgerBuildings().find((b) => CLASS_OF[b.kind as ProgramKind] === 'industrie');
      if (pole) {
        target = { x: pole.x, z: pole.z };
      } else {
        // on amorce la zone d'activités en périphérie, mais à portée de chantier
        const a = angleFor(kind);
        const reach = Math.min(R * 1.1, Math.hypot(player.x, player.z) + 260);
        target = { x: Math.sin(a) * reach, z: Math.cos(a) * reach };
      }
    }

    // ancrages possibles : les bouts de rue voisins, puis le point de voirie le
    // plus proche (greffe en peigne)
    const anchors: { x: number; z: number; angle: number }[] = roadEndpointsNear(target, WORK_RADIUS);
    const grafted = nearestRoadPoint(target);
    if (grafted) anchors.push(grafted);
    anchors.sort((a, b) =>
      Math.hypot(a.x - target.x, a.z - target.z) - Math.hypot(b.x - target.x, b.z - target.z));

    for (const anchor of anchors.slice(0, 12)) {
      if (Math.hypot(anchor.x - player.x, anchor.z - player.z) > WORK_RADIUS) continue;
      const candidates = [
        anchor.angle,                       // prolonger la voie
        anchor.angle + Math.PI / 2, anchor.angle - Math.PI / 2,   // greffe en équerre
        anchor.angle + Math.PI / 4, anchor.angle - Math.PI / 4,
      ];
      for (const a of candidates) {
        const end = traceCorridor(anchor, a, 10, 240, 60);
        if (!end) continue;
        ctx.world.openStreet(anchor, end, 10);
        streetsOpened++;
        say(`Nadia fait tracer une rue nouvelle (${streetsOpened}) — ${Math.round(Math.hypot(end.x - anchor.x, end.z - anchor.z))} m de foncier rouvert.`);
        return true;
      }
    }
    return false;
  };

  const commission = (forced?: ProgramKind): string | null => {
    if (maxBuilds && sessionBuilds >= maxBuilds) return null;

    for (const [k, n] of stalled) stalled.set(k, n - 1);
    const kind = forced ?? chooseKind();
    let site = chooseSite(kind);
    if (!site) {
      // Aucun terrain ne convient à CE programme : on ne le case pas ailleurs de
      // force. On ouvre du foncier dans la bonne direction (zone d'activités
      // pour l'industrie), puis on retente aussitôt sur la rue neuve.
      const opened = openNewStreet(kind);
      site = chooseSite(kind);
      if (!site) {
        // on met ce programme de côté quelques tours plutôt que de boucler dessus
        stalled.set(kind, opened ? 2 : 6);
        return null;
      }
    }

    const architect = chooseArchitect(kind);
    const ok = ctx.world.place(kind, site.x, site.z, site.angle, architect.skill, architect.name);
    if (!ok) { say(`${architect.name} renonce : terrain impraticable.`); return null; }

    // --- apprentissage
    architect.works++;
    architect.xp++;
    architect.lastKind = kind;
    architect.affinity[kind] = Math.min(1, (architect.affinity[kind] ?? 0.2) + 0.08);
    const newSkill = Math.min(5, 1 + Math.floor(architect.xp / 4));
    const promoted = newSkill > architect.skill;
    architect.skill = newSkill;
    saveRoster(roster);
    sessionBuilds++;

    say(
      `${architect.name} (${architect.title}) livre ${PROGRAM_LABEL[kind]} — niveau ${architect.skill}` +
      (promoted ? ` · monte en compétence !` : ''),
      { kind, by: architect.name },
    );
    return PROGRAM_LABEL[kind];
  };

  return {
    start() {
      if (timer) return;
      say('Atelier Villao ouvre le chantier : la ville va se construire toute seule.');
      timer = setInterval(() => { try { commission(); } catch (e) { console.warn('[studio]', e); } }, intervalMs);
    },
    stop() { if (timer) { clearInterval(timer); timer = null; } },
    roster: () => roster,
    report: survey,
    journal: () => events,
    commission,
  };
}
