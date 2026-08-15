import { useState, useRef, useEffect } from 'react';

export interface Volumes { music: number; traffic: number; crowd: number; env: number; }
export type VolumeKey = keyof Volumes;

export interface AudioController {
  isAudioEnabled: boolean;
  volumes: Volumes;
  toggleAudio: () => Promise<void>;
  handleVolumeChange: (key: VolumeKey, value: number) => void;
  musicRef: React.RefObject<HTMLAudioElement | null>;
  trafficRef: React.RefObject<HTMLAudioElement | null>;
  crowdRef: React.RefObject<HTMLAudioElement | null>;
  envRef: React.RefObject<HTMLAudioElement | null>;
}

/**
 * useAudio — owns the ambient multi-track audio mixer (music / traffic / crowd / env).
 * Play/pause is guarded against browser autoplay-policy interruptions.
 */
export function useAudio(): AudioController {
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [volumes, setVolumes] = useState<Volumes>({ music: 0.3, traffic: 0.4, crowd: 0.2, env: 0.1 });

  const musicRef = useRef<HTMLAudioElement>(null);
  const trafficRef = useRef<HTMLAudioElement>(null);
  const crowdRef = useRef<HTMLAudioElement>(null);
  const envRef = useRef<HTMLAudioElement>(null);

  const toggleAudio = async () => {
    const newState = !isAudioEnabled;
    setIsAudioEnabled(newState);

    const audios = [musicRef.current, trafficRef.current, crowdRef.current, envRef.current];
    for (const audio of audios) {
      if (!audio) continue;
      if (newState) {
        try {
          audio.currentTime = 0;
          await audio.play();
        } catch (error) {
          // Browser autoplay policy may block this until the user interacts again.
          console.warn('Audio playback prevented by browser policy or interruption:', error);
        }
      } else {
        try { audio.pause(); } catch { /* ignore */ }
      }
    }
  };

  // Sync volumes to the <audio> elements whenever they change.
  useEffect(() => {
    if (musicRef.current) musicRef.current.volume = volumes.music;
    if (trafficRef.current) trafficRef.current.volume = volumes.traffic;
    if (crowdRef.current) crowdRef.current.volume = volumes.crowd;
    if (envRef.current) envRef.current.volume = volumes.env;
  }, [volumes]);

  const handleVolumeChange = (key: VolumeKey, value: number) => {
    setVolumes(prev => ({ ...prev, [key]: value }));
  };

  return { isAudioEnabled, volumes, toggleAudio, handleVolumeChange, musicRef, trafficRef, crowdRef, envRef };
}
