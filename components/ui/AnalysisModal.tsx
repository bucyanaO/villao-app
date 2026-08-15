/**
 * Cinematic modal shown while the AI is 'analyzing' or after a command result.
 */
import type { FC } from 'react';

export interface AnalysisModalProps {
  isAnalyzing: boolean;
  analysisResult: { thought: string; action: string } | null;
  setAnalysisResult: (r: { thought: string; action: string } | null) => void;
}

const AnalysisModal: FC<AnalysisModalProps> = ({ isAnalyzing, analysisResult, setAnalysisResult }) => (
  <div className="absolute inset-0 flex items-center justify-center z-[100] bg-black/60 backdrop-blur-sm p-4">
      <div className="max-w-xl w-full bg-slate-900/90 border border-cyan-500/50 rounded-2xl shadow-[0_0_50px_rgba(34,211,238,0.2)] overflow-hidden flex flex-col relative animate-fade-in-up">
          {/* Header */}
          <div className="bg-slate-950 p-4 border-b border-cyan-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${isAnalyzing ? 'bg-red-500 animate-ping' : 'bg-green-500'}`}></div>
                  <h2 className="text-cyan-400 font-bold uppercase tracking-widest text-sm">
                      {isAnalyzing ? 'COMMUNICATION NEURALE...' : 'RÉALITÉ RECONFIGURÉE'}
                  </h2>
              </div>
              {!isAnalyzing && (
                  <button 
                    onClick={() => setAnalysisResult(null)}
                    className="text-gray-500 hover:text-white transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
              )}
          </div>
        
          {/* Content */}
          <div className="p-6 min-h-[150px] flex items-center justify-center relative">
              {isAnalyzing ? (
                  <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div>
                        <p className="text-xs text-red-300/70 font-mono animate-pulse uppercase tracking-widest">
                            L'IA observe votre monde...
                        </p>
                  </div>
              ) : (
                  <div className="w-full text-center">
                      <div className="mb-4 pb-2 border-b border-white/10">
                          <span className="text-xs text-gray-500 uppercase tracking-widest block mb-1">Protocole Exécuté</span>
                          <span className="text-2xl font-black text-red-500 glow uppercase">{analysisResult?.action}</span>
                      </div>
                      <p className="text-lg text-white font-medium leading-relaxed italic">
                          "{analysisResult?.thought}"
                      </p>
                  </div>
              )}
          </div>
      </div>
  </div>
);

export default AnalysisModal;
