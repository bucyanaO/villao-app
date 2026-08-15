import { useState, useMemo } from 'react';
import type { FC } from 'react';
import VoxelCityScene from './components/NeighborhoodScene';
import { useGamepad } from './hooks/useGamepad';
import { useAudio } from './hooks/useAudio';
import { useCommandEngine } from './hooks/useCommandEngine';

import InteractionHud from './components/ui/InteractionHud';
import DrivingHud from './components/ui/DrivingHud';
import WalkInstructions from './components/ui/WalkInstructions';
import AnalysisModal from './components/ui/AnalysisModal';
import HeaderControls from './components/ui/HeaderControls';
import ScenarioConsole from './components/ui/ScenarioConsole';
import WeatherMenu from './components/ui/WeatherMenu';
import StyleMenu from './components/ui/StyleMenu';
import LightingMenu from './components/ui/LightingMenu';
import ControlsOverlay from './components/ui/ControlsOverlay';
import SettingsPanel from './components/ui/SettingsPanel';
import AudioElements from './components/ui/AudioElements';
import AgentChat from './components/ui/AgentChat';
import StudioPanel from './components/ui/StudioPanel';
import type { StudioEvent, Architect } from './engine/agents/studio';
import type { Persona } from './engine/agents/types';

/**
 * App — top-level orchestrator for the Voxel City.
 *
 * Holds the shared UI/engine state, wires the three feature hooks
 * (gamepad, audio, command engine) and composes the presentational
 * overlays from `components/ui`. All heavy 3D work lives in
 * `components/NeighborhoodScene` + the `engine/` package.
 */
