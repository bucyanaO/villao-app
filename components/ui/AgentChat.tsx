/**
 * AgentChat — the conversation panel for consulting an AI NPC.
 * Opens when the player talks to an `ai-agent` inhabitant (press F / X).
 * Messages go through `lib/agentGateway` (Ollama / OpenRouter / offline fallback).
 */
import { useState, useRef, useEffect } from 'react';
import type { FC } from 'react';
import { callAgent } from '../../lib/agentGateway';
import type { Persona, ChatMessage } from '../../engine/agents/types';

export interface AgentChatProps {
  persona: Persona;
  telemetry?: Record<string, unknown>;
  onClose: () => void;
}

const AgentChat: FC<AgentChatProps> = ({ persona, telemetry, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the latest message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isThinking]);

  // Esc closes the conversation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const send = async () => {
    const text = input.trim();
    if (!text || isThinking) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setIsThinking(true);
    try {
      const reply = await callAgent({ persona, messages: next, telemetry });
      setMessages([...next, { role: 'assistant', content: reply }]);
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Erreur de connexion au modèle. Vérifie VITE_AGENT_ENDPOINT et réessaie.' }]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="absolute left-6 bottom-6 w-80 z-[60] bg-slate-950/95 backdrop-blur-xl rounded-2xl border border-cyan-500/30 shadow-[0_0_30px_rgba(34,211,238,0.2)] flex flex-col overflow-hidden animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-500/20 bg-slate-900/60">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee] animate-pulse"></span>
          <div className="flex flex-col">
            <span className="text-white text-sm font-bold leading-tight">{persona.name}</span>
            <span className="text-cyan-400 text-[10px] uppercase tracking-widest leading-tight">{persona.role}</span>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors" title="Fermer (Esc)">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex flex-col gap-2 p-3 h-64 overflow-y-auto">
        {messages.length === 0 && (
          <div className="text-[11px] text-gray-500 italic text-center py-6">
            Parle à {persona.name}. Pose une question, ou demande un conseil.
          </div>
        )}
        {messages.map((m, idx) => (
          <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-lg text-[12px] leading-snug ${m.role === 'user' ? 'bg-cyan-500/20 text-cyan-100 border border-cyan-500/30' : 'bg-white/5 text-gray-200 border border-white/10'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-lg text-[12px] text-gray-400 bg-white/5 border border-white/10">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></span>
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 p-3 border-t border-white/10 bg-slate-900/60">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } }}
          placeholder={`Message à ${persona.name}...`}
          className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
        />
        <button
          onClick={send}
          disabled={!input.trim() || isThinking}
          className="px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-cyan-800 text-white font-bold text-xs uppercase tracking-wider hover:from-cyan-500 hover:to-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
        >
          Envoyer
        </button>
      </div>
    </div>
  );
};

export default AgentChat;
