/**
 * Visual ambiance / lighting preset picker.
 */
import type { FC } from 'react';

export interface LightingMenuProps {
  lightingOptions: { name: string; color: string; border: string }[];
  lightingPreset: number;
  handleLightingChange: (n: number) => void;
  fogLevel: number;
  setFogLevel: (v: number) => void;
}

const LightingMenu: FC<LightingMenuProps> = ({ lightingOptions, lightingPreset, handleLightingChange, fogLevel, setFogLevel }) => (
  <div className="absolute top-20 right-6 bg-slate-950/90 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-2xl w-72 z-50 animate-fade-in-down">
    <h3 className="text-white font-bold text-xs uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-white/10 pb-2">
      <span className="text-yellow-400">●</span> Ambiance Visuelle
    </h3>
    <div className="grid grid-cols-1 gap-2 mb-5">
      {lightingOptions.map((option, index) => (
        <button
          key={index}
          onClick={() => handleLightingChange(index)}
          className={`group relative flex items-center gap-3 w-full p-3 rounded-lg text-xs font-medium transition-all duration-200 overflow-hidden ${
            lightingPreset === index 
              ? 'bg-white/10 text-white ring-1 ring-white/30' 
              : 'text-gray-400 hover:bg-white/5 hover:text-white'
          }`}
        >
           {lightingPreset === index && (
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${option.color}`}></div>
           )}
          <div className={`w-3 h-3 rounded-full border ${option.border} ${option.color} shadow-[0_0_10px_currentColor] opacity-80`}></div>
          {option.name}
        </button>
      ))}
    </div>

    <div className="border-t border-white/10 pt-4">
          <div className="flex justify-between text-[10px] uppercase tracking-wider text-gray-400 mb-2">
              <span>Densité Brouillard</span>
              <span className="text-cyan-300">{Math.round(fogLevel * 100)}%</span>
          </div>
          <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
              <div 
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-yellow-600 to-yellow-400"
                  style={{ width: `${(fogLevel / 2) * 100}%` }}
              ></div>
              <input 
                  type="range" min="0" max="2" step="0.1" 
                  value={fogLevel}
                  onChange={(e) => setFogLevel(parseFloat(e.target.value))}
                  className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
              />
          </div>
      </div>
  </div>
);

export default LightingMenu;
