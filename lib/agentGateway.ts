/**
 * agentGateway — the single place the UI talks to an LLM for AI NPCs.
 *
 * It is backend-agnostic by design: point `VITE_AGENT_ENDPOINT` at an
 * OpenAI-compatible chat-completions URL and it just works with:
 *   - Ollama (local on the VPS):  http://<vps>:11434/v1/chat/completions
 *   - OpenRouter (cloud open models): https://openrouter.ai/api/v1/chat/completions (+ VITE_AGENT_KEY)
 *   - Any other OpenAI-compatible provider.
 *
 * With no endpoint configured it falls back to an offline persona reply so the
 * app stays demoable without a backend. The VPS gateway (proxy + metering +
 * memory) should sit in front of this in production; the client never holds a
 * secret key worth stealing.
 */
import type { Persona, ChatMessage } from '../engine/agents/types';

export interface AgentTurn {
  persona: Persona;
  /** Conversation so far, excluding the system prompt (added here). */
  messages: ChatMessage[];
  /** Optional scene telemetry to ground the agent in the current world. */
  telemetry?: Record<string, unknown>;
}

const env = (import.meta as any).env ?? {};
const ENDPOINT: string | undefined = env.VITE_AGENT_ENDPOINT;
const MODEL: string = env.VITE_AGENT_MODEL || 'qwen2.5:3b';
const API_KEY: string | undefined = env.VITE_AGENT_KEY;

function buildSystem(persona: Persona, telemetry?: Record<string, unknown>): string {
  const goals = persona.goals.map((g) => `- ${g}`).join('\n');
  const ctx = telemetry ? `\nContexte ville: ${JSON.stringify(telemetry)}` : '';
  return `${persona.systemPrompt}\nObjectifs:\n${goals}${ctx}`;
}

function trim(messages: ChatMessage[], n = 8): ChatMessage[] {
  return messages.slice(-n);
}

/** Offline reply so the UI is usable without a backend. */
function offlineReply(persona: Persona): string {
  return (
    `[Hors-ligne] Je suis ${persona.name}, ${persona.role.toLowerCase()}. ` +
    `Configure VITE_AGENT_ENDPOINT dans .env.local (Ollama : http://localhost:11434/v1/chat/completions, ` +
    `ou OpenRouter pour des modèles open en cloud) pour discuter avec un vrai modèle.`
  );
}

/**
 * Ask the agent for the next reply. Returns the assistant text.
 * Throws on network/HTTP errors so the caller can show a retry affordance.
 */
export async function callAgent(turn: AgentTurn): Promise<string> {
  if (!ENDPOINT) return offlineReply(turn.persona);

  const payload = {
    model: MODEL,
    stream: false,
    messages: [
      { role: 'system', content: buildSystem(turn.persona, turn.telemetry) },
      ...trim(turn.messages).map((m) => ({ role: m.role, content: m.content })),
    ],
  };

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (API_KEY) headers['Authorization'] = `Bearer ${API_KEY}`;

  const res = await fetch(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`Agent gateway HTTP ${res.status}`);
  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  return (content ?? '').trim() || offlineReply(turn.persona);
}
