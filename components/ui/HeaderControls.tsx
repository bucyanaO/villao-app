/**
 * Top-right toolbar: walk/scenario/weather/style/lighting/info/settings toggles.
 */
import type { FC } from 'react';

export interface HeaderControlsProps {
  walkMode: boolean;
  isAnalyzing: boolean;
  showScenarioInput: boolean;
  showWeatherMenu: boolean;
  showStyleMenu: boolean;
  showLightingMenu: boolean;
  showSettings: boolean;
  showControls: boolean;
  closeAllMenus: () => void;
  setWalkMode: (v: boolean) => void;
  setAutoPilot: (v: boolean) => void;
  setShowScenarioInput: (v: boolean) => void;
  setShowWeatherMenu: (v: boolean) => void;
  setShowStyleMenu: (v: boolean) => void;
  setShowLightingMenu: (v: boolean) => void;
  setShowControls: (v: boolean) => void;
  setShowSettings: (v: boolean) => void;
}

const HeaderControls: FC<HeaderControlsProps> = ({ walkMode, isAnalyzing, showScenarioInput, showWeatherMenu, showStyleMenu, showLightingMenu, showSettings, showControls, closeAllMenus, setWalkMode, setAutoPilot, setShowScenarioInput, setShowWeatherMenu, setShowStyleMenu, setShowLightingMenu, setShowControls, setShowSettings }) => (
  <div className="absolute top-6 right-6 flex gap-3 pointer-events-auto z-50">
   
     {/* WALK MODE TOGGLE (NEW) */}
     <button 
        onClick={() => {
            const s = !walkMode;
            closeAllMenus();
            setWalkMode(s);
            setAutoPilot(false); // Disable drone if walking
        }}
        className={`group relative flex items-center justify-center w-12 h-12 rounded-xl backdrop-blur-md transition-all duration-300 border border-white/10 hover:border-emerald-400 ${walkMode ? 'bg-emerald-500/40 ring-1 ring-emerald-400 shadow-[0_0_15px_#10b981]' : 'bg-slate-900/80 hover:bg-slate-800'}`}
        title="Mode Marche (FPS)"
     >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-6 h-6 transition-colors ${walkMode ? 'text-white' : 'text-emerald-500 group-hover:text-emerald-300'}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        {/* Feet Icon Override */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-xl">
             <span className="text-[8px] font-bold text-white">WALK</span>
        </div>
     </button>

     {/* GEMINI SCENARIO BUTTON */}
     <button 
        onClick={() => {
            const s = !showScenarioInput;
            closeAllMenus();
            setShowScenarioInput(s);
        }}
        className={`group relative flex items-center justify-center w-12 h-12 rounded-xl backdrop-blur-md transition-all duration-300 border border-white/10 hover:border-red-400 ${isAnalyzing ? 'bg-red-500/40 animate-pulse' : 'bg-slate-900/80 hover:bg-slate-800'}`}
        title="Mode Scénario IA"
     >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-red-500 group-hover:text-red-300 transition-colors">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
        </svg>
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_#ef4444]"></div>
     </button>

     {/* Weather & Camera Menu Toggle */}
     <button 
        onClick={() => { const s = !showWeatherMenu; closeAllMenus(); setShowWeatherMenu(s); }}
        className={`group relative flex items-center justify-center w-12 h-12 rounded-xl backdrop-blur-md transition-all duration-300 border border-white/10 hover:border-blue-400/50 ${showWeatherMenu ? 'bg-blue-500/20 ring-1 ring-blue-400 shadow-[0_0_15px_rgba(96,165,250,0.3)]' : 'bg-slate-900/80 hover:bg-slate-800'}`}
        title="Météo & Caméra"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-6 h-6 transition-colors ${showWeatherMenu ? 'text-blue-300' : 'text-gray-400 group-hover:text-blue-300'}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
        </svg>
      </button>

     {/* Architecture Menu Toggle */}
     <button 
        onClick={() => { const s = !showStyleMenu; closeAllMenus(); setShowStyleMenu(s); }}
        className={`group relative flex items-center justify-center w-12 h-12 rounded-xl backdrop-blur-md transition-all duration-300 border border-white/10 hover:border-purple-400/50 ${showStyleMenu ? 'bg-purple-500/20 ring-1 ring-purple-400 shadow-[0_0_15px_rgba(192,132,252,0.3)]' : 'bg-slate-900/80 hover:bg-slate-800'}`}
        title="Style Architectural"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-6 h-6 transition-colors ${showStyleMenu ? 'text-purple-300' : 'text-gray-400 group-hover:text-purple-300'}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
        </svg>
      </button>

     {/* Lighting Menu Toggle */}
     <button 
        onClick={() => { const s = !showLightingMenu; closeAllMenus(); setShowLightingMenu(s); }}
        className={`group relative flex items-center justify-center w-12 h-12 rounded-xl backdrop-blur-md transition-all duration-300 border border-white/10 hover:border-yellow-400/50 ${showLightingMenu ? 'bg-yellow-500/20 ring-1 ring-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]' : 'bg-slate-900/80 hover:bg-slate-800'}`}
        title="Ambiance Visuelle"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-6 h-6 transition-colors ${showLightingMenu ? 'text-yellow-300' : 'text-gray-400 group-hover:text-yellow-300'}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      </button>

     {/* Info Toggle */}
    {!showControls && !isAnalyzing && !walkMode && (
      <button 
        onClick={() => setShowControls(true)}
        className="group flex items-center justify-center w-12 h-12 rounded-xl bg-slate-900/80 backdrop-blur-md border border-white/10 hover:bg-slate-800 hover:border-cyan-400/50 transition-all duration-300"
        title="Informations"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-gray-400 group-hover:text-cyan-300 transition-colors">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
      </button>
    )}

    {/* Settings Toggle */}
    <button 
        onClick={() => { const s = !showSettings; closeAllMenus(); setShowSettings(s); }}
        className={`group relative flex items-center justify-center w-12 h-12 rounded-xl backdrop-blur-md transition-all duration-300 border border-white/10 hover:border-cyan-400/50 ${showSettings ? 'bg-cyan-500/20 ring-1 ring-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.3)]' : 'bg-slate-900/80 hover:bg-slate-800'}`}
        title="Paramètres Audio"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-6 h-6 transition-colors ${showSettings ? 'text-cyan-300' : 'text-gray-400 group-hover:text-cyan-300'}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.42 24.42 0 010 3.46" />
        </svg>
    </button>
  </div>
);

export default HeaderControls;
