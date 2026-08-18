/**
 * ChatPanel — grand panneau de conversation façon ChatGPT/Claude.
 *
 * Occupe toute la hauteur à droite de l'écran sur grand écran. Regroupe :
 *  - la conversation avec la Cité (CITY_PERSONA) via le moteur de commandes,
 *  - la consultation d'un habitant IA (AI_PERSONAS) via callAgent.
 *
 * Un sélecteur d'interlocuteur en tête permet de basculer entre la Cité
 * (exécute aussi les commandes de la ville) et chaque habitant.
 *
 * Branché sur lib/agentGateway (Ollama / OpenRouter / hors-ligne) et sur
 * hooks/useCommandEngine (commandes locales + Gemini).
 */
import { useState, useRef, useEffect, useMemo } from 'react';
import type { FC } from 'react';
import { callAgent } from '../../lib/agentGateway';
import { AI_PERSONAS, CITY_PERSONA } from '../../engine/agents/personas';
import type { Persona, ChatMessage } from '../../engine/agents/types';
import type { ChatMessage as CmdMessage } from '../../hooks/useCommandEngine';
import { useVoiceInput } from '../../hooks/useVoiceInput';

export interface ChatPanelProps {
  /** Conversation + exécution de commandes (mode Cité). */
  chatLog: CmdMessage[];
  isAnalyzing: boolean;
  scenarioPrompt: string;
  setScenarioPrompt: (s: string) => void;
  runCommand: () => void;
  /** Ferme le panneau (icône chevron). */
  onClose: () => void;
}

type Speaker = { id: string; name: string; role: string; emoji: string };

const SPEAKERS: Speaker[] = [
  { id: 'city', name: 'Cité Voxel', role: 'Esprit de la ville', emoji: '🏙️' },
  ...AI_PERSONAS.map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    emoji: personaEmoji(p),
  })),
];

function personaEmoji(p: Persona): string {
  const m: Record<string, string> = {
    mayor: '🧑‍💼',
    baker: '🥖',
    doctor: '🩺',
    artist: '🎨',
    mechanic: '🔧',
  };
  return m[p.id] ?? '🧑';
}

