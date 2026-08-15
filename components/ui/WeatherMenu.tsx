/**
 * Weather selector + drone auto-pilot toggle.
 */
import type { FC } from 'react';

export interface WeatherMenuProps {
  weather: 'clear' | 'rain' | 'snow';
  setWeather: (w: 'clear' | 'rain' | 'snow') => void;
  autoPilot: boolean;
  setAutoPilot: (v: boolean) => void;
  setWalkMode: (v: boolean) => void;
}

const WeatherMenu: FC<WeatherMenuProps> = ({ weather, setWeather, autoPilot, setAutoPilot, setWalkMode }) => (
  <div className="absolute top-20 right-6 bg-slate-950/90 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-2xl w-72 z-50 animate-fade-in-down">
    <h3 className="text-white font-bold text-xs uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-white/10 pb-2">
      <span className="text-blue-400">●</span> Atmosphère & Caméra
    </h3>
  
    <div className="mb-6">
      <label className="text-[10px] text-gray-400 uppercase tracking-wider mb-2 block">Météo</label>
      <div className="flex bg-black/40 rounded-lg p-1 border border-white/5">
          {[
              { id: 'clear', icon: '☀', label: 'Clair' },
              { id: 'rain', icon: '🌧', label: 'Pluie' },
              { id: 'snow', icon: '❄', label: 'Neige' }
          ].map((w) => (
              <button
                  key={w.id}
                  onClick={() => setWeather(w.id as any)}
                  className={`flex-1 flex flex-col items-center justify-center py-2 rounded-md transition-all ${weather === w.id ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
              >
                  <span className="text-xl mb-1">{w.icon}</span>
                  <span className="text-[10px] font-bold">{w.label}</span>
              </button>
          ))}
      </div>
    </div>

    <div>
       <label className="text-[10px] text-gray-400 uppercase tracking-wider mb-2 block">Caméra Drone</label>
       <button
          onClick={() => { setAutoPilot(!autoPilot); setWalkMode(false); }}
          className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${autoPilot ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'}`}
       >
          <span className="text-xs font-bold">Pilote Automatique</span>
          <div className={`w-10 h-5 rounded-full relative transition-colors ${autoPilot ? 'bg-emerald-500' : 'bg-gray-700'}`}>
              <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-transform duration-300 ${autoPilot ? 'left-6' : 'left-1'}`}></div>
          </div>
       </button>
       <p className="text-[10px] text-gray-500 mt-2 leading-tight">
           Le mode drone survole la ville automatiquement. Désactivez-le pour reprendre le contrôle manuel.
       </p>
    </div>
  </div>
);

export default WeatherMenu;
