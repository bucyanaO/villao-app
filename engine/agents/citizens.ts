/**
 * CITOYENS — la ville habitée.
 *
 * Les passants du générateur d'origine tournent en rond dans une boîte. Ici,
 * chaque citoyen a un DOMICILE, un TRAVAIL et une JOURNÉE : il part travailler,
 * fait ses courses à la boulangerie ou au marché, passe au parc ou au café,
 * puis rentre. Ses destinations sont de vrais bâtiments du registre — donc la
 * vie qu'on voit dans la rue est le reflet exact de ce que le cabinet
 * d'architectes a construit.
 *
 * Le peuplement est local : on ne simule que ce qui est autour du joueur (les
 * autres n'existent pas tant qu'on ne les regarde pas), ce qui reste compatible
 * avec un monde sans fin.
 */
import * as THREE from 'three';
import { CityAssets, InhabitantState } from '../assets';
import { isClear } from '../world/zoning';

/** Un lieu de la ville (ouvrage du registre ou bâtiment de quartier). */
export interface Place { x: number; z: number; kind: string; }

type Activity = 'travail' | 'courses' | 'loisir' | 'maison';

const HOMES = new Set(['maison', 'immeuble', 'hotel']);
const WORKPLACES = new Set([
  'bureau', 'usine', 'entrepot', 'atelier', 'ferme', 'magasin', 'boulangerie', 'cafe',
  'marche', 'banque', 'ecole', 'universite', 'clinique', 'mairie', 'poste', 'caserne',
  'police', 'gare', 'musee', 'bibliotheque', 'cinema', 'hotel', 'station_service',
]);
const SHOPS = new Set(['magasin', 'boulangerie', 'marche', 'cafe']);
const LEISURE = new Set(['parc', 'cafe', 'cinema', 'stade', 'musee', 'bibliotheque']);

const PRENOMS = [
  'Marc', 'Sara', 'Léo', 'Nour', 'Yann', 'Aïcha', 'Tom', 'Inès', 'Hugo', 'Lina',
  'Paul', 'Fatou', 'Jonas', 'Emma', 'Ali', 'Chloé', 'Théo', 'Maya', 'Samir', 'Jade',
];

/** Ce qu'on fait dans la vie, selon l'endroit où l'on travaille. */
const METIER: Record<string, string> = {
  boulangerie: 'boulanger', cafe: 'serveur', magasin: 'vendeur', marche: 'maraîcher',
  banque: 'banquier', hotel: 'réceptionniste', bureau: 'employé de bureau',
  usine: 'ouvrier', entrepot: 'magasinier', atelier: 'mécanicien', ferme: 'agriculteur',
  ecole: 'professeur', universite: 'chercheur', clinique: 'infirmier', mairie: 'agent municipal',
  poste: 'facteur', caserne: 'pompier', police: 'policier', gare: 'cheminot',
  musee: 'guide', bibliotheque: 'bibliothécaire', cinema: 'projectionniste',
  station_service: 'pompiste', immeuble: 'gardien', maison: 'retraité',
};

const ACTIVITY_TEXT: Record<Activity, string> = {
  travail: 'part travailler',
  courses: 'fait ses courses',
  loisir: 'se promène',
  maison: 'rentre chez lui',
};

interface Citizen {
  mesh: THREE.Group;
  name: string;
  job: string;
  home: { x: number; z: number };
  work: { x: number; z: number } | null;
  target: { x: number; z: number };
  activity: Activity;
  speed: number;
  wait: number;
  phase: number;
}

export interface CitizenLife {
  /** À appeler chaque frame (peu coûteux : quelques dizaines d'agents). */
  update(dt: number, time: number, player: THREE.Vector3): void;
  /** Le groupe qui porte les citoyens (pour le viseur d'interaction). */
  group(): THREE.Group;
  count(): number;
  dispose(): void;
}

export interface CitizenOptions {
  /** Où sont les bâtiments (registre + quartiers) autour d'un point. */
  places: (p: { x: number; z: number }, radius: number) => Place[];
  /** Nombre de citoyens simulés autour du joueur. */
  population?: number;
  /** Rayon de simulation (au-delà, on recycle le citoyen ailleurs). */
  radius?: number;
  /** Durée d'une journée simulée, en secondes réelles. */
  dayLength?: number;
}

const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

