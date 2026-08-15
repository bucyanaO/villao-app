/**
 * Audio mixer panel (per-track volume sliders + master toggle).
 */
import type { FC } from 'react';

export interface SettingsPanelProps {
  isAudioEnabled: boolean;
  toggleAudio: () => void;
  volumes: { music: number; traffic: number; crowd: number; env: number };
  handleVolumeChange: (key: 'music' | 'traffic' | 'crowd' | 'env', value: number) => void;
}

const SettingsPanel: FC<SettingsPanelProps> = ({ isAudioEnabled, toggleAudio, volumes, handleVolumeChange }) => (
    <div className="absolute top-20 right-6 bg-slate-950/90 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-2xl w-72 z-50 animate-fade-in-down">
        {/* Audio Header & Toggle */}
        <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
          <h3 className="text-white font-bold text-xs uppercase tracking-widest flex items-center gap-2">
            <span className="text-cyan-400">●</span> Mixage Audio
          </h3>
          <button 
            onClick={toggleAudio}
            className={`w-11 h-6 rounded-full transition-colors flex items-center px-1 relative ${isAudioEnabled ? 'bg-cyan-900 ring-1 ring-cyan-500' : 'bg-gray-800 ring-1 ring-gray-700'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-300 ${isAudioEnabled ? 'translate-x-5 bg-cyan-100' : 'translate-x-0 bg-gray-400'}`}></div>
          </button>
        </div>
      
        <div className={`space-y-5 transition-opacity duration-300 ${isAudioEnabled ? 'opacity-100' : 'opacity-30 pointer-events-none grayscale'}`}>
          {[
              { label: "Musique Ambiante", val: volumes.music, key: 'music', color: 'from-cyan-600 to-cyan-400' },
              { label: "Trafic Urbain", val: volumes.traffic, key: 'traffic', color: 'from-yellow-600 to-yellow-400' },
              { label: "Foule & Vie", val: volumes.crowd, key: 'crowd', color: 'from-pink-600 to-pink-400' },
              { label: "Environnement", val: volumes.env, key: 'env', color: 'from-green-600 to-green-400' }
          ].map((item) => (
            <div key={item.key}>
                <div className="flex justify-between text-[10px] uppercase tracking-wider text-gray-400 mb-2">
                    <span>{item.label}</span>
                    <span className="text-white">{Math.round(item.val * 100)}%</span>
                </div>
                <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden group">
                    <div 
                        className={`absolute top-0 left-0 h-full bg-gradient-to-r ${item.color} transition-all duration-100`}
                        style={{ width: `${item.val * 100}%` }}
                    ></div>
                    <input 
                        type="range" min="0" max="1" step="0.01" 
                        value={item.val}
                        onChange={(e) => handleVolumeChange(item.key as keyof typeof volumes, parseFloat(e.target.value))}
                        className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                    />
                </div>
            </div>
          ))}
        </div>
  </div>
);

export default SettingsPanel;