const ChatPanel: FC<ChatPanelProps> = ({
  chatLog, isAnalyzing, scenarioPrompt, setScenarioPrompt, runCommand, onClose,
}) => {
  const [speakerId, setSpeakerId] = useState('city');
  const [npcMessages, setNpcMessages] = useState<ChatMessage[]>([]);
  const [npcThinking, setNpcThinking] = useState(false);
  const [npcInput, setNpcInput] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const npcScrollRef = useRef<HTMLDivElement>(null);
  const cityInputRef = useRef<HTMLTextAreaElement>(null);
  const npcInputRef = useRef<HTMLTextAreaElement>(null);
  const voice = useVoiceInput('fr-FR');

  const speaker = useMemo(() => SPEAKERS.find((s) => s.id === speakerId) ?? SPEAKERS[0], [speakerId]);
  const isCity = speakerId === 'city';
  const persona = isCity ? CITY_PERSONA : AI_PERSONAS.find((p) => p.id === speakerId)!;

  // Auto-scroll : garde le dernier message visible.
  useEffect(() => {
    const el = isCity ? scrollRef.current : npcScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatLog, npcMessages, isAnalyzing, npcThinking, isCity]);

  // Ferme le menu de sélecteur au clic extérieur.
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = () => setMenuOpen(false);
    window.addEventListener('click', onDoc);
    return () => window.removeEventListener('click', onDoc);
  }, [menuOpen]);

  // Auto-resize des zones de saisie.
  const autoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };
  useEffect(() => { autoGrow(cityInputRef.current); }, [scenarioPrompt]);
  useEffect(() => { autoGrow(npcInputRef.current); }, [npcInput]);

  const sendCity = () => {
    if (!scenarioPrompt.trim() || isAnalyzing) return;
    runCommand();
  };

  const sendNpc = async () => {
    const text = npcInput.trim();
    if (!text || npcThinking) return;
    const next: ChatMessage[] = [...npcMessages, { role: 'user', content: text }];
    setNpcMessages(next);
    setNpcInput('');
    setNpcThinking(true);
    try {
      const reply = await callAgent({ persona, messages: next });
      setNpcMessages([...next, { role: 'assistant', content: reply }]);
    } catch (e) {
      setNpcMessages([...next, { role: 'assistant', content: `(Passerelle IA injoignable — ${(e as Error).message})` }]);
    } finally {
      setNpcThinking(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent, send: () => void) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const onVoice = (setter: (updater: (prev: string) => string) => void) =>
    voice.listening ? voice.stop() : voice.start((t) => setter((prev) => (prev ? prev + ' ' + t : t)));

  return (
    <aside className="pointer-events-auto absolute right-0 top-0 z-40 flex h-full w-full max-w-[460px] flex-col border-l border-white/10 bg-slate-950/90 backdrop-blur-xl shadow-2xl">
      {/* En-tête : sélecteur d'interlocuteur + fermeture */}
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white/5 transition"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-cyan-500/30 to-indigo-500/30 text-lg ring-1 ring-white/10">
              {speaker.emoji}
            </span>
            <span className="flex flex-col text-left leading-tight">
              <span className="text-sm font-semibold text-white">{speaker.name}</span>
              <span className="text-[11px] uppercase tracking-wider text-cyan-400/70">{speaker.role}</span>
            </span>
            <svg className={`h-4 w-4 text-gray-400 transition ${menuOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute left-0 top-full mt-2 w-64 overflow-hidden rounded-xl border border-white/10 bg-slate-900/95 py-1 shadow-2xl backdrop-blur-xl">
              {SPEAKERS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSpeakerId(s.id); setMenuOpen(false); }}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-white/5 ${s.id === speakerId ? 'bg-white/5' : ''}`}
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-white/5 text-base ring-1 ring-white/10">{s.emoji}</span>
                  <span className="flex flex-col leading-tight">
                    <span className="text-sm text-white">{s.name}</span>
                    <span className="text-[10px] uppercase tracking-wider text-gray-500">{s.role}</span>
                  </span>
                  {s.id === speakerId && (
                    <svg className="ml-auto h-4 w-4 text-cyan-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0l-3.5-3.5a1 1 0 011.4-1.4l2.8 2.79 6.8-6.79a1 1 0 011.4 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <span className={`h-2 w-2 rounded-full ${npcThinking || isAnalyzing ? 'animate-pulse bg-amber-400' : 'bg-emerald-400'}`} />
          <button onClick={onClose} title="Masquer le panneau" className="ml-1 grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white transition">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </header>

      {/* Fil de conversation */}
      <div ref={isCity ? scrollRef : npcScrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
        {isCity ? (
          <>
            {chatLog.length === 0 && (
              <div className="mx-auto mt-10 max-w-xs text-center">
                <div className="mb-3 text-4xl">🏙️</div>
                <p className="text-sm text-gray-300">Parle à la <span className="font-semibold text-white">Cité Voxel</span>.</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                  Pose une question, ou commande la ville :
                  <span className="text-cyan-300"> « commande une voiture »</span>,
                  <span className="text-cyan-300"> « fait pleuvoir »</span>,
                  <span className="text-cyan-300"> « met la nuit »</span>.
                </p>
              </div>
            )}
            {chatLog.map((m, idx) => (
              <MessageBubble key={idx} role={m.role === 'user' ? 'user' : 'assistant'} text={m.text} badge={m.action} />
            ))}
            {isAnalyzing && <ThinkingDots />}
          </>
        ) : (
          <>
            {npcMessages.length === 0 && (
              <div className="mx-auto mt-10 max-w-xs text-center">
                <div className="mb-3 text-4xl">{speaker.emoji}</div>
                <p className="text-sm text-gray-300">Discute avec <span className="font-semibold text-white">{speaker.name}</span>, {speaker.role.toLowerCase()}.</p>
                <p className="mt-1 text-xs text-gray-500">Pose une question ou demande un conseil.</p>
              </div>
            )}
            {npcMessages.map((m, idx) => (
              <MessageBubble key={idx} role={m.role === 'user' ? 'user' : 'assistant'} text={m.content} />
            ))}
            {npcThinking && <ThinkingDots />}
          </>
        )}
      </div>

      {/* Zone de saisie */}
      <footer className="border-t border-white/10 bg-slate-900/60 px-4 py-3">
        {isCity ? (
          <Composer
            inputRef={cityInputRef}
            value={scenarioPrompt}
            onChange={setScenarioPrompt}
            onSend={sendCity}
            onKeyDown={(e) => onKeyDown(e, sendCity)}
            disabled={isAnalyzing}
            placeholder={`Commande ou question pour ${speaker.name}…`}
            voice={voice}
            onVoice={() => onVoice(setScenarioPrompt)}
          />
        ) : (
          <Composer
            inputRef={npcInputRef}
            value={npcInput}
            onChange={setNpcInput}
            onSend={sendNpc}
            onKeyDown={(e) => onKeyDown(e, sendNpc)}
            disabled={npcThinking}
            placeholder={`Message à ${speaker.name}…`}
            voice={voice}
            onVoice={() => onVoice(setNpcInput)}
          />
        )}
        <p className="mt-2 text-center text-[10px] text-gray-600">
          Entrée pour envoyer · Maj+Entrée pour un saut de ligne
        </p>
      </footer>
    </aside>
  );
};

/** Bulle de message façon ChatGPT/Claude. */
const MessageBubble: FC<{ role: 'user' | 'assistant'; text: string; badge?: string }> = ({ role, text, badge }) => (
  <div className={`flex gap-3 ${role === 'user' ? 'flex-row-reverse' : ''}`}>
    <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm ring-1 ring-white/10 ${role === 'user' ? 'bg-gradient-to-br from-cyan-500/40 to-blue-600/40' : 'bg-gradient-to-br from-indigo-500/30 to-purple-600/30'}`}>
      {role === 'user' ? '🧑' : '🏙️'}
    </span>
    <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed
      ${role === 'user'
        ? 'rounded-tr-sm bg-gradient-to-br from-cyan-600/30 to-blue-700/30 text-cyan-50 ring-1 ring-cyan-500/20'
        : 'rounded-tl-sm bg-white/5 text-gray-100 ring-1 ring-white/10'}`}>
      {badge && (
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-400/90">{badge}</div>
      )}
      <p className="whitespace-pre-wrap">{text}</p>
    </div>
  </div>
);

/** Indicateur de frappe (trois points). */
const ThinkingDots: FC = () => (
  <div className="flex gap-3">
    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-600/30 text-sm ring-1 ring-white/10">🏙️</span>
    <div className="rounded-2xl rounded-tl-sm bg-white/5 px-4 py-3 ring-1 ring-white/10">
      <span className="inline-flex gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce" />
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0.15s' }} />
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0.3s' }} />
      </span>
    </div>
  </div>
);

/** Zone de saisie avec auto-resize, voix, bouton envoyer. */
const Composer: FC<{
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (s: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  disabled: boolean;
  placeholder: string;
  voice: { supported: boolean; listening: boolean };
  onVoice: () => void;
}> = ({ inputRef, value, onChange, onSend, onKeyDown, disabled, placeholder, voice, onVoice }) => (
  <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-black/40 px-3 py-2 transition focus-within:border-cyan-500/40 focus-within:ring-1 focus-within:ring-cyan-500/20">
    <textarea
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      rows={1}
      placeholder={placeholder}
      className="max-h-40 flex-1 resize-none bg-transparent py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none"
    />
    {voice.supported && (
      <button
        onClick={onVoice}
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition active:scale-95 ${voice.listening ? 'animate-pulse bg-red-600 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
        title="Parler (voix)"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
        </svg>
      </button>
    )}
    <button
      onClick={onSend}
      disabled={!value.trim() || disabled}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-700 text-white shadow-lg transition hover:from-cyan-400 hover:to-blue-600 disabled:cursor-not-allowed disabled:opacity-40 active:scale-95"
      title="Envoyer"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.5 5.5l17 6.5-17 6.5L6 12zm0 0h13.5" />
      </svg>
    </button>
  </div>
);

export default ChatPanel;
