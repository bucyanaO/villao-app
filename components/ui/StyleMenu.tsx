/**
 * Architectural style picker.
 */
import type { FC } from 'react';

export interface StyleMenuProps {
  styleOptions: { id: string; name: string; desc: string }[];
  architecturalStyle: string;
  setArchitecturalStyle: (s: string) => void;
}

const StyleMenu: FC<StyleMenuProps> = ({ styleOptions, architecturalStyle, setArchitecturalStyle }) => (
  <div className="absolute top-20 right-6 bg-slate-950/90 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-2xl w-72 z-50 animate-fade-in-down">
    <h3 className="text-white font-bold text-xs uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-white/10 pb-2">
      <span className="text-purple-400">●</span> Architecture
    </h3>
    <div className="grid grid-cols-1 gap-2">
      {styleOptions.map((option) => (
        <button
          key={option.id}
          onClick={() => setArchitecturalStyle(option.id)}
          className={`group relative flex flex-col items-start gap-1 w-full p-3 rounded-lg text-left transition-all duration-200 overflow-hidden ${
            architecturalStyle === option.id 
              ? 'bg-purple-500/20 text-white ring-1 ring-purple-500/50' 
              : 'text-gray-400 hover:bg-white/5 hover:text-white'
          }`}
        >
           {architecturalStyle === option.id && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500"></div>
           )}
          <span className="text-xs font-bold uppercase">{option.name}</span>
          <span className="text-[10px] opacity-60 font-normal">{option.desc}</span>
        </button>
      ))}
    </div>
  </div>
);

export default StyleMenu;
