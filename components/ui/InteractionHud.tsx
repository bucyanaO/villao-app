/**
 * Center-screen interaction prompt (press F / X to interact).
 */
import type { FC } from 'react';

export interface InteractionHudProps {
  gamepadConnected: boolean;
  interactionLabel: string | null;
}

const InteractionHud: FC<InteractionHudProps> = ({ gamepadConnected, interactionLabel }) => (
  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-12 z-50 animate-bounce">
      <div className="bg-black/80 backdrop-blur-md border border-white/20 text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.2)]">
          <div className="w-6 h-6 rounded-full bg-white text-black font-bold flex items-center justify-center text-xs">
              {gamepadConnected ? "X" : "F"}
          </div>
          <span className="text-sm font-bold tracking-wide uppercase">{interactionLabel}</span>
      </div>
  </div>
);

export default InteractionHud;