export function createCitizenLife(scene: THREE.Object3D, opts: CitizenOptions): CitizenLife {
  const POP = opts.population ?? 26;
  const RADIUS = opts.radius ?? 260;
  const DAY = opts.dayLength ?? 240;
  const citizens: Citizen[] = [];
  const holder = new THREE.Group();
  holder.userData = { isCitizens: true };
  scene.add(holder);
  let rebuildClock = 0;
  let pool: Place[] = [];

  const near = (player: THREE.Vector3, set: Set<string>): Place[] =>
    pool.filter((b) => set.has(b.kind) && dist(b, player) < RADIUS);

  const pick = <T,>(arr: T[]): T | null => (arr.length ? arr[Math.floor(Math.random() * arr.length)] : null);

  /** Où doit-on être à cette heure-ci ? */
  const scheduleFor = (hour: number): Activity => {
    if (hour < 7 || hour >= 21) return 'maison';
    if (hour < 12) return 'travail';
    if (hour < 14) return 'courses';
    if (hour < 18) return 'travail';
    return 'loisir';
  };

  const destinationFor = (c: Citizen, activity: Activity, player: THREE.Vector3): { x: number; z: number } => {
    if (activity === 'maison') return c.home;
    if (activity === 'travail' && c.work) return c.work;
    const set = activity === 'courses' ? SHOPS : LEISURE;
    const b = pick(near(player, set));
    return b ? { x: b.x, z: b.z } : c.home;
  };

  const spawn = (player: THREE.Vector3, hour: number): Citizen | null => {
    const home = pick(near(player, HOMES));
    if (!home) return null;
    const work = pick(near(player, WORKPLACES));
    const mesh = CityAssets.Life.createInhabitant(InhabitantState.WALKING);
    // on ne l'inscrit PAS dans la liste d'animation globale : sa marche est
    // dirigée par un but, pas par l'errance aléatoire du décor.
    mesh.position.set(home.x + (Math.random() - 0.5) * 8, 0.2, home.z + (Math.random() - 0.5) * 8);
    mesh.userData.isCitizen = true;
    holder.add(mesh);

    const name = PRENOMS[Math.floor(Math.random() * PRENOMS.length)];
    const job = work ? (METIER[work.kind] ?? 'habitant') : 'habitant';

    const c: Citizen = {
      mesh, name, job,
      home: { x: home.x, z: home.z },
      work: work ? { x: work.x, z: work.z } : null,
      target: { x: home.x, z: home.z },
      activity: 'maison',
      speed: 1.5 + Math.random() * 1.4,
      wait: Math.random() * 3,
      phase: Math.random() * 100,
    };
    c.activity = scheduleFor(hour);
    c.target = destinationFor(c, c.activity, player);

    // On peut l'aborder : il devient un interlocuteur à part entière, avec son
    // métier et ce qu'il est en train de faire.
    mesh.userData.type = 'ai-agent';
    mesh.userData.persona = {
      id: `citoyen-${name}-${Math.round(home.x)}-${Math.round(home.z)}`,
      role: job,
      name,
      systemPrompt:
        `Tu es ${name}, ${job} dans la Cité Voxel. Tu habites tout près et tu ` +
        `${ACTIVITY_TEXT[c.activity]}. Tu parles simplement, de ta vie de quartier, ` +
        `de ton travail et de ce que tu vois autour de toi. Réponds en français, 2 à 3 phrases.`,
      goals: ['vivre sa journée', 'parler du quartier'],
      location: { x: home.x, z: home.z },
    };

    citizens.push(c);
    return c;
  };

  const remove = (c: Citizen) => {
    c.mesh.parent?.remove(c.mesh);
    const i = citizens.indexOf(c);
    if (i >= 0) citizens.splice(i, 1);
  };

  return {
    update(dt, time, player) {
      // le vivier de bâtiments est rafraîchi lentement : le registre bouge peu
      rebuildClock -= dt;
      if (rebuildClock <= 0) {
        rebuildClock = 3;
        pool = opts.places({ x: player.x, z: player.z }, RADIUS * 1.4);
        // recyclage : ceux qu'on a semés trop loin repartent ailleurs
        for (const c of [...citizens]) {
          if (dist({ x: c.mesh.position.x, z: c.mesh.position.z }, player) > RADIUS * 1.6) remove(c);
        }
        while (citizens.length < POP) { if (!spawn(player, ((time / DAY) * 24) % 24)) break; }
      }

      const hour = ((time / DAY) * 24) % 24;

      for (const c of citizens) {
        const p = c.mesh.position;

        // arrivé ? on souffle, puis on se donne un nouveau but
        const d = Math.hypot(c.target.x - p.x, c.target.z - p.z);
        if (d < 2.5) {
          c.wait -= dt;
          if (c.wait <= 0) {
            const want = scheduleFor(hour);
            c.activity = want;
            if (c.mesh.userData.persona) c.mesh.userData.persona.role = `${c.job}, ${ACTIVITY_TEXT[want]}`;
            c.target = destinationFor(c, want, player);
            c.wait = 2 + Math.random() * 6;
          }
          // sur place : on s'anime doucement, on ne glisse pas
          if (c.mesh.userData.parts) {
            c.mesh.userData.parts.leftLeg.rotation.x *= 0.85;
            c.mesh.userData.parts.rightLeg.rotation.x *= 0.85;
          }
          continue;
        }

        // marche vers le but, avec un contournement simple des obstacles
        let dirX = (c.target.x - p.x) / d;
        let dirZ = (c.target.z - p.z) / d;
        const step = c.speed * dt;
        const aheadX = p.x + dirX * 2.2;
        const aheadZ = p.z + dirZ * 2.2;
        if (!isClear(aheadX, aheadZ, 0.8)) {
          // obstacle : on longe (rotation d'un quart de tour, alternée)
          const side = (c.phase % 2 < 1) ? 1 : -1;
          const nx = -dirZ * side, nz = dirX * side;
          dirX = (dirX + nx * 1.6) / 2;
          dirZ = (dirZ + nz * 1.6) / 2;
          const n = Math.hypot(dirX, dirZ) || 1;
          dirX /= n; dirZ /= n;
        }
        p.x += dirX * step;
        p.z += dirZ * step;
        p.y = 0.2;

        const targetRot = Math.atan2(dirX, dirZ);
        let diff = targetRot - c.mesh.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        c.mesh.rotation.y += diff * Math.min(1, 6 * dt);

        const parts = c.mesh.userData.parts;
        if (parts) {
          const w = Math.sin(time * 7 + c.phase);
          parts.leftLeg.rotation.x = w * 0.55;
          parts.rightLeg.rotation.x = -w * 0.55;
          parts.leftArm.rotation.x = -w * 0.45;
          parts.rightArm.rotation.x = w * 0.45;
        }
      }
    },
    group: () => holder,
    count: () => citizens.length,
    dispose() {
      for (const c of [...citizens]) remove(c);
    },
  };
}
