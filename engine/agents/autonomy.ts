/**
 * Agent autonomy — the "ville qui se construit elle-même".
 *
 * On a slow tick, each AI persona builds ONE building on a defined BUILD_LOT
 * (off-road, off-villa) near it. WHERE = a free lot (so nothing lands on a road);
 * WHAT = decided by the model (Gemma via the gateway), role-playing as the NPC
 * "according to itself" — floors, style, color. If the model is unreachable or
 * returns bad JSON, a safe scripted build is used. Executed through the existing
 * `GodOperation` path, so it renders via `aiBuildingsRef`.
 *
 * Hard caps: one build per persona, a small global budget, one decision in flight.
 */
import type { GodOperation } from '../types';
import { executeGodOperations } from '../godOperations';
import type { GodOpsCtx } from '../godOperations';
import type { Persona } from './types';
import { BUILD_LOTS, nearestFreeLot, lotIndex, type Lot } from './lots';
import { callAgent } from '../../lib/agentGateway';

export interface AutonomyCtx extends GodOpsCtx {
  personas: Persona[];
}
export interface AutonomyOptions { intervalMs?: number; initialDelayMs?: number; maxBuilds?: number; }

const BUILD_STYLES = ['modern', 'cyberpunk', 'brutalist'] as const;

/** Safe scripted build on a specific (off-road) lot. */
function scriptedBuild(persona: Persona, lot: Lot): GodOperation {
  return {
    action: 'BUILD',
    selector: { type: 'all' },
    params: {
      position: { x: lot.x, y: 0, z: lot.z },
      floors: 2 + Math.floor(Math.random() * 3),
      style: BUILD_STYLES[Math.floor(Math.random() * BUILD_STYLES.length)],
      color: '#cccccc',
    },
  };
}

/** Ask the model (as this NPC) WHAT to build on this lot; return a GodOperation. */
async function llmDecide(persona: Persona, lot: Lot): Promise<GodOperation | null> {
  const sys =
    `Tu es ${persona.name}, ${persona.role}, habitant de la Cité Voxel 3D. ` +
    `Objectifs: ${persona.goals.join(', ')}. ` +
    `Tu as un terrain libre à la position (${lot.x}, ${lot.z}). ` +
    `Décide QUOI y construire. ` +
    `Réponds UNIQUEMENT avec un objet JSON, AUCUN texte autour, exactement: ` +
    `{"action":"BUILD","selector":{"type":"all"},"params":{"position":{"x":${lot.x},"y":0,"z":${lot.z}},"floors":<2 a 4>,"style":"modern","color":"#cccccc"}}. ` +
    `Contraintes: floors entre 2 et 4, style parmi "modern","cyberpunk","brutalist", color en hex.`;
  try {
    const reply = await callAgent({
      persona: { ...persona, systemPrompt: sys },
      messages: [{ role: 'user', content: 'Décide et renvoie uniquement le JSON.' }],
    });
    const match = reply.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const op = JSON.parse(match[0]) as GodOperation;
    if (op?.action === 'BUILD' && op.params) {
      const p = op.params;
      p.position = { x: lot.x, y: 0, z: lot.z }; // force the off-road lot
      p.floors = Math.max(2, Math.min(4, Math.round(p.floors as number) || 3));
      if (!p.style || !['modern', 'cyberpunk', 'brutalist'].includes(p.style)) p.style = 'modern';
      if (!p.color) p.color = '#cccccc';
      return op;
    }
    return null;
  } catch {
    return null;
  }
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
  const usedLots = new Set<number>();

  const tick = async () => {
    if (busy || built >= maxBuilds) { if (built >= maxBuilds) stop(); return; }
    let attempts = 0;
    let persona = ctx.personas[idx % ctx.personas.length];
    while (builtFor.has(persona.id) && attempts < ctx.personas.length) {
      idx++; attempts++; persona = ctx.personas[idx % ctx.personas.length];
    }
    if (builtFor.has(persona.id)) { stop(); return; }

    // WHERE: a free off-road lot near this persona.
    const lot = nearestFreeLot(persona.location, usedLots);
    if (!lot) { stop(); return; }
    usedLots.add(lotIndex(lot));

    busy = true;
    let op: GodOperation | null = null;
    try { op = await llmDecide(persona, lot); } catch { op = null; }
    if (!op) op = scriptedBuild(persona, lot); // safe fallback on the same lot

    try { executeGodOperations([op], ctx); } catch (e) { console.warn('Autonomy build failed:', e); }
    builtFor.add(persona.id);
    built++;
    idx++;
    busy = false;
  };

  const start = () => {
    if (timer != null) return;
    timer = setTimeout(() => { tick(); timer = setInterval(() => void tick(), intervalMs); }, initialDelayMs);
  };
  const stop = () => { if (timer != null) { clearTimeout(timer); clearInterval(timer as any); timer = null; } };

  return { start, stop };
}

export { BUILD_LOTS };
