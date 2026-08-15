/**
 * Agent autonomy — the "ville qui se construit seule".
 *
 * On a slow tick, each AI persona performs one of its goals as a `GodOperation`
 * (here: BUILD a small procedural building near its location). Decisions are
 * scripted for now so the demo works without an LLM. The scripted decision is
 * the single swap point for a real model: replace `decide()` with an
 * `await callAgent(...)` that returns a `GodOperation`, and the rest is reused.
 *
 * Hard caps (non-negotiable, per the design doc): one build per persona, a small
 * global budget, buildings placed on a lot offset from the persona. No unbounded
 * construction, no per-frame cost.
 */
import type { GodOperation } from '../types';
import { executeGodOperations } from '../godOperations';
import type { GodOpsCtx } from '../godOperations';
import type { Persona } from './types';

export interface AutonomyCtx extends GodOpsCtx {
  personas: Persona[];
}

export interface AutonomyOptions {
  /** Delay between agent decisions. */
  intervalMs?: number;
  /** Delay before the very first decision. */
  initialDelayMs?: number;
  /** Global cap on builds (defaults to one per persona). */
  maxBuilds?: number;
}

const BUILD_STYLES = ['modern', 'cyberpunk', 'brutalist'] as const;

/** Scripted decision: build one small building near the persona. */
function decide(persona: Persona): GodOperation {
  const offX = (Math.random() - 0.5) * 8;
  const offZ = 8 + (Math.random() - 0.5) * 6; // a bit forward of the NPC
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

export function createAutonomyTicker(ctx: AutonomyCtx, opts: AutonomyOptions = {}) {
  const intervalMs = opts.intervalMs ?? 15000;
  const initialDelayMs = opts.initialDelayMs ?? 6000;
  const maxBuilds = opts.maxBuilds ?? ctx.personas.length;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let built = 0;
  let idx = 0;
  const builtFor = new Set<string>();

  const tick = () => {
    if (built >= maxBuilds) { stop(); return; }
    // Round-robin to the next persona that hasn't acted yet.
    let attempts = 0;
    let persona = ctx.personas[idx % ctx.personas.length];
    while (builtFor.has(persona.id) && attempts < ctx.personas.length) {
      idx++; attempts++; persona = ctx.personas[idx % ctx.personas.length];
    }
    if (builtFor.has(persona.id)) { stop(); return; }

    try {
      executeGodOperations([decide(persona)], ctx);
    } catch (e) {
      console.warn('Autonomy tick failed:', e);
    }
    builtFor.add(persona.id);
    built++;
    idx++;
  };

  const start = () => {
    if (timer != null) return;
    timer = setTimeout(() => { tick(); timer = setInterval(tick, intervalMs); }, initialDelayMs);
  };

  const stop = () => {
    if (timer != null) { clearTimeout(timer); clearInterval(timer as any); timer = null; }
  };

  return { start, stop };
}
