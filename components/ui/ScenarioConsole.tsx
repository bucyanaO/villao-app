/**
 * God Mode chat console — type a command, see the conversation + execute it.
 */
import type { FC } from 'react';
import type { ChatMessage } from '../../hooks/useCommandEngine';

export interface ScenarioConsoleProps {
  scenarioPrompt: string;
  setScenarioPrompt: (s: string) => void;
  handleGeminiScenario: () => void;
  isAnalyzing: boolean;
  chatLog: ChatMessage[];
}

const ScenarioConsole: FC<ScenarioConsoleProps> = ({ scenarioPrompt, setScenarioPrompt, handleGeminiScenario, isAnalyzing, chatLog }) => (
  <div className="absolute bottom-6 right-6 bg-slate-950/95 backdrop-blur-xl p-5 rounded-2xl border border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.2)] w-80 z-50 animate-fade-in-down">
     <h3 className="text-white font-bold text-xs uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-red-500/20 pb-2">
        <span className="text-red-500 animate-pulse">●</span> Commandes Système IA
     </h3>
     <div className="flex flex-col gap-3">
         <p className="text-[10px] text-gray-400 leading-relaxed">
             Tape une commande : <span className="text-white">« commande une voiture »</span>, <span className="text-white">« appelle un taxi »</span>, <span className="text-white">« fait pleuvoir »</span>, <span className="text-white">« fais apparaître un arbre en or »</span>.
         </p>

         {/* Chat log */}
         <div className="flex flex-col gap-2 max-h-44 overflow-y-auto pr-1 mb-1">
            {chatLog.length === 0 && (
              <div className="text-[10px] text-gray-600 italic text-center py-2">Aucune commande pour l'instant.</div>
            )}
            {chatLog.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-lg text-[11px] leading-snug ${m.role === 'user' ? 'bg-cyan-500/20 text-cyan-100 border border-cyan-500/30' : 'bg-white/5 text-gray-200 border border-white/10'}`}>
                  {m.role === 'system' && m.action && (
                    <div className="text-[9px] font-bold uppercase tracking-wider text-red-400 mb-0.5">{m.action}</div>
                  )}
                  {m.text}
                </div>
              </div>
            ))}
         </div>

         <textarea 
            value={scenarioPrompt}
            onChange={(e) => setScenarioPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGeminiScenario(); } }}
            placeholder="Commande une voiture..."
            className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all h-20 resize-none"
         />
         <button 
            onClick={handleGeminiScenario}
            disabled={!scenarioPrompt.trim() || isAnalyzing}
            className="w-full py-3 bg-gradient-to-r from-red-600 to-red-800 text-white font-bold uppercase tracking-wider text-xs rounded-lg hover:from-red-500 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all active:scale-95"
         >
             Exécuter
         </button>
     </div>
  </div>
);

export default ScenarioConsole;
