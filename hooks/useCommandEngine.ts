/**
 * useCommandEngine — the "God Mode" brain.
 * Owns the chat log, the AI/local command execution, and the resulting engine command.
 * Scene settings (lighting/weather/fog) are applied through the provided setters;
 * cinematic UI side-effects (closing menus, toggling the info overlay) go through callbacks.
 */
import { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { parseLocalCommand } from '../lib/commandParser';
import { callAgent } from '../lib/agentGateway';
import { CITY_PERSONA } from '../engine/agents/personas';

export interface ChatMessage { role: 'user' | 'system'; text: string; action?: string }

export interface CommandTelemetry {
  currentWeather: 'clear' | 'rain' | 'snow';
  currentLightingIndex: number;
  lightingName: string;
  currentStyle: string;
  isDriving: boolean;
  isWalking: boolean;
  fogLevel: number;
  /** État de la ville vivante (population, emplois, manques). */
  population?: number;
  jobs?: number;
  needs?: string[];
}

export interface CommandEngineOptions {
  setLightingPreset: (n: number) => void;
  setWeather: (w: 'clear' | 'rain' | 'snow') => void;
  setFogLevel: (n: number) => void;
  getTelemetry: () => CommandTelemetry;
  onCinematicStart: () => void;
  onCinematicEnd: () => void;
}

export interface CommandEngine {
  scenarioPrompt: string;
  setScenarioPrompt: (s: string) => void;
  chatLog: ChatMessage[];
  isAnalyzing: boolean;
  analysisResult: { thought: string; action: string } | null;
  setAnalysisResult: (r: { thought: string; action: string } | null) => void;
  aiCommand: any;
  runCommand: () => Promise<void>;
}

export function useCommandEngine(opts: CommandEngineOptions): CommandEngine {
  const [scenarioPrompt, setScenarioPrompt] = useState("");
  const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{ thought: string; action: string } | null>(null);
  const [aiCommand, setAiCommand] = useState<any>(null);

  // Scene-setting setters delegated back to the host component.
  const { setLightingPreset, setWeather, setFogLevel } = opts;

  const pushChat = (role: 'user' | 'system', text: string, action?: string) => {
    setChatLog(prev => [...prev.slice(-12), { role, text, action }]);
  };



  const applyCommandResult = (result: any) => {
    if (result.settings) {
      if (typeof result.settings.lightingPreset === 'number') setLightingPreset(result.settings.lightingPreset);
      if (result.settings.weather) setWeather(result.settings.weather);
      if (typeof result.settings.fog === 'number') setFogLevel(result.settings.fog);
    }
    setAiCommand({
      npcState: result.settings?.npcState,
      trafficSpeed: result.settings?.trafficSpeed,
      globalChaos: result.settings?.globalChaos,
      realityBending: result.settings?.realityBending || { distortion: 0, glitchIntensity: 0, timeScale: 1, gravity: 1 },
      specialEffects: result.settings?.specialEffects || {},
      godOperations: result.godOperations || [],
      summon: result.summon || null,
      world: result.world || null,
    });
  };



  // --- GEMINI SCENARIO MODE ---
  const runCommand = async () => {
    const prompt = scenarioPrompt.trim();
    if (!prompt || isAnalyzing) return;

    // --- 0. ÉTAT DE LA VILLE (réponse immédiate, tirée de la télémétrie) ---
    const asked = prompt.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (/rapport|ou en est la ville|etat de la ville|combien d habitants|population|il manque quoi|que manque/.test(asked)) {
      const t = opts.getTelemetry();
      pushChat('user', prompt);
      setScenarioPrompt("");
      if (t.population === undefined) {
        pushChat('system', "Le cabinet n'a pas encore ouvert ses registres — laissez-lui quelques instants.", 'VILLE');
      } else {
        const manque = (t.needs ?? []).slice(0, 3).join(', ');
        pushChat(
          'system',
          `${t.population.toLocaleString('fr-FR')} habitants pour ${t.jobs?.toLocaleString('fr-FR')} emplois.` +
          (manque ? ` Il manque surtout : ${manque}.` : ' Les besoins sont couverts pour l\'instant.'),
          'VILLE',
        );
      }
      return;
    }

    // --- 1. LOCAL COMMAND ENGINE (offline, instant) ---
    const local = parseLocalCommand(prompt);
    if (local) {
      pushChat('user', prompt);
      applyCommandResult(local);
      pushChat('system', local.thought, local.action);
      setScenarioPrompt("");
      return;
    }

    // --- 2. FALLBACK: Gemini AI (only if a real key is configured) ---
    const key = process.env.API_KEY;
    if (!key || key === 'PLACEHOLDER_API_KEY' || key.length < 10) {
      // No Gemini key: answer free-form questions through the VPS gateway (Gemma) instead of "commande non reconnue".
      pushChat('user', prompt);
      setScenarioPrompt("");
      try {
        const reply = await callAgent({ persona: CITY_PERSONA, messages: [{ role: 'user', content: prompt }], telemetry: opts.getTelemetry() as any });
        pushChat('system', reply, 'IA');
      } catch (e) {
        // On dit ce qui a échoué : « erreur de connexion » tout court envoie
        // chercher une panne réseau alors que c'est souvent un 404 de modèle.
        pushChat('system', `Passerelle IA injoignable — ${(e as Error).message}`, 'ERREUR');
      }
      return;
    }

    // Cinematic Gemini flow
    opts.onCinematicStart();
    setIsAnalyzing(true);
    setAnalysisResult(null);
    pushChat('user', prompt);

    // Wait for UI to clear
    setTimeout(async () => {
        try {
            const canvas = document.querySelector('canvas');
            if (!canvas) throw new Error("Canvas not found");

            const dataUrl = canvas.toDataURL('image/png');
            const base64Image = dataUrl.split(',')[1];

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            // CONTEXT AWARENESS: Inject current app state
            const cityTelemetry = JSON.stringify(opts.getTelemetry());

            // Call Gemini 2.5 Flash for Multimodal Vision with CONTROL prompt
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [
                    {
                        role: 'user',
                        parts: [
                            {
                                inlineData: {
                                    mimeType: 'image/png',
                                    data: base64Image
                                }
                            },
                            {
                                text: `Tu es le "MOTEUR DE RÉALITÉ SUPRÊME" (Game Engine AI) de cette simulation 3D.
                                
                                === TÉLÉMÉTRIE ACTUELLE (NE PAS IGNORER) ===
                                ${cityTelemetry}
                                
                                === REQUÊTE UTILISATEUR ===
                                "${scenarioPrompt}"
                                
                                === TA MISSION ===
                                Analyse l'image et la télémétrie. Traduis la volonté de l'utilisateur en paramètres JSON pour le moteur.
                                
                                TU AS UN POUVOIR ILLIMITÉ (God Mode).
                                
                                CAPACITÉS DISPONIBLES :
                                1. GLOBAL: Météo, Lumière, Style.
                                2. SPAWN: Faire apparaître (Tree, Car, Person, Sculpture, UFO, Kaiju).
                                3. BUILD: Construire des bâtiments (Floors, Style, Position).
                                4. SPECIAL FX: flood, alienInvasion, kaiju, blackHole, disco, meteorShower, matrix, rapture, iceAge, lava.
                                5. PHYSICS: Gravity (0=Float, -1=Invert), TimeScale (0=Stop), Distortion, Glitch.
                                6. ENTITY CONTROL: REMOVE, RECOLOR, RESIZE, TELEPORT, CAMERA.

                                FORMAT DE RÉPONSE JSON ATTENDU (UNIQUEMENT JSON, PAS DE TEXTE AVANT/APRÈS) :
                                {
                                  "thought": "Phrase courte, épique et omnisciente décrivant ton action.",
                                  "action": "Nom de code système (ex: 'PROTOCOL_OMEGA', 'SPAWN_INIT')",
                                  "settings": {
                                     "lightingPreset": (0-7 ou null),
                                     "weather": ("clear", "rain", "snow" ou null),
                                     "realityBending": {
                                        "distortion": (0.0 = normal, 1.0 = warp),
                                        "glitchIntensity": (0.0 = normal, 1.0 = chaos),
                                        "timeScale": (1.0 = normal, 0.0 = freeze),
                                        "gravity": (1.0 = normal, -1.0 = invert, 0.0 = float)
                                     },
                                     "specialEffects": {
                                         "kaiju": true/false,
                                         "flood": true/false,
                                         // ... autres effets si demandés
                                     }
                                  },
                                  "godOperations": [
                                    {
                                      "action": "SPAWN" | "REMOVE" | "RECOLOR" | "RESIZE" | "TELEPORT" | "CAMERA" | "BUILD",
                                      "selector": {
                                        "type": "vehicle" | "inhabitant" | "building" | "tree" | "all",
                                        "color": "red" (optional match),
                                        "count": "all" (or number)
                                      },
                                      "params": {
                                        "type": "tree" | "car" | "person" | "sculpture",
                                        "color": "#ff0000",
                                        "scale": 2.0,
                                        "position": { "x": 0, "y": 10, "z": 0 },
                                        "lookAt": { "x": 0, "y": 0, "z": 0 },
                                        "floors": 10,
                                        "style": "cyberpunk"
                                      }
                                    }
                                  ]
                                }
                                `
                            }
                        ]
                    }
                ]
            });

            const text = response.text;
            // Robust JSON Cleaning: Remove markdown code blocks and whitespace
            const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const result = JSON.parse(cleanJson);

            // APPLY AI DECISIONS
            setAnalysisResult({ thought: result.thought, action: result.action });
            applyCommandResult(result);
            pushChat('system', result.thought, result.action);

        } catch (error) {
            console.error("Gemini Error:", error);
            setAnalysisResult({
                thought: "Une anomalie quantique empêche l'exécution de cette commande. Veuillez reformuler.",
                action: "ERREUR SYSTÈME"
            });
            pushChat('system', "Erreur IA. Reformule ou réessaie.", "ERREUR");
        } finally {
            setIsAnalyzing(false);
            opts.onCinematicEnd();
            setScenarioPrompt(""); // Clear input
        }
    }, 500);
  };


  return { scenarioPrompt, setScenarioPrompt, chatLog, isAnalyzing, analysisResult, setAnalysisResult, aiCommand, runCommand };
}
