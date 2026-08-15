/**
 * Hidden <audio> elements driven by useAudio.
 */
import type { FC, RefObject } from 'react';

export interface AudioElementsProps {
  musicRef: RefObject<HTMLAudioElement | null>;
  trafficRef: RefObject<HTMLAudioElement | null>;
  crowdRef: RefObject<HTMLAudioElement | null>;
  envRef: RefObject<HTMLAudioElement | null>;
}

const AudioElements: FC<AudioElementsProps> = ({ musicRef, trafficRef, crowdRef, envRef }) => (
  <>
    <audio ref={musicRef} src="https://storage.googleapis.com/static.aistudio.google.com/electronic-ambient.mp3" loop controls={false} />
    <audio ref={trafficRef} src="https://assets.mixkit.co/active_storage/sfx/2515/2515-preview.mp3" loop controls={false} />
    <audio ref={crowdRef} src="https://assets.mixkit.co/active_storage/sfx/446/446-preview.mp3" loop controls={false} />
    <audio ref={envRef} src="https://assets.mixkit.co/active_storage/sfx/1200/1200-preview.mp3" loop controls={false} />
  </>
);

export default AudioElements;
