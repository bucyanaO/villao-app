/**
 * Walk-mode control hints (keyboard or gamepad) with an exit button.
 */
import type { FC } from 'react';

export interface WalkInstructionsProps {
  gamepadConnected: boolean;
  setWalkMode: (v: boolean) => void;
}

const WalkInstructions: FC<WalkInstructionsProps> = ({ gamepadConnected, setWalkMode }) => (
  <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-40 bg-black/60 backdrop-blur-md px-6 py-4 rounded-xl border border-white/10 flex items-center gap-6 animate-fade-in-up">
      {gamepadConnected ? (
          /* GAMEPAD INSTRUCTIONS */
          <div className="flex gap-6 items-center">
               <div className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center text-white font-bold bg-white/10 relative">
                      <div className="w-2 h-2 bg-white rounded-full absolute top-2"></div>
                  </div>
                  <span className="text-[10px] text-gray-400">BOUGER</span>
              </div>
               <div className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center text-white font-bold bg-white/10 relative">
                      <div className="w-2 h-2 bg-white rounded-full absolute bottom-2 right-2"></div>
                  </div>
                  <span className="text-[10px] text-gray-400">CAMERA</span>
              </div>
              <div className="h-8 w-px bg-white/20"></div>
              <div className="flex flex-col gap-2 text-xs text-gray-300">
                  <div className="flex items-center gap-2">
                      <span className="font-bold border border-white/30 px-2 rounded-full bg-green-500/20 text-green-400">A</span> <span>SAUTER</span>
                  </div>
                  <div className="flex items-center gap-2">
                      <span className="font-bold border border-white/30 px-2 rounded-full bg-blue-500/20 text-blue-400">X</span> <span>INTERAGIR</span>
                  </div>
              </div>
          </div>
      ) : (
          /* KEYBOARD INSTRUCTIONS */
          <div className="flex gap-6 items-center">
            <div className="flex gap-2">
                <div className="flex flex-col items-center gap-1">
                    <div className="w-8 h-8 rounded border border-white/30 flex items-center justify-center text-white font-bold bg-white/10">Z</div>
                    <div className="w-8 h-8 rounded border border-white/30 flex items-center justify-center text-white font-bold bg-white/10">Q</div>
                    <div className="w-8 h-8 rounded border border-white/30 flex items-center justify-center text-white font-bold bg-white/10">S</div>
                    <div className="w-8 h-8 rounded border border-white/30 flex items-center justify-center text-white font-bold bg-white/10">D</div>
                </div>
            </div>
            <div className="h-10 w-px bg-white/20"></div>
            <div className="flex flex-col gap-2 text-xs text-gray-300">
                <div className="flex items-center gap-2">
                    <span className="font-bold border border-white/30 px-2 rounded bg-white/10">ESPACE</span> <span>SAUTER</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="font-bold border border-white/30 px-2 rounded bg-white/10">SHIFT</span> <span>COURIR</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="font-bold border border-white/30 px-2 rounded bg-white/10">F</span> <span>INTERAGIR</span>
                </div>
            </div>
          </div>
      )}
       <button 
          onClick={() => setWalkMode(false)}
          className="ml-4 px-4 py-2 bg-red-500/80 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors"
       >
           QUITTER
       </button>
  </div>
);

export default WalkInstructions;
