/**
 * AUTONOMIE DES HABITANTS — « la ville que ses habitants se donnent ».
 *
 * À côté du cabinet d'architectes (qui applique un plan d'urbanisme), chaque
 * persona réalise SON projet, celui qui lui ressemble : le boulanger veut sa
 * boutique, le médecin sa clinique, le maire sa mairie, le mécanicien son
 * atelier. Le QUOI est décidé par le modèle (Gemma via la passerelle) en
 * jouant le personnage ; si le modèle est injoignable ou répond n'importe quoi,
 * on retombe sur le projet évident pour ce rôle.
 *
 * Le OÙ n'est jamais laissé au modèle : c'est le monde qui donne un terrain
 * légal (cadastre + distances de priorité). Et comme tout passe par le
 * registre, ces bâtiments SURVIVENT au rechargement.
 */
import type { Persona } from './types';
import type { ExpansionManager } from '../world/expansion';
import type { ProgramKind } from '../world/programs';
import { PROGRAM_LABEL } from '../world/programs';
import { nearestFreePlot, isBuildable, roadsNear } from '../world/zoning';
import { callAgent } from '../../lib/agentGateway';

export interface AutonomyCtx {
  world: ExpansionManager;
  personas: Persona[];
  onEvent?: (text: string) => void;
}
export interface AutonomyOptions { intervalMs?: number; initialDelayMs?: number; maxBuilds?: number; }

/** Le projet « évident » de chaque rôle — utilisé en repli. */
const DEFAULT_PROJECT: Record<string, ProgramKind> = {
  mayor: 'mairie', baker: 'magasin', doctor: 'clinique', artist: 'parc', mechanic: 'atelier',
};

const ALLOWED: ProgramKind[] = ['maison', 'magasin', 'marche', 'atelier', 'clinique', 'ecole', 'mairie', 'parc', 'immeuble'];

/** Demande au modèle, DANS LE RÔLE, ce que la persona veut bâtir. */
async function llmChooseProject(persona: Persona): Promise<ProgramKind | null> {
  const sys =
    `Tu es ${persona.name}, ${persona.role}, habitant de la Cité Voxel 3D. ` +
    `Objectifs: ${persona.goals.join(', ')}. ` +
    `La ville t'accorde UN terrain. Choisis CE QUE TU VEUX Y BÂTIR, selon ton rôle. ` +
    `Réponds par UN SEUL MOT parmi: ${ALLOWED.join(', ')}. Aucun autre texte.`;
  try {
    const reply = await callAgent({
      persona: { ...persona, systemPrompt: sys },
      messages: [{ role: 'user', content: 'Un seul mot.' }],
    });
    const word = reply.toLowerCase().replace(/[^a-zéèêç]/g, '');
    const hit = ALLOWED.find((k) => word.includes(k));
    return hit ?? null;
  } catch {
    return null;
  }
}

/** Un terrain légal proche de la persona (parcelle libre, sinon bord de rue). */
function siteFor(persona: Persona, footprintGuess = 18): { x: number; z: number; angle: number } | null {
  const plot = nearestFreePlot(persona.location, 260);
  if (plot) return { x: plot.x, z: plot.z, angle: Math.atan2(-plot.x, -plot.z) };

  for (const seg of roadsNear(persona.location, 220)) {
    const dx = seg.x2 - seg.x1, dz = seg.z2 - seg.z1;
    const len = Math.hypot(dx, dz);
    if (len < 6) continue;
    const ux = dx / len, uz = dz / len, nx = uz, nz = -ux;
    const setback = seg.w / 2 + footprintGuess / 2 + 2.5;
    for (let t = 0; t <= len; t += 14) {
      for (const side of [-1, 1]) {
        const x = seg.x1 + ux * t + nx * side * setback;
        const z = seg.z1 + uz * t + nz * side * setback;
        if (isBuildable(x, z, footprintGuess)) {
          return { x, z, angle: Math.atan2(-side * nx, -side * nz) };
        }
      }
    }
  }
  return null;
}

export function createAutonomyTicker(ctx: AutonomyCtx, opts: AutonomyOptions = {}) {
  const intervalMs = opts.intervalMs ?? 25000;
  const initialDelayMs = opts.initialDelayMs ?? 8000;
  const maxBuilds = opts.maxBuilds ?? ctx.personas.length;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let built = 0;
  let idx = 0;
  let busy = false;
  const builtFor = new Set<string>();

  const tick = async () => {
    if (busy || built >= maxBuilds) { if (built >= maxBuilds) stop(); return; }
    let attempts = 0;
    let persona = ctx.personas[idx % ctx.personas.length];
    while (builtFor.has(persona.id) && attempts < ctx.personas.length) {
      idx++; attempts++; persona = ctx.personas[idx % ctx.personas.length];
    }
    if (builtFor.has(persona.id)) { stop(); return; }

    busy = true;
    try {
      const kind = (await llmChooseProject(persona)) ?? DEFAULT_PROJECT[persona.id] ?? 'maison';
      const site = siteFor(persona);
      if (site) {
        const ok = ctx.world.place(kind, site.x, site.z, site.angle, 3, persona.name);
        if (ok) {
          builtFor.add(persona.id);
          built++;
          ctx.onEvent?.(`${persona.name} (${persona.role}) fait bâtir ${PROGRAM_LABEL[kind]}.`);
        }
      }
    } catch (e) {
      console.warn('Autonomy build failed:', e);
    } finally {
      idx++;
      busy = false;
    }
  };

  const start = () => {
    if (timer != null) return;
    timer = setTimeout(() => { void tick(); timer = setInterval(() => void tick(), intervalMs); }, initialDelayMs);
  };
  const stop = () => { if (timer != null) { clearTimeout(timer); clearInterval(timer as any); timer = null; } };

  return { start, stop };
}
