/**
 * VOXEL DRIVER overlay shown while driving a vehicle.
 */
import type { FC } from 'react';

export interface DrivingHudProps {
  gamepadConnected: boolean;
}

const DrivingHud: FC<DrivingHudProps> = ({ gamepadConnected }) => (
  <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 animate-fade-in-up">
      <div className="bg-red-900/80 backdrop-blur-xl border border-red-500/50 px-8 py-4 rounded-2xl shadow-[0_0_30px_rgba(220,38,38,0.4)] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse"></div>
          <h2 className="text-red-100 font-black text-2xl tracking-tighter uppercase italic text-center">VOXEL DRIVER</h2>
          <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-red-300 font-bold uppercase tracking-widest">
               <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span> Moteur Actif</span>
               <span>|</span>
               <span>{gamepadConnected ? "LS : Piloter" : "ZQSD : Piloter"}</span>
               <span>|</span>
               <span>{gamepadConnected ? "B : Sortir" : "F : Sortir"}</span>
          </div>
      </div>
  </div>
);

export default DrivingHud;
