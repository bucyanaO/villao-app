# AI Agents (the "ville d'IA")

The city is populated by AI inhabitants you can **consult via chat**. Walk up to
one (look for the glowing halo above its head), point at it and press **F** (or
**X** on gamepad) — a conversation panel opens.

## How it's wired

- `engine/agents/personas.ts` — the seed cast (mayor, baker, doctor, artist,
  mechanic): role, system prompt, goals, in-world location.
- `engine/agents/spawnNpcs.ts` — `spawnAiNpcs(cityGroup, animRef, personas)` places
  them as tagged inhabitants (`userData.type = 'ai-agent'`, `userData.persona`),
  with a glowing halo. Called after `generateCity`, so AI NPCs come back after a
  style change / regen.
- `components/NeighborhoodScene.tsx` — the interaction raycaster recognizes
  `ai-agent`; pressing F calls `onTalkToAgent(persona)` and unlocks the pointer.
- `components/ui/AgentChat.tsx` — the conversation panel.
- `lib/agentGateway.ts` — `callAgent({ persona, messages, telemetry })` is the
  single place that talks to an LLM.

## Connecting a real model

`agentGateway` is OpenAI-compatible and backend-agnostic. Set these in `.env.local`:

```env
# Ollama running on your VPS (local, cheap, no key):
VITE_AGENT_ENDPOINT=http://localhost:11434/v1/chat/completions
VITE_AGENT_MODEL=qwen2.5:3b
VITE_AGENT_KEY=

# Or OpenRouter (cloud open models, needs a key):
# VITE_AGENT_ENDPOINT=https://openrouter.ai/api/v1/chat/completions
# VITE_AGENT_MODEL=qwen/qwen2.5-3b-instruct:free
# VITE_AGENT_KEY=sk-or-...
```

With `VITE_AGENT_ENDPOINT` empty, the gateway returns an offline persona reply so
the app stays demoable without a backend.

> In production, route through the **secure gateway** in `server/` (it holds the
> real key, meters usage, CORS-locks to your app, rate-limits) — see
> [server/README.md](../server/README.md). The client never holds a secret worth
> stealing. Deploy it on your VPS via Dokploy (admin.miha.run) or systemd.

## Roadmap (toward autonomy + community)

This is the consult layer — the foundation. Next stages, in order:

1. **Memory**: persist each agent's conversation per persona on the VPS (SQLite),
   so NPCs remember you across sessions.
2. **Autonomy** (✅ scripted prototype live): `engine/agents/autonomy.ts` runs a
   slow client-side tick; each persona builds one small procedural building near
   its location via the existing `GodOperation`/`executeGodOperations` path (so it
   renders through `aiBuildingsRef`). Hard-capped at one build per persona. The
   scripted `decide()` is the single swap point for a real model: replace it with
   `await callAgent(...)` returning a `GodOperation`, and the rest is reused.
   Production move: run the tick server-side on the VPS (cheap open model) with
   per-agent budget + lot + role permissions.
3. **Community personas**: a portable persona format + a catalog users publish/import.
   Add moderation/guardrails **before** opening it.
4. **Visits**: each user owns their city + population; you can visit another user's
   city and agents can travel between worlds to meet. (Federation, not a shared MMO.)

The unifying idea: *a living city of AIs you can consult and that builds itself
under your guidance.*
