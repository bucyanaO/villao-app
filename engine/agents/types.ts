/**
 * AI agent (NPC) data model.
 * A `Persona` is the portable description of an AI inhabitant you can consult;
 * `ChatMessage` is the conversation record kept client-side and (later) on the server.
 */

export interface Persona {
  /** Stable id, used as key + memory namespace. */
  id: string;
  /** Short FR role label, e.g. "Boulanger". */
  role: string;
  /** In-world display name. */
  name: string;
  /** System prompt: who the agent is, its tone, its knowledge boundaries. */
  systemPrompt: string;
  /** What the agent wants to do/build (drives later autonomy). */
  goals: string[];
  /** Where it stands in the city. */
  location: { x: number; z: number };
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
