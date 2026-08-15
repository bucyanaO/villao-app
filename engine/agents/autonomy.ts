/**
 * Agent autonomy — the "ville qui se construit elle-même".
 *
 * On a slow tick, each AI persona decides ONE action (here: BUILD a small
 * procedural building near its location) and it is executed through the existing
 * `GodOperation` / `executeGodOperations` path (so it renders via `aiBuildingsRef`).
 *
 * Decisions are LLM-driven: the ticker asks the model (through the secure gateway,
 * Gemma on the VPS) to return a `GodOperation` JSON, role-playing as that NPC
 * "according to itself". If the model is unreachable or returns bad JSON, it
 * falls back to a safe scripted build — so the city always grows, never breaks.
 *
 * Hard caps (non-negotiable): one build per persona, a small global budget, a
 * lot offset from the persona, one decision in flight at a time.
 */
import type { GodOperation } from '../types';
import { executeGodOperations } from '../godOperations';
import type { GodOpsCtx } from '../godOperations';
import type { Persona } from './types';
import { callAgent } from '../../lib/agentGateway';

export interface AutonomyCtx extends GodOpsCtx {
  personas: Persona[];
}

export interface AutonomyOptions {
  intervalMs?: number;
  initialDelayMs?: number;
  maxBuilds?: number;
}

const BUILD_STYLES = ['modern', 'cyberpunk', 'brutalist'] as const;

/** Safe scripted fallback build (used if the LLM fails). */
function scriptedBuild(persona: Persona): GodOperation {
  const offX = (Math.random() - 0.5) * 8;
  const offZ = 8 + (Math.random() - 0.5) * 6;
  return {
    action: 'BUILD',
    selector: { type: 'all' },
    params: {
      position: { x: persona.location.x + offX, y: 0, z: persona.location.z + offZ },
      floors: 2 + Math.floor(Math.random() * 3),
      style: BUILD_STYLES[Math.floor(Math.random() * BUILD_STYLES.length)],
      color: '#cccccc',
    },
  };
}

/** Ask the model (as this NPC) to decide a build action; parse a GodOperation. */
async function llmDecide(persona: Persona): Promise<GodOperation | null> {
  const sys =
    `Tu es ${persona.name}, ${persona.role}, un habitant de la Cité Voxel 3D. ` +
    `Objectifs: ${persona.goals.join(', ')}. ` +
    `Tu es à la position (${persona.location.x}, ${persona.location.z}). ` +
    `Décide UNE action de construction près de toi. ` +
    `Réponds UNIQUEMENT avec un objet JSON, AUCUN texte autour, exactement: ` +
    `{"action":"BUILD","selector":{"type":"all"},"params":{"position":{"x":<number>,"y":0,"z":<number>},"floors":<2 a 4>,"style":"modern","color":"#cccccc"}}. ` +
    `Contraintes: position à 6-12 unités de toi (pas sur toi), floors entre 2 et 4, style parmi "modern","cyberpunk","brutalist".`;
  try {
    const reply = await callAgent({
      persona: { ...persona, systemPrompt: sys },
      messages: [{ role: 'user', content: 'Décide et renvoie uniquement le JSON.' }],
    });
    const match = reply.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const op = JSON.parse(match[0]) as GodOperation;
    if (op?.action === 'BUILD' && op.params?.position && typeof op.params.position.x === 'number') {
      // Sanitize/sanitize fields to stay bounded.
      const p = op.params;
      p.position.y = 0;
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

  const tick = async () => {
    if (busy || built >= maxBuilds) { if (built >= maxBuilds) stop(); return; }
    let attempts = 0;
    let persona = ctx.personas[idx % ctx.personas.length];
    while (builtFor.has(persona.id) && attempts < ctx.personas.length) {
      idx++; attempts++; persona = ctx.personas[idx % ctx.personas.length];
    }
    if (builtFor.has(persona.id)) { stop(); return; }

    busy = true;
    let op: GodOperation | null = null;
    try {
      op = await llmDecide(persona); // real AI decision (Gemma via the gateway)
    } catch { op = null; }
    if (!op) op = scriptedBuild(persona); // safe fallback so the city still grows

    try {
      executeGodOperations([op], ctx);
    } catch (e) {
      console.warn('Autonomy build failed:', e);
    }
    builtFor.add(persona.id);
    built++;
    idx++;
    busy = false;
  };

  const start = () => {
    if (timer != null) return;
    timer = setTimeout(() => { tick(); timer = setInterval(() => void tick(), intervalMs); }, initialDelayMs);
  };

  const stop = () => {
    if (timer != null) { clearTimeout(timer); clearInterval(timer as any); timer = null; }
  };

  return { start, stop };
}
