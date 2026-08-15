/**
 * Welcome / info overlay describing the app's modes.
 */
import type { FC } from 'react';

export interface ControlsOverlayProps {
  setShowControls: (v: boolean) => void;
}

const ControlsOverlay: FC<ControlsOverlayProps> = ({ setShowControls }) => (
  <div className="absolute top-0 left-0 w-full h-full pointer-events-none flex flex-col justify-between p-6 md:p-10 z-40">
    <div className="bg-slate-950/80 backdrop-blur-xl p-8 rounded-2xl max-w-md border border-white/10 shadow-2xl pointer-events-auto relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500"></div>
      
        <button 
          onClick={() => setShowControls(false)}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex flex-col mb-6">
          <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee] animate-pulse"></div>
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-[0.2em]">Système Connecté</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-white via-gray-200 to-gray-500">
              CITÉ VOXEL
          </h1>
          <span className="text-xs text-gray-500 font-bold tracking-widest mt-1">VERSION 24.0 // SENTIENT CITY</span>
        </div>
      
        <p className="text-sm text-gray-400 leading-relaxed mb-6 border-l-2 border-white/10 pl-4">
            Une simulation urbaine sous le contrôle ILLIMITÉ de l'IA Gemini. Créez des objets, marchez dans les rues (FPS), conduisez des véhicules ou visitez les bâtiments.
            <br/>
            <span className="text-cyan-400 mt-2 block font-bold">MANETTE SUPPORTÉE (Xbox/PS)</span>
        </p>

         <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-300 bg-white/5 border border-white/5 p-3 rounded-lg group-hover:border-cyan-500/30 transition-colors">
              <span className="font-bold text-cyan-300">CLIC GAUCHE</span> 
              <span className="opacity-70">Inspecter / Zoomer</span>
            </div>
             <div className="flex items-center justify-between text-xs text-gray-300 bg-white/5 border border-white/5 p-3 rounded-lg group-hover:border-emerald-500/30 transition-colors">
              <span className="font-bold text-emerald-400">WALK MODE</span> 
              <span className="opacity-70">FPS (Clavier ou Manette)</span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-300 bg-white/5 border border-white/5 p-3 rounded-lg group-hover:border-red-500/30 transition-colors">
              <span className="font-bold text-red-400">GOD MODE</span> 
              <span className="opacity-70">Console IA (Bouton Rouge)</span>
            </div>
        </div>
    </div>

    <div className="pointer-events-auto">
         <div className="flex items-center gap-3 text-[10px] font-bold text-gray-600 bg-black/40 backdrop-blur-sm px-4 py-2 rounded-full border border-white/5 w-fit">
              <span className="text-cyan-500">REACT</span>
              <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
              <span className="text-purple-500">THREE.JS</span>
              <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
              <span className="text-blue-400">GEMINI 2.5</span>
         </div>
    </div>
  </div>
);

export default ControlsOverlay;
