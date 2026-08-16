/**
 * LEDGER — le registre foncier de la ville. C'est LA source de vérité.
 *
 * La scène 3D n'est qu'une fenêtre autour du joueur ; ce qui existe vraiment,
 * c'est cette liste d'actes : « tel quartier, telle graine », « tel bâtiment,
 * tel programme, telle graine », « telle rue ». Chaque acte tient en quelques
 * octets et suffit à reconstruire l'objet à l'identique (générateurs
 * déterministes, cf. `rng.ts`).
 *
 * Deux conséquences :
 *  - ce qui a été construit NE DISPARAÎT PLUS au rechargement (localStorage) ;
 *  - le monde peut croître presque à l'infini : on ne garde en mémoire vive que
 *    les actes proches du joueur, les autres sont rejoués quand on y revient.
 */
export interface StreetAct {
  t: 'street';
  id: number;
  ax: number; az: number; bx: number; bz: number; w: number;
  /** ouvre des parcelles le long de la voie */
  plots?: boolean;
}

export interface DistrictAct {
  t: 'district';
  id: number;
  x: number; z: number;
  angle: number;
  theme: string;
  seed: number;
}

export interface BuildingAct {
  t: 'building';
  id: number;
  kind: string;
  x: number; z: number;
  angle: number;
  level: number;
  seed: number;
  /** identifiant de l'architecte qui signe l'ouvrage */
  by: string;
}

export type Act = StreetAct | DistrictAct | BuildingAct;

export interface LedgerState {
  version: 2;
  style: string;
  frontier: number;
  nextId: number;
  acts: Act[];
}

const KEY = (style: string) => `villao.city.v2.${style}`;

let state: LedgerState = { version: 2, style: '', frontier: 60, nextId: 1, acts: [] };
let dirty = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

const storage = (): Storage | null => {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
};

/** Charge (ou crée) le registre du style courant. */
export function openLedger(style: string, frontier: number): LedgerState {
  const s = storage();
  if (s) {
    const raw = s.getItem(KEY(style));
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as LedgerState;
        if (parsed?.version === 2 && Array.isArray(parsed.acts)) {
          state = parsed;
          state.style = style;
          return state;
        }
      } catch { /* registre illisible : on repart à neuf */ }
    }
  }
  state = { version: 2, style, frontier, nextId: 1, acts: [] };
  return state;
}

export function ledger(): LedgerState { return state; }
export function acts(): readonly Act[] { return state.acts; }
export function frontier(): number { return state.frontier; }

export function setFrontier(r: number): void {
  if (r > state.frontier) { state.frontier = r; touch(); }
}

/** Enregistre un acte et retourne son identifiant. */
export function record<T extends Omit<Act, 'id'>>(act: T): Act {
  const full = { ...(act as any), id: state.nextId++ } as Act;
  state.acts.push(full);
  touch();
  return full;
}

function touch(): void {
  dirty = true;
  if (saveTimer) return;
  // écriture différée : on n'écrit pas 30 fois pendant une salve de chantiers
  saveTimer = setTimeout(() => { saveTimer = null; if (dirty) save(); }, 1200);
}

export function save(): void {
  const s = storage();
  if (!s) return;
  try { s.setItem(KEY(state.style), JSON.stringify(state)); dirty = false; } catch { /* quota */ }
}

const BACKUP = (style: string) => `${KEY(style)}.avant-reset`;

/**
 * Efface la ville construite pour ce style (retour à la ville d'origine).
 *
 * Une ville, c'est des heures de construction : on n'en jette pas une sans
 * filet. L'ancienne est mise de côté avant l'effacement, et `restoreLedger()`
 * la rappelle (?restore=1). Une seule reprise en arrière, ça suffit à réparer
 * une fausse manœuvre.
 */
export function clearLedger(style: string): void {
  const s = storage();
  if (s) {
    try {
      const previous = s.getItem(KEY(style));
      if (previous) s.setItem(BACKUP(style), previous);
      s.removeItem(KEY(style));
    } catch { /* ignore */ }
  }
  state = { version: 2, style, frontier: state.frontier, nextId: 1, acts: [] };
}

/** Rappelle la ville mise de côté par le dernier effacement. */
export function restoreLedger(style: string): boolean {
  const s = storage();
  if (!s) return false;
  try {
    const saved = s.getItem(BACKUP(style));
    if (!saved) return false;
    s.setItem(KEY(style), saved);
    s.removeItem(BACKUP(style));
    return true;
  } catch { return false; }
}

/** Statistiques par programme (utilisées par le plan d'urbanisme du cabinet). */
export function countByKind(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of state.acts) {
    if (a.t === 'building') out[a.kind] = (out[a.kind] || 0) + 1;
  }
  return out;
}

export function buildings(): BuildingAct[] {
  return state.acts.filter((a): a is BuildingAct => a.t === 'building');
}
export function districts(): DistrictAct[] {
  return state.acts.filter((a): a is DistrictAct => a.t === 'district');
}
export function streets(): StreetAct[] {
  return state.acts.filter((a): a is StreetAct => a.t === 'street');
}