const App: FC = () => {
  // --- UI / visibility state ---
  const [showControls, setShowControls] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLightingMenu, setShowLightingMenu] = useState(false);
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const [showWeatherMenu, setShowWeatherMenu] = useState(false);
  const [showScenarioInput, setShowScenarioInput] = useState(false);

  // Repérage/debug : ?preset=0&fog=0.3&style=mixed&walk=0 initialise la scène.
  const q = new URLSearchParams(window.location.search);
  const qNum = (key: string, fallback: number) => {
    const v = Number(q.get(key));
    return q.has(key) && Number.isFinite(v) ? v : fallback;
  };

  // --- Scene / simulation state ---
  const [lightingPreset, setLightingPreset] = useState(qNum('preset', 2)); // Start with Néon Nocturne
  const [fogLevel, setFogLevel] = useState(qNum('fog', 1.0));
  const [architecturalStyle, setArchitecturalStyle] = useState(q.get('style') || 'residential');
  const [weather, setWeather] = useState<'clear' | 'rain' | 'snow'>('clear');
  const [autoPilot, setAutoPilot] = useState(false);

  // --- Walk / drive state ---
  const [walkMode, setWalkMode] = useState(qNum('walk', 1) === 1);
  const [interactionLabel, setInteractionLabel] = useState<string | null>(null);
  const [isDriving, setIsDriving] = useState(false);
  const [talkingTo, setTalkingTo] = useState<Persona | null>(null);

  // --- Cabinet d'architectes (ville autonome) ---
  const [studioEvents, setStudioEvents] = useState<StudioEvent[]>([]);
  const [studioRoster, setStudioRoster] = useState<Architect[]>([]);
  const onStudioEvent = (e: StudioEvent, roster?: Architect[]) => {
    setStudioEvents((prev) => [...prev.slice(-40), e]);
    if (roster) setStudioRoster(roster.map((a) => ({ ...a })));
  };

  // --- Feature hooks ---
  const gamepadConnected = useGamepad();
  const audio = useAudio();

  // Static option tables (memoized to avoid re-renders).
  const lightingOptions = useMemo(() => [
    { name: 'Jour Naturel', color: 'bg-blue-400', border: 'border-blue-400' },
    { name: 'Coucher Solaire', color: 'bg-orange-500', border: 'border-orange-500' },
    { name: 'Néon Nocturne', color: 'bg-indigo-600', border: 'border-indigo-500' },
    { name: 'Grisaille Urbaine', color: 'bg-gray-400', border: 'border-gray-400' },
    { name: 'Alerte Rouge', color: 'bg-red-600', border: 'border-red-600' },
    { name: 'Plan Architectural', color: 'bg-blue-700', border: 'border-blue-700' },
    { name: 'Matrice Verte', color: 'bg-green-500', border: 'border-green-500' },
    { name: 'Vaporwave', color: 'bg-pink-500', border: 'border-pink-500' },
  ], []);

  const styleOptions = useMemo(() => [
    { id: 'residential', name: 'Résidentiel (P)', desc: 'Villas modernes, calme & luxe.' },
    { id: 'mixed', name: 'Eclectique (Mix)', desc: 'Mélange urbain organique.' },
    { id: 'extraordinary', name: 'Extra-Ordinaire', desc: 'Architecture connectée & déformée.' },
    { id: 'modern', name: 'Modernisme', desc: 'Verre, métal, lignes pures.' },
    { id: 'brutalist', name: 'Brutalisme', desc: 'Blocs massifs et décalés.' },
    { id: 'art_deco', name: 'Art Déco', desc: 'Structures en gradins.' },
    { id: 'cyberpunk', name: 'Néo-Futurisme', desc: 'Tours cylindriques et torsadées.' },
    { id: 'region', name: 'Région (villes+routes)', desc: 'Plusieurs villes reliées par un réseau routier.' },
  ], []);

  const handleLightingChange = (index: number) => {
    setLightingPreset(index);
    setFogLevel(1.0);
  };

  const closeAllMenus = () => {
    setShowLightingMenu(false);
    setShowSettings(false);
    setShowStyleMenu(false);
    setShowWeatherMenu(false);
    setShowScenarioInput(false);
  };

  // --- Command engine (God Mode) ---
  const cmd = useCommandEngine({
    setLightingPreset,
    setWeather,
    setFogLevel,
    getTelemetry: () => ({
      currentWeather: weather,
      currentLightingIndex: lightingPreset,
      lightingName: lightingOptions[lightingPreset]?.name ?? '',
      currentStyle: architecturalStyle,
      isDriving,
      isWalking: walkMode,
      fogLevel,
    }),
    onCinematicStart: () => { closeAllMenus(); setShowControls(false); },
    onCinematicEnd: () => { setShowControls(true); },
  });

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black font-mono select-none">
      {/* 3D Scene */}
      <VoxelCityScene
        lightingPreset={lightingPreset}
        fogLevel={fogLevel}
        architecturalStyle={architecturalStyle}
        weather={weather}
        autoPilot={autoPilot}
        aiCommand={cmd.aiCommand}
        walkMode={walkMode}
        setInteractionLabel={setInteractionLabel}
        setIsDriving={setIsDriving}
        onTalkToAgent={setTalkingTo}
        onStudioEvent={onStudioEvent}
      />

      {/* Ce que les agents sont en train de bâtir */}
      <StudioPanel events={studioEvents} roster={studioRoster} />

      {/* HUDs */}
      {walkMode && interactionLabel && !isDriving && (
        <InteractionHud gamepadConnected={gamepadConnected} interactionLabel={interactionLabel} />
      )}
      {isDriving && <DrivingHud gamepadConnected={gamepadConnected} />}
      {walkMode && !cmd.isAnalyzing && !isDriving && (
        <WalkInstructions gamepadConnected={gamepadConnected} setWalkMode={setWalkMode} />
      )}

      {/* AI analysis modal */}
      {(cmd.isAnalyzing || cmd.analysisResult) && (
        <AnalysisModal
          isAnalyzing={cmd.isAnalyzing}
          analysisResult={cmd.analysisResult}
          setAnalysisResult={cmd.setAnalysisResult}
        />
      )}

      {/* Top-right toolbar (always present) */}
      <HeaderControls
        walkMode={walkMode}
        isAnalyzing={cmd.isAnalyzing}
        showScenarioInput={showScenarioInput}
        showWeatherMenu={showWeatherMenu}
        showStyleMenu={showStyleMenu}
        showLightingMenu={showLightingMenu}
        showSettings={showSettings}
        showControls={showControls}
        closeAllMenus={closeAllMenus}
        setWalkMode={setWalkMode}
        setAutoPilot={setAutoPilot}
        setShowScenarioInput={setShowScenarioInput}
        setShowWeatherMenu={setShowWeatherMenu}
        setShowStyleMenu={setShowStyleMenu}
        setShowLightingMenu={setShowLightingMenu}
        setShowControls={setShowControls}
        setShowSettings={setShowSettings}
      />

      {/* Right-side menus / console */}
      {showScenarioInput && (
        <ScenarioConsole
          scenarioPrompt={cmd.scenarioPrompt}
          setScenarioPrompt={cmd.setScenarioPrompt}
          handleGeminiScenario={cmd.runCommand}
          isAnalyzing={cmd.isAnalyzing}
          chatLog={cmd.chatLog}
        />
      )}
      {showWeatherMenu && (
        <WeatherMenu
          weather={weather}
          setWeather={setWeather}
          autoPilot={autoPilot}
          setAutoPilot={setAutoPilot}
          setWalkMode={setWalkMode}
        />
      )}
      {showStyleMenu && (
        <StyleMenu
          styleOptions={styleOptions}
          architecturalStyle={architecturalStyle}
          setArchitecturalStyle={setArchitecturalStyle}
        />
      )}
      {showLightingMenu && (
        <LightingMenu
          lightingOptions={lightingOptions}
          lightingPreset={lightingPreset}
          handleLightingChange={handleLightingChange}
          fogLevel={fogLevel}
          setFogLevel={setFogLevel}
        />
      )}

      {/* Info overlay + audio settings */}
      {showControls && !cmd.isAnalyzing && !walkMode && (
        <ControlsOverlay setShowControls={setShowControls} />
      )}
      {showSettings && (
        <SettingsPanel
          isAudioEnabled={audio.isAudioEnabled}
          toggleAudio={audio.toggleAudio}
          volumes={audio.volumes}
          handleVolumeChange={audio.handleVolumeChange}
        />
      )}

      {/* Chat launcher — easily accessible at the bottom */}
      {!showScenarioInput && (
        <button
          onClick={() => { closeAllMenus(); setShowScenarioInput(true); }}
          className="absolute bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-red-600 to-red-800 text-white font-bold text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:from-red-500 hover:to-red-700 transition-all active:scale-95"
          title="Parler à la cité (IA)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.484-.173 2.657-1.556 2.657-3.05V7.5a3 3 0 00-3-3H5.25a3 3 0 00-3 3v5.26z" />
          </svg>
          Parler
        </button>
      )}

      {/* AI agent conversation */}
      {talkingTo && (
        <AgentChat
          key={talkingTo.id}
          persona={talkingTo}
          telemetry={{ weather, lightingName: lightingOptions[lightingPreset]?.name, currentStyle: architecturalStyle }}
          onClose={() => setTalkingTo(null)}
        />
      )}

      {/* Hidden ambient audio tracks */}
      <AudioElements
        musicRef={audio.musicRef}
        trafficRef={audio.trafficRef}
        crowdRef={audio.crowdRef}
        envRef={audio.envRef}
      />
    </div>
  );
};

export default App;
