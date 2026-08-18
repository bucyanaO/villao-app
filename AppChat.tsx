/**
 * AppChat — variante d'App avec un grand panneau de conversation
 * façon ChatGPT/Claude, fixé à droite, optimisé pour grand écran.
 *
 * La scène 3D occupe la gauche ; le ChatPanel remplace le ScenarioConsole
 * pop-up, le bouton « Parler » flottant et l'AgentChat en fenêtre volante.
 *
 * Activé via ?chat=1 (voir index.tsx). Préserve l'App original.
 */
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
import WeatherMenu from './components/ui/WeatherMenu';
import StyleMenu from './components/ui/StyleMenu';
import LightingMenu from './components/ui/LightingMenu';
import ControlsOverlay from './components/ui/ControlsOverlay';
import SettingsPanel from './components/ui/SettingsPanel';
import AudioElements from './components/ui/AudioElements';
import StudioPanel from './components/ui/StudioPanel';
import MiniMap from './components/ui/MiniMap';
import ChatPanel from './components/ui/ChatPanel';
import type { StudioEvent, Architect, CityReport } from './engine/agents/studio';
import type { MapSample } from './engine/world/minimap';
import { PROGRAM_LABEL } from './engine/world/programs';

const AppChat: FC = () => {
  const [showControls, setShowControls] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLightingMenu, setShowLightingMenu] = useState(false);
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const [showWeatherMenu, setShowWeatherMenu] = useState(false);
  const [chatOpen, setChatOpen] = useState(true); // panneau ouvert par défaut

  const q = new URLSearchParams(window.location.search);
  const qNum = (key: string, fallback: number) => {
    const v = Number(q.get(key));
    return q.has(key) && Number.isFinite(v) ? v : fallback;
  };

  const [lightingPreset, setLightingPreset] = useState(qNum('preset', 0));
  const [fogLevel, setFogLevel] = useState(qNum('fog', 1.0));
  const [architecturalStyle, setArchitecturalStyle] = useState(q.get('style') || 'residential');
  const [weather, setWeather] = useState<'clear' | 'rain' | 'snow'>('clear');
  const [autoPilot, setAutoPilot] = useState(false);

  const [walkMode, setWalkMode] = useState(qNum('walk', 1) === 1);
  const [interactionLabel, setInteractionLabel] = useState<string | null>(null);
  const [isDriving, setIsDriving] = useState(false);

  const [studioEvents, setStudioEvents] = useState<StudioEvent[]>([]);
  const [studioRoster, setStudioRoster] = useState<Architect[]>([]);
  const showStats = q.get('stats') === '1';
  const [stats, setStats] = useState<{ fps: number; draws: number; tris: number; buildings: number; acts: number; frontier: number; tiles: number } | null>(null);
  const [cityReport, setCityReport] = useState<CityReport | null>(null);
  const [mapSample, setMapSample] = useState<MapSample | null>(null);
  const onStudioEvent = (e: StudioEvent, roster?: Architect[], report?: CityReport) => {
    setStudioEvents((prev) => [...prev.slice(-40), e]);
    if (roster) setStudioRoster(roster.map((a) => ({ ...a })));
    if (report) setCityReport(report);
  };

  const gamepadConnected = useGamepad();
  const audio = useAudio();

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
  };

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
      population: cityReport?.population,
      jobs: cityReport?.jobs,
      needs: cityReport?.needs.slice(0, 4).map((n) => PROGRAM_LABEL[n.kind]),
    }),
    onCinematicStart: () => { closeAllMenus(); setShowControls(false); },
    onCinematicEnd: () => { setShowControls(true); },
  });

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black font-mono select-none">
      {/* 3D Scene — occupe toute la largeur ; le panneau flotte par-dessus à droite */}
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
        onTalkToAgent={() => { setChatOpen(true); }}
        talkingTo={null}
        onStudioEvent={onStudioEvent}
        onStats={showStats ? setStats : undefined}
        onMinimap={setMapSample}
      />

      <MiniMap sample={mapSample} />

      {showStats && stats && (
        <div className="pointer-events-none fixed left-4 top-4 z-30 rounded border border-cyan-500/30 bg-slate-950/80 px-3 py-2 font-mono text-[11px] text-cyan-200 backdrop-blur">
          {stats.fps} fps · {stats.draws} draws · {(stats.tris / 1000).toFixed(0)}k tris<br />
          {stats.buildings} bâtiments affichés · {stats.acts} actes · {stats.tiles} tuiles<br />
          frontière {stats.frontier} m
        </div>
      )}

      <StudioPanel events={studioEvents} roster={studioRoster} report={cityReport} />

      {walkMode && interactionLabel && !isDriving && (
        <InteractionHud gamepadConnected={gamepadConnected} interactionLabel={interactionLabel} />
      )}
      {isDriving && <DrivingHud gamepadConnected={gamepadConnected} />}
      {walkMode && !cmd.isAnalyzing && !isDriving && (
        <WalkInstructions gamepadConnected={gamepadConnected} setWalkMode={setWalkMode} />
      )}

      {(cmd.isAnalyzing || cmd.analysisResult) && (
        <AnalysisModal
          isAnalyzing={cmd.isAnalyzing}
          analysisResult={cmd.analysisResult}
          setAnalysisResult={cmd.setAnalysisResult}
        />
      )}

      {/* Toolbar — décalée à gauche quand le panneau est ouvert pour rester visible */}
      <div className={chatOpen ? 'pr-[460px]' : ''}>
        <HeaderControls
          walkMode={walkMode}
          isAnalyzing={cmd.isAnalyzing}
          showScenarioInput={false}
          showWeatherMenu={showWeatherMenu}
          showStyleMenu={showStyleMenu}
          showLightingMenu={showLightingMenu}
          showSettings={showSettings}
          showControls={showControls}
          closeAllMenus={closeAllMenus}
          setWalkMode={setWalkMode}
          setAutoPilot={setAutoPilot}
          setShowScenarioInput={() => { setChatOpen(true); closeAllMenus(); }}
          setShowWeatherMenu={setShowWeatherMenu}
          setShowStyleMenu={setShowStyleMenu}
          setShowLightingMenu={setShowLightingMenu}
          setShowControls={setShowControls}
          setShowSettings={setShowSettings}
        />
      </div>

      {showWeatherMenu && (
        <WeatherMenu weather={weather} setWeather={setWeather} autoPilot={autoPilot} setAutoPilot={setAutoPilot} setWalkMode={setWalkMode} />
      )}
      {showStyleMenu && (
        <StyleMenu styleOptions={styleOptions} architecturalStyle={architecturalStyle} setArchitecturalStyle={setArchitecturalStyle} />
      )}
      {showLightingMenu && (
        <LightingMenu lightingOptions={lightingOptions} lightingPreset={lightingPreset} handleLightingChange={handleLightingChange} fogLevel={fogLevel} setFogLevel={setFogLevel} />
      )}

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

      {/* Grand panneau de conversation façon ChatGPT/Claude */}
      {chatOpen && (
        <ChatPanel
          chatLog={cmd.chatLog}
          isAnalyzing={cmd.isAnalyzing}
          scenarioPrompt={cmd.scenarioPrompt}
          setScenarioPrompt={cmd.setScenarioPrompt}
          runCommand={cmd.runCommand}
          onClose={() => setChatOpen(false)}
        />
      )}

      {/* Bouton flottant pour rouvrir le panneau */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="absolute bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-cyan-600 to-blue-700 text-white font-bold text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(34,211,238,0.4)] hover:from-cyan-500 hover:to-blue-600 transition-all active:scale-95"
          title="Ouvrir la conversation"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.484-.173 2.657-1.556 2.657-3.05V7.5a3 3 0 00-3-3H5.25a3 3 0 00-3 3v5.26z" />
          </svg>
          Conversation
        </button>
      )}

      <AudioElements
        musicRef={audio.musicRef}
        trafficRef={audio.trafficRef}
        crowdRef={audio.crowdRef}
        envRef={audio.envRef}
      />
    </div>
  );
};

export default AppChat;
