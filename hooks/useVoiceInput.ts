import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * useVoiceInput — speech-to-text via the Web Speech API (browser-native).
 * Returns whether it's supported, whether it's listening, and start/stop.
 * `start(onResult)` listens once (fr-FR) and calls back with the transcript.
 */
export function useVoiceInput(lang: string = 'fr-FR') {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSupported(!!SR);
  }, []);

  const start = useCallback((onResult: (text: string) => void) => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRegistration || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    try {
      const rec = new SR();
      rec.lang = lang;
      rec.interimResults = false;
      rec.continuous = false;
      rec.onresult = (e: any) => { const t = e.results?.[0]?.[0]?.transcript; if (t) onResult(t); };
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      recRef.current = rec;
      setListening(true);
      rec.start();
    } catch { setListening(false); }
  }, [lang]);

  const stop = useCallback(() => { try { recRef.current?.stop(); } catch {} setListening(false); }, []);

  return { supported, listening, start, stop };
}
