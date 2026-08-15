import { useState, useEffect } from 'react';

/**
 * useGamepad — tracks whether a gamepad is currently connected.
 * Drives the keyboard-vs-gamepad hints shown across the HUD.
 */
export function useGamepad(): boolean {
  const [gamepadConnected, setGamepadConnected] = useState(false);

  useEffect(() => {
    const onConnect = () => setGamepadConnected(true);
    const onDisconnect = () => setGamepadConnected(false);
    window.addEventListener('gamepadconnected', onConnect);
    window.addEventListener('gamepaddisconnected', onDisconnect);
    return () => {
      window.removeEventListener('gamepadconnected', onConnect);
      window.removeEventListener('gamepaddisconnected', onDisconnect);
    };
  }, []);

  return gamepadConnected;
}
