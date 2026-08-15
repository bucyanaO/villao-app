/**
 * NeighborhoodScene — the React wrapper around the imperative Three.js voxel city.
 *
 * Responsibilities kept here (the real-time lifecycle):
 *  - one-time init: renderer / camera / controls / sky / lights / stars / weather particles
 *  - input: keyboard + gamepad + mouse, interaction (enter/exit vehicles, visit buildings)
 *  - the animation loop: drives vehicles, inhabitants, aircraft, special FX, camera
 *  - reactive effects: lighting/weather, walk<->orbit switching, city regeneration
 *
 * Pure / extractable concerns live in the `engine/` package:
 *  - `engine/assets/*`   voxel meshes & materials
 *  - `engine/cityGenerator.ts`  builds the city for a given style
 *  - `engine/godOperations.ts`  AI spawn/remove/... + `summonVehicle`
 *  - `engine/presets.ts`, `engine/shaders.ts`, `engine/theme.ts`, `engine/types.ts`
 */
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import { sharedMaterials, InhabitantState } from '../engine/assets';
import { SKY_VERTEX_SHADER, SKY_FRAGMENT_SHADER } from '../engine/shaders';
import { LIGHTING_PRESETS as presets } from '../engine/presets';
import type { AICommand } from '../engine/types';
import type { AnimState, InteractionState } from '../engine/context';
import { executeGodOperations, summonVehicle } from '../engine/godOperations';
import type { GodOpsCtx } from '../engine/godOperations';
import { generateCity } from '../engine/cityGenerator';
import { spawnAiNpcs } from '../engine/agents/spawnNpcs';
import { drawLotMarkers } from '../engine/agents/lots';
import { AI_PERSONAS } from '../engine/agents/personas';
import type { Persona } from '../engine/agents/types';
import { createAutonomyTicker } from '../engine/agents/autonomy';
import { createExpansionManager } from '../engine/world/expansion';
import type { ExpansionManager } from '../engine/world/expansion';
import { createStudio } from '../engine/agents/studio';
import { createCitizenLife } from '../engine/agents/citizens';
import { createTraffic } from '../engine/agents/traffic';
import type { Traffic } from '../engine/agents/traffic';
import type { CitizenLife } from '../engine/agents/citizens';
import { updateLod } from '../engine/world/lod';
import { createTerrain } from '../engine/world/terrain';
import type { Terrain } from '../engine/world/terrain';
import { save as saveLedger, acts as ledgerActs } from '../engine/world/ledger';
import { createHaze } from '../engine/world/haze';
import type { Haze } from '../engine/world/haze';
import type { Studio, StudioEvent, Architect, CityReport } from '../engine/agents/studio';

const VoxelCityScene: React.FC<{ 
    lightingPreset?: number, 
    fogLevel?: number, 
    architecturalStyle?: string,
    weather?: 'clear' | 'rain' | 'snow',
    autoPilot?: boolean,
    walkMode?: boolean,
    aiCommand?: AICommand | null,
    setInteractionLabel?: (label: string | null) => void,
    setIsDriving?: (isDriving: boolean) => void,
    onTalkToAgent?: (persona: Persona) => void,
    /** Journal du cabinet d'architectes (constructions, promotions, rues ouvertes) */
    onStudioEvent?: (e: StudioEvent, roster?: Architect[], report?: CityReport) => void,
    /** Télémétrie de tenue en charge (activée par ?stats=1) */
    onStats?: (s: { fps: number; draws: number; tris: number; buildings: number; acts: number; frontier: number; tiles: number }) => void
}> = ({
    lightingPreset = 0, 
    fogLevel = 1.0, 
    architecturalStyle = 'mixed',
    weather = 'clear',
    autoPilot = false,
    walkMode = false,
    aiCommand = null,
    setInteractionLabel,
    setIsDriving,
    onTalkToAgent,
    onStudioEvent,
    onStats
}) => {
    const mountRef = useRef<HTMLDivElement>(null);
    
    // Engine Refs (Init once)
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const controlsFPSRef = useRef<PointerLockControls | null>(null); // FPS Controls
    const isInitializedRef = useRef(false);
    
    // Track Walk Mode state for event listeners
    const walkModeRef = useRef(walkMode);
    useEffect(() => { walkModeRef.current = walkMode; }, [walkMode]);

    // Movement State (FPS)
    const moveState = useRef({
        forward: false,
        backward: false,
        left: false,
        right: false,
        run: false,
        jump: false
    });
    const playerVelocity = useRef(new THREE.Vector3());
    
    // Gamepad Ref - Use string keys to handle mapped actions
    const gamepadButtonStates = useRef<{ [key: string]: boolean }>({});
    
    // Scene Object Refs
    const fogRef = useRef<THREE.FogExp2 | null>(null);
    const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
    const dirLightRef = useRef<THREE.DirectionalLight | null>(null);
    const skyMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
    const starsRef = useRef<THREE.Points | null>(null);
    const sunRef = useRef<THREE.Mesh | null>(null);
    const cityGroupRef = useRef<THREE.Group | null>(null);
    const aiBuildingsRef = useRef<THREE.Group>(new THREE.Group()); // Persistent buildings added by AI
    // La ville qui s'étend + la forêt qui recule (engine/world/expansion.ts)
    const expansionRef = useRef<ExpansionManager | null>(null);
    const expansionClockRef = useRef(0);
    // Le cabinet d'architectes autonome (engine/agents/studio.ts)
    const studioRef = useRef<Studio | null>(null);
    // Les projets propres des habitants (engine/agents/autonomy.ts)
    const autonomyRef = useRef<{ start(): void; stop(): void } | null>(null);
    // Sol + forêt infinis, et brume volumétrique qui mange le lointain
    const terrainRef = useRef<Terrain | null>(null);
    // Les citoyens qui vivent leur journée (engine/agents/citizens.ts)
    const citizensRef = useRef<CitizenLife | null>(null);
    // La circulation sur le réseau réel (engine/agents/traffic.ts)
    const trafficRef = useRef<Traffic | null>(null);
    const hazeRef = useRef<Haze | null>(null);
    const terrainClockRef = useRef(0);
    const statsRef = useRef({ clock: 0, frames: 0 });
    const lodClockRef = useRef(0);
    
    // Weather System Refs
    const weatherSystemRef = useRef<THREE.Points | null>(null);
    const particlePositionsRef = useRef<Float32Array | null>(null);
    const particleVelocitiesRef = useRef<Float32Array | null>(null);

    // Animation Data Refs
    const animRef = useRef<AnimState>({
        inhabitantsList: [] as any[],
        vehiclesList: [] as any[],
        buildingsList: [] as THREE.Group[],
        trafficLightsList: [] as any[],
        fountainDropletsList: [] as THREE.Object3D[],
        fanList: [] as THREE.Group[],
        screenList: [] as THREE.Mesh[],
        airTrafficList: [] as any[], // Drones & Helicopters
        pois: [] as THREE.Vector3[],
        gA: 'x',
        tT: 0
    });
    
    // Driving & Interaction Refs
    const interactionRef = useRef<InteractionState>({ target: null, type: null });
    const vehicleRef = useRef({
        current: null as THREE.Group | null, // The car being driven
        velocity: 0,
        steering: 0
    });
    
    // Global AI Overrides Ref
    const aiOverrideRef = useRef({
        trafficMultiplier: 1.0,
        forcedNpcState: null as InhabitantState | null,
        chaosMode: false,
        distortion: 0,
        glitchIntensity: 0,
        timeScale: 1.0,
        gravity: 1.0,
        // Special Effects Flags
        fx: {
            flood: false,
            alienInvasion: false,
            kaiju: false,
            blackHole: false,
            disco: false,
            meteorShower: false,
            matrix: false,
            rapture: false,
            iceAge: false,
            lava: false
        }
    });

    // Special FX Objects Refs
    const fxRefs = useRef({
        waterPlane: null as THREE.Mesh | null,
        ufoSwarm: [] as THREE.Group[],
        kaiju: null as THREE.Group | null,
        blackHole: null as THREE.Mesh | null,
        meteors: [] as THREE.Mesh[]
    });

    // Helper: Apply Deadzone (Prevents drift)
    const applyDeadzone = (value: number, threshold: number = 0.15) => {
        if (Math.abs(value) < threshold) return 0;
        // Remap to 0-1 range starting after threshold for smooth start
        return (value - Math.sign(value) * threshold) / (1 - threshold);
    };

    // Update AI Overrides when prop changes
    useEffect(() => {
        if (aiCommand) {
            aiOverrideRef.current.forcedNpcState = aiCommand.npcState !== undefined ? aiCommand.npcState : null;
            aiOverrideRef.current.trafficMultiplier = aiCommand.trafficSpeed !== undefined ? aiCommand.trafficSpeed : 1.0;
            aiOverrideRef.current.chaosMode = !!aiCommand.globalChaos;
            
            // God Mode Reality Bending
            if (aiCommand.realityBending) {
                aiOverrideRef.current.distortion = aiCommand.realityBending.distortion;
                aiOverrideRef.current.glitchIntensity = aiCommand.realityBending.glitchIntensity;
                aiOverrideRef.current.timeScale = aiCommand.realityBending.timeScale;
                aiOverrideRef.current.gravity = aiCommand.realityBending.gravity !== undefined ? aiCommand.realityBending.gravity : 1.0;
            } else {
                aiOverrideRef.current.distortion = 0;
                aiOverrideRef.current.glitchIntensity = 0;
                aiOverrideRef.current.timeScale = 1.0;
                aiOverrideRef.current.gravity = 1.0;
            }

            // Special Effects Flags
            if (aiCommand.specialEffects) {
                aiOverrideRef.current.fx = { ...aiOverrideRef.current.fx, ...aiCommand.specialEffects };
            }

            // God Mode Operations (Execute Once)
            if (aiCommand.godOperations && aiCommand.godOperations.length > 0) {
                executeGodOperations(aiCommand.godOperations, { worldRef: expansionRef, cityGroupRef, cameraRef, controlsRef, aiBuildingsRef, animRef } satisfies GodOpsCtx);
            }

            // Summon a vehicle that drives to the player, then waits to be entered (F).
            if (aiCommand.summon) {
                summonVehicle(aiCommand.summon.type, aiCommand.summon.label, { cityGroupRef, cameraRef, animRef, walkModeRef });
            }

        } else {
            aiOverrideRef.current.forcedNpcState = null;
            aiOverrideRef.current.trafficMultiplier = 1.0;
            aiOverrideRef.current.chaosMode = false;
            aiOverrideRef.current.distortion = 0;
            aiOverrideRef.current.glitchIntensity = 0;
            aiOverrideRef.current.timeScale = 1.0;
            aiOverrideRef.current.gravity = 1.0;
        }
    }, [aiCommand]);

    const requestRef = useRef<number>(0);
    const clockRef = useRef(new THREE.Clock());

    // --- 1. INITIALIZATION (RUNS ONCE) ---
    useEffect(() => {
        if (!mountRef.current || isInitializedRef.current) return;
        isInitializedRef.current = true;

        // Scene Setup
        const scene = new THREE.Scene(); sceneRef.current = scene;
        scene.background = new THREE.Color(0x87CEEB);
        
        // Camera
        // far augmenté : la ville s'étend et la forêt/les collines sont loin
        const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 4000);
        camera.position.set(60, 60, 60);
        cameraRef.current = camera;

        // Debug/repérage : ?cam=x,y,z (&look=x,y,z) place la caméra au chargement.
        const camParam = new URLSearchParams(window.location.search).get('cam');
        const lookParam = new URLSearchParams(window.location.search).get('look');
        if (camParam) {
            const [cx, cy, cz] = camParam.split(',').map(Number);
            if ([cx, cy, cz].every((n) => Number.isFinite(n))) camera.position.set(cx, cy, cz);
        }
        
        // Renderer
        // IMPORTANT: preserveDrawingBuffer: true is required for canvas.toDataURL() to work for Gemini screenshots
        const renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            powerPreference: "high-performance",
            preserveDrawingBuffer: true 
        }); 
        renderer.setSize(window.innerWidth, window.innerHeight); 
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); 
        renderer.shadowMap.enabled = false; 
        mountRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Controls
        const controls = new OrbitControls(camera, renderer.domElement); 
        controls.enableDamping = true; 
        controls.dampingFactor = 0.05; 
        controls.maxPolarAngle = Math.PI / 2 - 0.05; 
        controls.minDistance = 10;
        controls.maxDistance = 1200; // on doit pouvoir prendre du recul sur la ville étendue
        if (lookParam) {
            const [lx, ly, lz] = lookParam.split(',').map(Number);
            if ([lx, ly, lz].every((n) => Number.isFinite(n))) { controls.target.set(lx, ly, lz); camera.lookAt(lx, ly, lz); }
        }
        controlsRef.current = controls;

        // FPS Controls
        const fpsControls = new PointerLockControls(camera, renderer.domElement);
        controlsFPSRef.current = fpsControls;

        // Monde sans bord : le sol et la forêt sont engendrés autour du joueur,
        // et la brume volumétrique dissout la frontière de génération.
        citizensRef.current = createCitizenLife(scene);
        trafficRef.current = createTraffic(scene);
        terrainRef.current = createTerrain(scene);
        terrainRef.current.update({ x: camera.position.x, z: camera.position.z });
        hazeRef.current = createHaze(scene);
        
        // Base Environment
        const initialP = presets[0];
        const fog = new THREE.FogExp2(initialP.fog, initialP.dens); scene.fog = fog; fogRef.current = fog;
        
        const ambientLight = new THREE.AmbientLight(0xffffff, initialP.amb); scene.add(ambientLight); ambientLightRef.current = ambientLight;
        const dirLight = new THREE.DirectionalLight(initialP.dirC, initialP.dir); 
        dirLight.position.set(initialP.sunPos[0], initialP.sunPos[1], initialP.sunPos[2]);
        scene.add(dirLight); dirLightRef.current = dirLight;

        // Skybox - VOXEL STYLE (BOX)
        const skyGeo = new THREE.BoxGeometry(1000, 1000, 1000);
        const skyMat = new THREE.ShaderMaterial({
            vertexShader: SKY_VERTEX_SHADER, fragmentShader: SKY_FRAGMENT_SHADER,
            uniforms: { topColor: { value: new THREE.Color(initialP.skyTop) }, bottomColor: { value: new THREE.Color(initialP.skyBottom) }, offset: { value: 33 }, exponent: { value: 0.6 } },
            side: THREE.BackSide
        });
        const skyMesh = new THREE.Mesh(skyGeo, skyMat); scene.add(skyMesh); skyMaterialRef.current = skyMat;

        // Stars
        const starGeo = new THREE.BufferGeometry(); const starCount = 2000; const starPos = new Float32Array(starCount * 3);
        for(let i=0; i<starCount*3; i++) starPos[i] = (Math.random() - 0.5) * 1000; 
        starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
        const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.8, transparent: true });
        const starMesh = new THREE.Points(starGeo, starMat); starMesh.visible = initialP.night; scene.add(starMesh); starsRef.current = starMesh;

        // Sun - VOXEL STYLE (BOX)
        const sunGeo = new THREE.BoxGeometry(15, 15, 15); const sunMat = new THREE.MeshBasicMaterial({ color: initialP.sunColor, wireframe: true });
        const sunMesh = new THREE.Mesh(sunGeo, sunMat); sunMesh.position.set(initialP.sunPos[0], initialP.sunPos[1], initialP.sunPos[2]); scene.add(sunMesh); sunRef.current = sunMesh;

        // City Group Container
        const cityGroup = new THREE.Group(); scene.add(cityGroup); cityGroupRef.current = cityGroup;
        
        // AI Persistent Group
        scene.add(aiBuildingsRef.current);

        // Weather System Container (Particles)
        const particleCount = 4000;
        const particleGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3); // x=drift, y=speed, z=drift
        
        for(let i=0; i<particleCount; i++) {
            positions[i*3] = (Math.random() - 0.5) * 200;
            positions[i*3+1] = Math.random() * 100;
            positions[i*3+2] = (Math.random() - 0.5) * 200;
            
            velocities[i*3] = (Math.random() - 0.5) * 0.1;
            velocities[i*3+1] = 0.5 + Math.random() * 0.5;
            velocities[i*3+2] = (Math.random() - 0.5) * 0.1;
        }
        
        particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const particleMat = new THREE.PointsMaterial({
            color: 0xaaaaaa,
            size: 0.5,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        
        const weatherSystem = new THREE.Points(particleGeo, particleMat);
        weatherSystem.visible = false;
        scene.add(weatherSystem);
        weatherSystemRef.current = weatherSystem;
        particlePositionsRef.current = positions;
        particleVelocitiesRef.current = velocities;

        // Raycaster Setup
        const raycaster = new THREE.Raycaster(); const m = new THREE.Vector2();
        const hMD = (e: MouseEvent) => {
            // CRITICAL CHANGE: If walkMode is true and not locked, request lock on click
            if (walkModeRef.current && controlsFPSRef.current && !controlsFPSRef.current.isLocked) {
                controlsFPSRef.current.lock();
                return; // Stop processing to avoid Raycast triggering immediately on the same click
            }

            if(e.button !== 0 || !cameraRef.current || !cityGroupRef.current) return;
            // Only raycast in Orbit mode
            if (controlsFPSRef.current && controlsFPSRef.current.isLocked) return;

            const r = renderer.domElement.getBoundingClientRect();
            m.x = ((e.clientX - r.left) / r.width) * 2 - 1;
            m.y = -((e.clientY - r.top) / r.height) * 2 + 1;
            raycaster.setFromCamera(m, cameraRef.current);
            const i = raycaster.intersectObjects(cityGroupRef.current.children, true);
            if(i.length > 0){
                let t = i[0].object;
                while(t.parent && t.parent !== cityGroupRef.current) t = t.parent;
                if(t.userData.isBuilding){
                    const b = t as THREE.Group;
                    const x = !b.userData.expanded;
                    animRef.current.buildingsList.forEach(o => { if(o !== b) o.userData.expanded = false; });
                    b.userData.expanded = x;
                }
            }
        };
        const hRC = (e: MouseEvent) => { e.preventDefault(); animRef.current.buildingsList.forEach(b => b.userData.expanded = false); };
        
        // --- FPS MOVEMENT LISTENERS ---
        const handleInteraction = () => {
             // SHARED LOGIC FOR KEYBOARD 'F' AND GAMEPAD 'X'
             if (vehicleRef.current.current) {
                // EXIT VEHICLE
                if (setIsDriving) setIsDriving(false);
                if (cameraRef.current) {
                     const exitPos = vehicleRef.current.current.position.clone();
                     exitPos.y += 2;
                     exitPos.x += 2;
                     cameraRef.current.position.copy(exitPos);
                }
                vehicleRef.current.current = null;
                vehicleRef.current.velocity = 0;
            } else if (interactionRef.current.target) {
                const target = interactionRef.current.target;
                if (interactionRef.current.type === 'vehicle') {
                    // ENTER VEHICLE
                    vehicleRef.current.current = target as THREE.Group;
                    if (setIsDriving) setIsDriving(true);
                    target.userData.lane = null; 
                } else if (interactionRef.current.type === 'building') {
                    // VISIT INTERIOR
                    const building = target as THREE.Group;
                    const floors = building.children.filter(c => c.userData.originalY !== undefined);
                    if (floors.length > 0) {
                        const floor = floors[Math.floor(Math.random() * (floors.length - 1))];
                        if (floor) {
                            const interiorPos = building.position.clone().add(new THREE.Vector3(0, floor.position.y + 1.7, 0));
                            if (cameraRef.current) cameraRef.current.position.copy(interiorPos);
                        }
                    }
                } else if (interactionRef.current.type === 'agent') {
                    // TALK TO AI NPC
                    const persona = target.userData.persona as Persona | undefined;
                    if (persona && onTalkToAgent) {
                        controlsFPSRef.current?.unlock();
                        onTalkToAgent(persona);
                    }
                }
            }
        };

        const onKeyDown = (event: KeyboardEvent) => {
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW':
                case 'KeyZ': // Z for AZERTY
                    moveState.current.forward = true;
                    break;
                case 'ArrowLeft':
                case 'KeyA':
                case 'KeyQ': // Q for AZERTY
                    moveState.current.left = true;
                    break;
                case 'ArrowDown':
                case 'KeyS':
                    moveState.current.backward = true;
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    moveState.current.right = true;
                    break;
                case 'ShiftLeft':
                case 'ShiftRight':
                    moveState.current.run = true;
                    break;
                case 'Space':
                    if (vehicleRef.current.current) {
                        // Handbrake or nothing for car
                    } else if (cameraRef.current && cameraRef.current.position.y < 3.0) { // On ground check
                         playerVelocity.current.y += 15;
                         moveState.current.jump = true;
                    }
                    break;
                case 'KeyF':
                    handleInteraction();
                    break;
            }
        };

        const onKeyUp = (event: KeyboardEvent) => {
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW':
                case 'KeyZ':
                    moveState.current.forward = false;
                    break;
                case 'ArrowLeft':
                case 'KeyA':
                case 'KeyQ':
                    moveState.current.left = false;
                    break;
                case 'ArrowDown':
                case 'KeyS':
                    moveState.current.backward = false;
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    moveState.current.right = false;
                    break;
                case 'ShiftLeft':
                case 'ShiftRight':
                    moveState.current.run = false;
                    break;
            }
        };

        document.addEventListener( 'keydown', onKeyDown );
        document.addEventListener( 'keyup', onKeyUp );
        
        renderer.domElement.addEventListener('mousedown', hMD);
        renderer.domElement.addEventListener('contextmenu', hRC);

        const hR = () => {
            if (!cameraRef.current || !rendererRef.current) return;
            cameraRef.current.aspect = window.innerWidth / window.innerHeight;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(window.innerWidth, window.innerHeight);
            rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        };
        window.addEventListener('resize', hR);
        // le registre de la ville est écrit avant de quitter la page :
        // rien de ce qui a été construit ne doit disparaître
        const flush = () => saveLedger();
        window.addEventListener('pagehide', flush);
        window.addEventListener('beforeunload', flush);

        // Animation Loop
        const fr = new THREE.Frustum(); const pm = new THREE.Matrix4(); const v3 = new THREE.Vector3();

        const animate = () => {
            requestRef.current = requestAnimationFrame(animate);
            if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;

            // AI God Mode Parameters
            const distortion = aiOverrideRef.current.distortion;
            const glitchIntensity = aiOverrideRef.current.glitchIntensity;
            const timeScale = aiOverrideRef.current.timeScale;
            const gravity = aiOverrideRef.current.gravity;
            const trafficMult = aiOverrideRef.current.trafficMultiplier * timeScale; // Scale traffic by time too
            const forcedState = aiOverrideRef.current.forcedNpcState;
            const chaosMode = aiOverrideRef.current.chaosMode;
            const fx = aiOverrideRef.current.fx;

            // Update Time
            const d = clockRef.current.getDelta() * timeScale;
            const time = clockRef.current.getElapsedTime() * timeScale;

            // --- LA VIE : domicile → travail → commerces → parc → domicile ---
            if (citizensRef.current) {
                const p = walkModeRef.current || vehicleRef.current.current
                    ? cameraRef.current.position
                    : (controlsRef.current ? controlsRef.current.target : cameraRef.current.position);
                citizensRef.current.update(d, time, p as THREE.Vector3);
                trafficRef.current?.update(d, p as THREE.Vector3);
            }

            // --- NIVEAU DE DÉTAIL : au loin, les bâtiments deviennent silhouettes ---
            lodClockRef.current += d;
            if (lodClockRef.current > 0.5) {
                lodClockRef.current = 0;
                updateLod(animRef.current.buildingsList, cameraRef.current, 130);
            }

            // --- SOL / FORÊT INFINIS + BRUME (le lointain ne doit jamais finir) ---
            hazeRef.current?.update(cameraRef.current, time);
            terrainClockRef.current += d;
            if (terrainClockRef.current > 0.6 && terrainRef.current) {
                terrainClockRef.current = 0;
                const p = walkModeRef.current || vehicleRef.current.current
                    ? cameraRef.current.position
                    : (controlsRef.current ? controlsRef.current.target : cameraRef.current.position);
                terrainRef.current.update({ x: p.x, z: p.z });
            }

            // --- LA VILLE S'ÉTEND DEVANT LE JOUEUR (1 test/s, coût négligeable) ---
            expansionClockRef.current += d;
            if (expansionClockRef.current > 1 && expansionRef.current) {
                expansionClockRef.current = 0;
                // en marche/conduite on suit le joueur, en orbite on suit le point observé
                const focus = walkModeRef.current || vehicleRef.current.current
                    ? cameraRef.current.position
                    : (controlsRef.current ? controlsRef.current.target : cameraRef.current.position);
                expansionRef.current.update(focus as THREE.Vector3);
            }

            // --- GAMEPAD POLLING ---
            const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
            const gp = gamepads[0]; // Assume first gamepad
            
            // Unified Input Vectors (Combinig Keyboard & Gamepad)
            let inputForward = 0; // -1 to 1 (Forward is +)
            let inputRight = 0;   // -1 to 1 (Right is +)
            
            // 1. Add Keyboard Input
            if (moveState.current.forward) inputForward += 1;
            if (moveState.current.backward) inputForward -= 1;
            if (moveState.current.right) inputRight += 1;
            if (moveState.current.left) inputRight -= 1;

            // 2. Add Gamepad Input (If connected)
            if (gp) {
                // --- GAMEPAD MAPPING (Universal) ---
                // Axis 1 (Left Stick Y): Up is -1, Down is 1. We want Up to be Forward (+). So invert.
                const rawForward = -gp.axes[1];
                inputForward += applyDeadzone(rawForward);

                // Axis 0 (Left Stick X): Left is -1, Right is 1.
                const rawRight = gp.axes[0];
                inputRight += applyDeadzone(rawRight);

                // Buttons
                moveState.current.run = gp.buttons[10].pressed || gp.buttons[7].pressed || moveState.current.run; // Stick click or Trigger

                // --- UNIVERSAL MAPPING: PERMISSIVE BUTTONS ---
                
                // JUMP: Allow Button 0 (A/Cross) OR Button 1 (B/Circle)
                // This covers users who say "B is jumping" (maybe their controller swaps A/B or they prefer it)
                const isJumpPressed = gp.buttons[0].pressed || gp.buttons[1].pressed;
                
                if (isJumpPressed && !gamepadButtonStates.current['jump']) {
                     // If NOT Driving
                     if (!vehicleRef.current.current) {
                         if (cameraRef.current.position.y < 3.0) {
                             playerVelocity.current.y += 15;
                             moveState.current.jump = true;
                         }
                     }
                     gamepadButtonStates.current['jump'] = true;
                } else if (!isJumpPressed) {
                    gamepadButtonStates.current['jump'] = false;
                }

                // INTERACT: Allow Button 2 (X/Square) OR Button 3 (Y/Triangle)
                const isInteractPressed = gp.buttons[2].pressed || gp.buttons[3].pressed;
                if (isInteractPressed && !gamepadButtonStates.current['interact']) {
                    handleInteraction();
                    gamepadButtonStates.current['interact'] = true;
                } else if (!isInteractPressed) {
                    gamepadButtonStates.current['interact'] = false;
                }
                
                // EXIT VEHICLE: Button 1 (B/Circle) or 3 (Y/Triangle) - Specific check if driving
                const isExitPressed = gp.buttons[1].pressed || gp.buttons[3].pressed;
                if (vehicleRef.current.current && isExitPressed && !gamepadButtonStates.current['exit']) {
                     if (setIsDriving) setIsDriving(false);
                     if (cameraRef.current) {
                          const exitPos = vehicleRef.current.current.position.clone();
                          exitPos.y += 2;
                          exitPos.x += 2;
                          cameraRef.current.position.copy(exitPos);
                     }
                     vehicleRef.current.current = null;
                     vehicleRef.current.velocity = 0;
                     gamepadButtonStates.current['exit'] = true;
                } else if (!isExitPressed) {
                    gamepadButtonStates.current['exit'] = false;
                }
            }

            // Normalize Input Vector to prevent diagonal speed boost
            const inputLen = Math.sqrt(inputForward**2 + inputRight**2);
            if (inputLen > 1) {
                inputForward /= inputLen;
                inputRight /= inputLen;
            }


            // --- INTERACTION RAYCASTING (Center Screen) ---
            if (controlsFPSRef.current && controlsFPSRef.current.isLocked && !vehicleRef.current.current) {
                raycaster.setFromCamera(new THREE.Vector2(0, 0), cameraRef.current);
                const intersects = raycaster.intersectObjects(cityGroupRef.current?.children || [], true);
                
                let foundInteractable = false;
                
                for (let i = 0; i < intersects.length; i++) {
                    if (intersects[i].distance > 10) break; // Max interaction distance

                    let obj = intersects[i].object;
                    // Traverse up to find group with userdata
                    while(obj.parent && obj.parent !== cityGroupRef.current) obj = obj.parent;
                    
                    if (obj.userData.type === 'vehicle' || obj.userData.isAircraft) {
                        interactionRef.current.target = obj;
                        interactionRef.current.type = 'vehicle';
                        if (setInteractionLabel) setInteractionLabel(obj.userData.type === 'helicopter' ? "PILOTER" : "CONDUIRE");
                        foundInteractable = true;
                        break;
                    } else if (obj.userData.isBuilding) {
                        interactionRef.current.target = obj;
                        interactionRef.current.type = 'building';
                        if (setInteractionLabel) setInteractionLabel("VISITER");
                        foundInteractable = true;
                        break;
                    } else if (obj.userData.type === 'ai-agent') {
                        interactionRef.current.target = obj;
                        interactionRef.current.type = 'agent';
                        if (setInteractionLabel) setInteractionLabel("PARLER");
                        foundInteractable = true;
                        break;
                    }
                }

                if (!foundInteractable) {
                    interactionRef.current.target = null;
                    interactionRef.current.type = null;
                    if (setInteractionLabel) setInteractionLabel(null);
                }
            }
            
            // --- VEHICLE DRIVING PHYSICS ---
            if (vehicleRef.current.current) {
                const car = vehicleRef.current.current;
                
                // Acceleration Logic: Combine Left Stick and Triggers
                let accel = inputForward; // Default from Left Stick

                if (gp) {
                    // Modern Racing Controls: Triggers
                    const gas = gp.buttons[7].value; // RT / R2
                    const brake = gp.buttons[6].value; // LT / L2
                    
                    if (gas > 0.1) accel = gas; // Gas overrides stick if pressed
                    else if (brake > 0.1) accel = -brake; // Brake/Reverse
                }

                if (accel > 0) vehicleRef.current.velocity += 30 * d * accel;
                if (accel < 0) vehicleRef.current.velocity += 20 * d * accel;
                
                // Friction
                vehicleRef.current.velocity *= 0.95;
                
                // Steering
                // Right Input (+1) -> Turn Right (Rotate -Y). Left Input (-1) -> Turn Left (Rotate +Y).
                // So steering rotation should be -= inputRight.
                let steer = -inputRight;
                
                if (Math.abs(vehicleRef.current.velocity) > 0.1) {
                    const steerFactor = d * 2.0;
                    // Smoothing steering
                    vehicleRef.current.steering += (steer - vehicleRef.current.steering) * 5.0 * d;
                    
                    car.rotation.y += vehicleRef.current.steering * steerFactor;
                    
                    // Bank angle for aircraft
                    if (car.userData.isAircraft) {
                        car.rotation.z = vehicleRef.current.steering * 0.5;
                        // Aircraft altitude control
                         if (moveState.current.run) car.position.y += 15 * d; // Shift to go up
                         if (moveState.current.jump) car.position.y -= 15 * d; // Space/A to go down
                    }
                } else {
                    vehicleRef.current.steering *= 0.9;
                }

                // Move
                const speed = vehicleRef.current.velocity * d;
                car.translateZ(speed); // Local Z movement

                // Camera Chase
                const relativeOffset = new THREE.Vector3(0, 5, -10); // Behind and up
                const cameraOffset = relativeOffset.applyMatrix4(car.matrixWorld);
                
                // Smooth follow
                cameraRef.current.position.lerp(cameraOffset, 0.1);
                cameraRef.current.lookAt(car.position);

            }
            
            // --- CAMERA CONTROLS UPDATE (FPS) ---
            else if (controlsFPSRef.current && controlsFPSRef.current.isLocked) {
                // Look (Right Stick)
                if (gp) {
                    const lookSpeed = 2.0 * d;
                    // Axis 2 (Right Stick X): Left/Right Look.
                    // Axis 3 (Right Stick Y): Up/Down Look. 
                    
                    const lookX = applyDeadzone(gp.axes[2]);
                    const lookY = applyDeadzone(gp.axes[3]);

                    if (Math.abs(lookX) > 0) {
                        // Yaw (Rotate Left/Right around Y axis)
                        cameraRef.current.rotation.y -= lookX * lookSpeed;
                    }
                    if (Math.abs(lookY) > 0) {
                        // FIX: INVERTED CAMERA LOGIC
                        // Standard FPS: Stick Up (Negative Value) -> Look Up (Rotate X +)
                        // Formula: rotation.x -= lookY. 
                        // If lookY is -1 (UP), -= -1 means += 1 (Look Up). Correct.
                        cameraRef.current.rotation.x -= lookY * lookSpeed;
                        
                        // Clamp
                        cameraRef.current.rotation.x = Math.max( - Math.PI / 2, Math.min( Math.PI / 2, cameraRef.current.rotation.x ) );
                    }
                }

                // FPS Movement
                const velocity = playerVelocity.current;

                // Friction / Deceleration
                velocity.x -= velocity.x * 10.0 * d;
                velocity.z -= velocity.z * 10.0 * d;
                
                // Gravity
                velocity.y -= 9.8 * 5.0 * d; // Strong gravity

                const speed = moveState.current.run ? 150.0 : 60.0; // Run vs Walk

                // Apply Input to Velocity
                if (inputForward !== 0) velocity.z -= inputForward * speed * d;
                if (inputRight !== 0) velocity.x -= inputRight * speed * d;

                // Move
                controlsFPSRef.current.moveRight( - velocity.x * d );
                controlsFPSRef.current.moveForward( - velocity.z * d );
                
                // Y Position / Jump / Floor Collision
                cameraRef.current.position.y += velocity.y * d;

                // Simple Floor Collision at y = 1.7 (Head height)
                const floorHeight = 1.7;
                if ( cameraRef.current.position.y < floorHeight ) {
                    velocity.y = 0;
                    cameraRef.current.position.y = floorHeight;
                    moveState.current.jump = false;
                }
            }
            else if (controlsRef.current) {
                // Orbit Update
                if (controlsRef.current.enabled) {
                    controlsRef.current.update();
                } else {
                    // Auto Pilot Mode (Orbiting)
                    if (!controlsFPSRef.current?.isLocked && !vehicleRef.current.current) { // Only if not in FPS/Driving
                        const radius = 60 + Math.sin(time * 0.1) * 20;
                        const camX = Math.sin(time * 0.15) * radius;
                        const camZ = Math.cos(time * 0.15) * radius;
                        const camY = 40 + Math.sin(time * 0.2) * 20;
                        cameraRef.current.position.set(camX, camY, camZ);
                        cameraRef.current.lookAt(0, 0, 0);
                    }
                }
            }

            // --- SPECIAL FX MANAGEMENT ---
            
            // 1. Flood / Tsunami
            if (fx.flood) {
                if (!fxRefs.current.waterPlane) {
                    const wGeo = new THREE.PlaneGeometry(1000, 1000);
                    const wMat = new THREE.MeshBasicMaterial({ color: 0x004488, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
                    const plane = new THREE.Mesh(wGeo, wMat);
                    plane.rotation.x = -Math.PI/2;
                    plane.position.y = -5;
                    sceneRef.current.add(plane);
                    fxRefs.current.waterPlane = plane;
                }
                // Rise water
                if (fxRefs.current.waterPlane.position.y < 15) {
                    fxRefs.current.waterPlane.position.y += 0.5 * d;
                }
            } else if (fxRefs.current.waterPlane) {
                // Drain water
                fxRefs.current.waterPlane.position.y -= 1.0 * d;
                if (fxRefs.current.waterPlane.position.y < -10) {
                    sceneRef.current.remove(fxRefs.current.waterPlane);
                    fxRefs.current.waterPlane = null;
                }
            }

            // 2. Black Hole
            if (fx.blackHole) {
                if (!fxRefs.current.blackHole) {
                    // VOXEL STYLE: Black Hole is a CUBE
                    const bhGeo = new THREE.BoxGeometry(10, 10, 10);
                    const bhMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
                    const bh = new THREE.Mesh(bhGeo, bhMat);
                    bh.position.set(0, 20, 0);
                    
                    // Accretion Disk (Square ring)
                    const adGeo = new THREE.RingGeometry(8, 20, 4); // 4 segments = Square
                    const adMat = new THREE.MeshBasicMaterial({ color: 0xff4400, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
                    const ad = new THREE.Mesh(adGeo, adMat);
                    ad.rotation.x = Math.PI/2;
                    bh.add(ad);
                    
                    sceneRef.current.add(bh);
                    fxRefs.current.blackHole = bh;
                }
                // Suck everything in
                animRef.current.vehiclesList.forEach(v => {
                    const dir = new THREE.Vector3().subVectors(fxRefs.current.blackHole!.position, v.position).normalize();
                    v.position.addScaledVector(dir, 10 * d);
                    v.scale.multiplyScalar(0.99);
                });
                animRef.current.inhabitantsList.forEach(v => {
                    const dir = new THREE.Vector3().subVectors(fxRefs.current.blackHole!.position, v.position).normalize();
                    v.position.addScaledVector(dir, 5 * d);
                });
            } else if (fxRefs.current.blackHole) {
                sceneRef.current.remove(fxRefs.current.blackHole);
                fxRefs.current.blackHole = null;
            }

            // 3. Disco Mode
            if (fx.disco) {
                const hue = (time * 0.5) % 1;
                const color = new THREE.Color().setHSL(hue, 1, 0.5);
                sceneRef.current.background = color;
                if (dirLightRef.current) dirLightRef.current.color = color;
            }


            // --- GOD MODE: DISTORTION & GLITCH ---
            // If distortion is active, wobble the city group
            if (cityGroupRef.current) {
                if (Math.abs(distortion) > 0.01) {
                    // Wobbly Earthquake / Melting effect
                    cityGroupRef.current.rotation.y = Math.sin(time * 2) * 0.02 * distortion;
                    cityGroupRef.current.position.y = Math.sin(time * 5) * 0.5 * distortion;
                    // Scale craziness (breathing city)
                    const s = 1 + Math.sin(time * 3) * 0.1 * distortion;
                    cityGroupRef.current.scale.set(s, 1 + Math.cos(time*3)*0.1*distortion, s);
                } else {
                    cityGroupRef.current.rotation.y = 0;
                    cityGroupRef.current.position.y = 0;
                    cityGroupRef.current.scale.set(1, 1, 1);
                }
            }
            
            // Weather Animation
            if (weatherSystemRef.current && weatherSystemRef.current.visible && particlePositionsRef.current && particleVelocitiesRef.current) {
                const positions = particlePositionsRef.current;
                const velocities = particleVelocitiesRef.current;
                for(let i=0; i<particleCount; i++) {
                    positions[i*3+1] -= velocities[i*3+1] * timeScale;
                    positions[i*3] -= velocities[i*3] * timeScale;
                    positions[i*3+2] -= velocities[i*3+2] * timeScale;
                    if (positions[i*3+1] < 0) {
                        positions[i*3+1] = 100;
                        positions[i*3] = (Math.random() - 0.5) * 200;
                        positions[i*3+2] = (Math.random() - 0.5) * 200;
                    }
                }
                weatherSystemRef.current.geometry.attributes.position.needsUpdate = true;
            }
            
            // Frustum Culling
            pm.multiplyMatrices(cameraRef.current.projectionMatrix, cameraRef.current.matrixWorldInverse);
            fr.setFromProjectionMatrix(pm);

            if(sunRef.current) sunRef.current.rotation.y += d * 0.05; 
            if(sunRef.current) sunRef.current.rotation.z += d * 0.02; 
            if(starsRef.current) starsRef.current.rotation.y -= d * 0.01;
            
            // Traffic Lights
            animRef.current.tT += d * trafficMult; 
            if(animRef.current.tT > 8){ animRef.current.tT = 0; animRef.current.gA = animRef.current.gA === 'x' ? 'z' : 'x'; }
            
            animRef.current.trafficLightsList.forEach(tl => {
                const g = tl.group.userData.controlAxis === animRef.current.gA;
                if (chaosMode || glitchIntensity > 0.5) {
                     // Chaos mode or high glitch: flickering traffic lights
                     const flicker = Math.random() > 0.5;
                     tl.signals.red.material.opacity = flicker ? 1 : 0.1;
                     tl.signals.yellow.material.opacity = flicker ? 0.1 : 1;
                     tl.signals.green.material.opacity = flicker ? 1 : 0.1;
                } else {
                    tl.signals.red.material.opacity = g ? 0.1 : 1;
                    tl.signals.yellow.material.opacity = 0.1;
                    tl.signals.green.material.opacity = g ? 1 : 0.1;
                }
            });

            // Animated Objects
            animRef.current.fanList.forEach(blades => { blades.rotation.y += 5 * d; });
            animRef.current.screenList.forEach((screen, i) => {
                 const flicker = Math.sin(time * 10 + i) * 0.5 + 0.5;
                 const mat = screen.material as THREE.MeshBasicMaterial;
                 if (chaosMode || glitchIntensity > 0.2) {
                     // Chaos mode / Glitch: Random colors
                     if (Math.random() > (1.0 - glitchIntensity)) mat.color.setHex(Math.random() * 0xffffff);
                 } else {
                     if (i % 2 === 0) mat.color.setHSL((time * 0.1 + i) % 1, 0.8, 0.5 + flicker * 0.2);
                     else mat.color.setHSL(0.3 + (flicker * 0.1), 0.8, 0.4 + flicker * 0.4);
                 }
            });

            // AIRCRAFT (Drones & Helicopters)
            animRef.current.airTrafficList.forEach((ac, i) => {
                // If being driven, skip AI movement
                if (vehicleRef.current.current === ac) {
                     const type = ac.userData.type;
                     // Only animate rotors
                     if (type === 'drone') {
                        ac.userData.rotors.forEach((r: THREE.Group) => r.rotation.y += 30 * d);
                     } else if (type === 'helicopter') {
                        ac.userData.rotors[0].rotation.y += 30 * d;
                        ac.userData.rotors[1].rotation.x += 30 * d;
                     }
                     return;
                }

                const type = ac.userData.type;
                const speed = ac.userData.speed * d * timeScale;

                // Propeller Animation
                if (type === 'drone') {
                    ac.userData.rotors.forEach((r: THREE.Group) => r.rotation.y += 15 * d * timeScale);
                    // Movement: Patrol Logic (Sine wave patrol)
                    const offset = i * 10;
                    ac.position.x += Math.sin(time * 0.5 + offset) * speed;
                    ac.position.z += Math.cos(time * 0.3 + offset) * speed;
                    // Hover Bob
                    ac.position.y += Math.sin(time * 2 + offset) * 0.02;
                    // Banking
                    ac.rotation.z = -Math.sin(time * 0.5 + offset) * 0.2;
                    ac.rotation.x = Math.cos(time * 0.3 + offset) * 0.2;
                } else if (type === 'helicopter') {
                    // Main Rotor
                    ac.userData.rotors[0].rotation.y += 20 * d * timeScale;
                    // Tail Rotor
                    ac.userData.rotors[1].rotation.x += 20 * d * timeScale;
                    
                    // Movement: Big Circle
                    const r = 60 + i * 10;
                    const angle = time * 0.1 + i;
                    ac.position.x = Math.sin(angle) * r;
                    ac.position.z = Math.cos(angle) * r;
                    ac.rotation.y = -angle; // Face forward
                    // Banking into turn
                    ac.rotation.z = -0.3; // Bank left
                }
            });

            // Vehicles
            animRef.current.vehiclesList.forEach((v, i) => {
                // Skip deleted vehicles
                if (!v.visible) return;
                
                // SKIP IF BEING DRIVEN
                if (vehicleRef.current.current === v) return;

                // --- GOD MODE GRAVITY & LEVITATION ---
                // If gravity is modified (e.g. 0.0 or -1.0)
                if (gravity !== 1.0) {
                     // Float up or down
                     const levitation = Math.sin(time * 2 + i) * 0.05;
                     if (gravity < 0.5) {
                         v.position.y += (20 - v.position.y) * 0.05; // Float to height 20
                     } else {
                         // Default height logic
                         v.position.y = 0.1; 
                     }
                     v.position.y += levitation;
                } else if (v.position.y > 0.15) {
                    // Fall back down if gravity restored
                    v.position.y += (0.1 - v.position.y) * 0.1;
                }

                // --- SUMMONED VEHICLE: drive to the player, then wait to be entered (F) ---
                if (v.userData.summonTarget) {
                    const target = v.userData.summonTarget as THREE.Vector3;
                    const dx = target.x - v.position.x;
                    const dz = target.z - v.position.z;
                    const dist = Math.sqrt(dx * dx + dz * dz);
                    if (dist < 0.6) {
                        v.userData.summonTarget = null;
                        v.userData.speed = 0;
                    } else {
                        // Headlights (local -Z) face the player.
                        const desiredYaw = Math.atan2(-dx, -dz);
                        let dyaw = desiredYaw - v.rotation.y;
                        dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw)); // wrap to [-PI, PI]
                        v.rotation.y += dyaw * Math.min(1, 6 * d);
                        const maxSpeed = v.userData.maxSpeed || 14;
                        const approach = Math.min(maxSpeed, maxSpeed * Math.min(1, dist / 8));
                        v.userData.speed = approach;
                        const step = approach * d;
                        v.position.x += (dx / dist) * step;
                        v.position.z += (dz / dist) * step;
                    }
                    if (gravity === 1.0) v.position.y = 0.1;
                    return;
                }

                let currentSpeed = v.userData.speed;
                
                // Chaos mode: Ignore lanes sometimes or extreme speeds
                if (chaosMode && Math.random() > 0.95) {
                    v.userData.speed = Math.random() * 30; // Sudden burst
                }

                if(v.userData.lane && v.userData.lane.type === 'stem') {
                    const l = v.userData.lane; const mv = currentSpeed * d * trafficMult;
                    v.position.z += mv * l.dir * -1;
                    if (l.dir === 1 && v.position.z < l.limitZMax) { if (v.position.z < l.limitZMin + 5) v.position.z = l.limitZMax; } 
                    else if (l.dir === -1 && v.position.z > l.limitZMin) { if (v.position.z > l.limitZMax - 5) v.position.z = l.limitZMin; }
                    return;
                }
                // --- VOIE DE QUARTIER : va-et-vient le long de la rue du quartier
                if (v.userData.districtLane) {
                    const l = v.userData.districtLane;
                    const dx = l.bx - l.ax, dz = l.bz - l.az;
                    const len = Math.hypot(dx, dz) || 1;
                    const ux = dx / len, uz = dz / len;
                    const mv = (v.userData.speed || 5) * d * trafficMult * l.dir;
                    v.position.x += ux * mv;
                    v.position.z += uz * mv;
                    // projection sur le segment : demi-tour aux extrémités
                    const t = (v.position.x - l.ax) * ux + (v.position.z - l.az) * uz;
                    if (t < 6 || t > len - 6) {
                        l.dir *= -1;
                        v.rotation.y = l.angle + (l.dir === 1 ? 0 : Math.PI);
                    }
                    if (gravity === 1.0) v.position.y = 0.1;
                    return;
                }

                // If God Mode removed lane logic, don't move along lanes
                if (!v.userData.lane) return;

                const l = v.userData.lane; const p = l.axis === 'x' ? v.position.x : v.position.z; let ts = v.userData.maxSpeed; let md = 100;
                const startIdx = Math.max(0, i - 5); const endIdx = Math.min(animRef.current.vehiclesList.length, i + 5);
                for (let oi = startIdx; oi < endIdx; oi++) {
                     if (i !== oi && animRef.current.vehiclesList[oi].visible && animRef.current.vehiclesList[oi].userData.lane === l) {
                        const op = l.axis === 'x' ? animRef.current.vehiclesList[oi].position.x : animRef.current.vehiclesList[oi].position.z;
                        const dist = (op - p) * l.dir;
                        if(dist > 0 && dist < md) { md = dist; if(md < 3) break; }
                     }
                }
                if(md < 7 && !chaosMode){ ts = 0; currentSpeed = 0; } else if(md < 20 && !chaosMode){ ts *= Math.pow((md - 7) / 13, 0.5); }
                const ir = animRef.current.gA !== l.axis;
                if(ir && !chaosMode){
                    const ss = l.axis === 'x' ? l.stopX : l.stopZ;
                    if(ss){ let ds = 1000; for(let s of ss){ const dst = (s - p) * l.dir; if(dst > 0 && dst < ds) ds = dst; } if(ds < 3){ ts = 0; currentSpeed = 0; } else if(ds < 20) ts *= (ds - 3) / 17; }
                }
                
                v.userData.speed += (ts - v.userData.speed) * 8 * d; if(v.userData.speed < 0) v.userData.speed = 0;
                
                // Apply Global Multiplier
                const mv = v.userData.speed * d * trafficMult; 
                const lim = 150;
                if(l.axis === 'x'){ v.position.x += mv * l.dir; if(Math.abs(v.position.x) > lim) v.position.x = -lim * l.dir; }
                else{ v.position.z += mv * l.dir; if(Math.abs(v.position.z) > lim) v.position.z = -lim * l.dir; }
            });

            // Inhabitants
            animRef.current.inhabitantsList.forEach((h) => {
                // Skip deleted inhabitants
                if (!h.visible) return;

                // --- GOD MODE GRAVITY FOR PEOPLE ---
                if (gravity !== 1.0) {
                     if (gravity < 0.5) {
                         // Floaty people
                         h.position.y += (5 + Math.random()*5 - h.position.y) * 0.05; 
                     }
                } else if (h.position.y > 1.0) {
                     // Check if not inside a building (which usually have high y)
                     // Simple heuristic: if y > 3, probably inside
                     if (h.position.y < 3) h.position.y += (0.2 - h.position.y) * 0.1;
                }

                h.getWorldPosition(v3);
                if (!fr.containsPoint(v3)) return; 

                // Resolve effective state (AI Override vs Local State)
                let state = h.userData.state;
                
                // Allow resident state logic to persist unless forced by AI to Panic/Dance
                if (forcedState !== null) {
                    if (forcedState === InhabitantState.PANIC || forcedState === InhabitantState.DANCING) {
                         state = forcedState;
                    }
                }

                // Glitch effect on inhabitants
                if (glitchIntensity > 0.1 && Math.random() < glitchIntensity * 0.1) {
                    h.position.y += (Math.random() - 0.5); // Glitch jump
                    if (Math.random() > 0.5) h.position.y = 0.2; // Reset
                }

                const breatheSpeed = (state === InhabitantState.SLEEPING) ? 2 : 5;
                const breatheAmp = (state === InhabitantState.SLEEPING) ? 0.05 : 0.02;
                const breathe = 1 + Math.sin(time * breatheSpeed + h.userData.offset) * breatheAmp;

                if (h.userData.parts && h.userData.parts.torso) h.userData.parts.torso.scale.set(1, breathe, 1);
                else h.scale.setScalar((h.userData.baseScale || 0.55) * breathe);

                // --- 0. AI CONTROLLED STATES ---
                if (state === InhabitantState.PANIC) {
                    // Panic: Run fast, random directions, arms up
                    if (h.userData.parts) {
                        // Arms Up
                        h.userData.parts.leftArm.rotation.x = Math.PI;
                        h.userData.parts.rightArm.rotation.x = Math.PI;
                    }
                    const speed = 5.0 * d; // Fast running
                    // Jitter direction frequently
                    if (Math.random() > 0.95) {
                        const angle = (Math.random() - 0.5) * Math.PI;
                        h.userData.direction.applyAxisAngle(new THREE.Vector3(0,1,0), angle);
                        h.rotation.y += angle;
                    }
                    h.position.addScaledVector(h.userData.direction, speed);
                    
                    // Simple boundary check to keep them somewhat near
                    if (h.position.length() > 60) h.userData.direction.negate();

                    // Fast leg anim
                    const w = Math.sin(time * 20);
                    if (h.userData.parts) {
                        h.userData.parts.leftLeg.rotation.x = w * 1.0; h.userData.parts.rightLeg.rotation.x = -w * 1.0;
                    }
                    return;
                }

                if (state === InhabitantState.DANCING) {
                    // Dance: Jump up and down, spin
                    const jump = Math.abs(Math.sin(time * 10)) * 0.5;
                    h.position.y = 0.2 + jump;
                    h.rotation.y += 5 * d; // Spin
                    
                    if (h.userData.parts) {
                         h.userData.parts.leftArm.rotation.x = Math.PI - Math.sin(time * 10);
                         h.userData.parts.rightArm.rotation.x = Math.PI - Math.cos(time * 10);
                    }
                    return;
                }

                // --- 1. SOCIAL INTERACTION (Talking) ---
                if (state === InhabitantState.TALKING) {
                    if (h.userData.timer && time > h.userData.timer) {
                        h.userData.state = InhabitantState.WALKING;
                        h.userData.timer = null;
                        // Turn slightly to walk away smoothly
                        const turnAngle = Math.PI * (0.5 + Math.random());
                        h.userData.direction.applyAxisAngle(new THREE.Vector3(0,1,0), turnAngle);
                        h.rotation.y += turnAngle;
                    } else {
                        // Animation: Bobbing & Gestures
                        const gesture = Math.sin(time * 15 + h.userData.offset) * 0.05;
                        if(h.userData.parts) {
                             h.userData.parts.torso.rotation.y = gesture;
                             if(h.userData.parts.head) h.userData.parts.head.rotation.y = -gesture * 1.5;
                             if(h.userData.parts.rightArm && Math.random() > 0.96) {
                                h.userData.parts.rightArm.rotation.x = -Math.PI/2 - 0.5 + (Math.random()-0.5);
                             }
                        }
                    }
                    return;
                }

                // --- 2. ENVIRONMENTAL INTERACTION (Sightseeing) ---
                if (state === InhabitantState.SIGHTSEEING) {
                    if (h.userData.timer && time > h.userData.timer) {
                         h.userData.state = InhabitantState.WALKING;
                         h.userData.timer = null;
                         h.userData.direction.applyAxisAngle(new THREE.Vector3(0,1,0), Math.PI/2);
                    } else {
                        // Look up slightly
                        if(h.userData.parts && h.userData.parts.head) h.userData.parts.head.rotation.x = -0.3;
                    }
                    return;
                }

                if (state === InhabitantState.WORKING) {
                    const jitter = Math.sin(time * 20) * 0.02;
                    if (h.userData.parts) { h.userData.parts.leftArm.rotation.x = -Math.PI / 2 + jitter; h.userData.parts.rightArm.rotation.x = -Math.PI / 2 - jitter; }
                    return;
                }
                if (state === InhabitantState.IDLE || state === InhabitantState.SITTING || state === InhabitantState.SLEEPING) return;

                let isWalking = false;
                if (state === InhabitantState.PACING) {
                    isWalking = true; const paceSpeed = 0.5 * d; const maxDist = 1.5;
                    h.position.x += h.userData.paceDirection * paceSpeed;
                    const targetRot = h.userData.paceDirection === 1 ? Math.PI / 2 : -Math.PI / 2;
                    let rotDiff = targetRot - h.rotation.y;
                    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2; while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
                    h.rotation.y += rotDiff * 0.1;
                    if (Math.abs(h.position.x) > maxDist) h.userData.paceDirection *= -1;
                } else if (h.userData.isResident) {
                    const ud = h.userData;
                    if (ud.homeState === 'AT_HOME') {
                        h.visible = false;
                        if (!ud.timer) ud.timer = time + 5 + Math.random() * 10;
                        if (time > ud.timer) { ud.homeState = 'LEAVING_HOME'; ud.timer = null; h.visible = true; h.scale.setScalar(0.1); h.position.copy(ud.doorPosLocal); }
                    } else if (ud.homeState === 'GOING_HOME' || ud.homeState === 'LEAVING_HOME') {
                        h.visible = true; isWalking = true;
                        const target = ud.homeState === 'GOING_HOME' ? ud.doorPosLocal : ud.streetPosLocal;
                        const dist = h.position.distanceTo(target);
                        if (ud.homeState === 'GOING_HOME' && dist < 1.5) h.scale.setScalar(Math.max(0.1, dist / 1.5));
                        if (ud.homeState === 'LEAVING_HOME' && dist < 1.5) h.scale.setScalar(Math.min(1, 1 - (dist / 1.5) + 0.5));
                        if (dist < 0.2) {
                            if (ud.homeState === 'GOING_HOME') ud.homeState = 'AT_HOME';
                            else { if (!ud.loiterTimer) ud.loiterTimer = time + 2 + Math.random() * 3; if (time > ud.loiterTimer) { ud.homeState = 'GOING_HOME'; ud.loiterTimer = null; } else isWalking = false; }
                        } else {
                            const dir = new THREE.Vector3().subVectors(target, h.position).normalize();
                            const s = (h.userData.speed || 1) * d;
                            h.position.addScaledVector(dir, s);
                            const targetRot = Math.atan2(dir.x, dir.z);
                            let rotDiff = targetRot - h.rotation.y;
                            while (rotDiff > Math.PI) rotDiff -= Math.PI * 2; while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
                            h.rotation.y += rotDiff * 0.1;
                        }
                    }
                } else if (state === InhabitantState.WALKING) {
                    if (h.userData.blockedTimer && time < h.userData.blockedTimer) { h.rotation.y += 2 * d; isWalking = false; }
                    else {
                        // --- INTERACTION DECISION LOGIC ---
                        if (Math.random() < 0.015) { // Check occasionally to save CPU
                            let interactionFound = false;

                            // A. Check for nearby walker (Social)
                            for(let j=0; j<animRef.current.inhabitantsList.length; j++) {
                                const other = animRef.current.inhabitantsList[j];
                                // Don't talk to self, must be walking, must be close
                                if (other !== h && other.userData.state === InhabitantState.WALKING && !other.userData.isResident) {
                                     const distSq = h.position.distanceToSquared(other.position);
                                     if (distSq < 4.0) { // < 2 meters
                                         const duration = 4 + Math.random() * 5;
                                         
                                         // Set Self
                                         h.userData.state = InhabitantState.TALKING;
                                         h.userData.timer = time + duration;
                                         h.lookAt(other.position.x, h.position.y, other.position.z);
                                         
                                         // Set Partner
                                         other.userData.state = InhabitantState.TALKING;
                                         other.userData.timer = time + duration;
                                         other.lookAt(h.position.x, other.position.y, h.position.z);
                                         
                                         interactionFound = true;
                                         isWalking = false;
                                         break;
                                     }
                                }
                            }

                            // B. Check for POI (Sightseeing) - Only if no friend found
                            if (!interactionFound) {
                                for(const poi of animRef.current.pois) {
                                    const distSq = h.position.distanceToSquared(poi);
                                    if (distSq < 225) { // < 15m radius
                                        if (Math.random() > 0.6) { // 40% chance to stop if near POI
                                            h.userData.state = InhabitantState.SIGHTSEEING;
                                            h.userData.timer = time + 3 + Math.random() * 4;
                                            h.lookAt(poi.x, h.position.y, poi.z);
                                            interactionFound = true;
                                            isWalking = false;
                                            break;
                                        }
                                    }
                                }
                            }
                        }

                        if (!isWalking && (h.userData.state === InhabitantState.TALKING || h.userData.state === InhabitantState.SIGHTSEEING)) {
                            // Logic handled in next frame
                        } else {
                            isWalking = true; const s = h.userData.speed * d; const dr = h.userData.direction;
                            const nextX = h.position.x + dr.x * s * 10; const nextZ = h.position.z + dr.z * s * 10;
                            let collision = false; const b = h.userData.walkingBounds;
                            if (b && (nextX < b.minX || nextX > b.maxX || nextZ < b.minZ || nextZ > b.maxZ)) collision = true;
                            if (collision) {
                                h.userData.blockedTimer = time + 1.0; 
                                if (b) { const centerX = (b.minX + b.maxX)/2; const centerZ = (b.minZ + b.maxZ)/2; const dirToCenter = new THREE.Vector3(centerX - h.position.x, 0, centerZ - h.position.z).normalize(); dirToCenter.x += (Math.random()-0.5); dirToCenter.z += (Math.random()-0.5); h.userData.direction = dirToCenter.normalize(); } 
                                else { h.userData.direction.negate().applyAxisAngle(new THREE.Vector3(0,1,0), (Math.random()-0.5)); }
                                isWalking = false; 
                            } else {
                                h.position.x += dr.x * s; h.position.z += dr.z * s;
                                const targetRot = Math.atan2(dr.x, dr.z); let rotDiff = targetRot - h.rotation.y;
                                while (rotDiff > Math.PI) rotDiff -= Math.PI * 2; while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
                                h.rotation.y += rotDiff * 0.1;
                            }
                        }
                    }
                }
                if (isWalking && h.userData.parts) {
                    const w = Math.sin(time * h.userData.animSpeed);
                    h.userData.parts.leftLeg.rotation.x = w * 0.5; h.userData.parts.rightLeg.rotation.x = -w * 0.5;
                    h.userData.parts.leftArm.rotation.x = -w * 0.5; h.userData.parts.rightArm.rotation.x = w * 0.5;
                } else if (h.userData.parts) {
                    h.userData.parts.leftLeg.rotation.x *= 0.8; h.userData.parts.rightLeg.rotation.x *= 0.8;
                    h.userData.parts.leftArm.rotation.x *= 0.8; h.userData.parts.rightArm.rotation.x *= 0.8;
                }
            });

            // Animate AI NPC indicators (glowing diamonds bob + spin above their heads)
            animRef.current.inhabitantsList.forEach((h: any) => {
                if (h.userData.isAi && h.userData.halo) {
                    h.userData.halo.position.y = 2.3 + Math.sin(time * 2 + (h.userData.offset || 0)) * 0.15;
                    h.userData.halo.rotation.y = time * 1.5;
                    h.userData.halo.rotation.x = Math.sin(time) * 0.3;
                }
            });
                        animRef.current.fountainDropletsList.forEach(d => { d.position.add(d.userData.velocity); d.userData.velocity.y -= 0.01; if (d.position.y < 1.5) { d.position.set(0, 2, 0); d.userData.velocity.set((Math.random() - 0.5) * 0.15, 0.25 + Math.random() * 0.1, (Math.random() - 0.5) * 0.15); } });
            
            // Building Bounce Distortion Logic
            animRef.current.buildingsList.forEach((b) => { 
                // Expansion click logic
                const e = b.userData.expanded; 
                const es = 3; 
                b.children.forEach((f: any) => { 
                    if(f.userData.originalY !== undefined){ 
                        const ty = e ? f.userData.originalY * es : f.userData.originalY; 
                        f.position.y += (ty - f.position.y) * 0.1; 
                    } 
                }); 
                
                // GOD MODE DISTORTION
                if (Math.abs(distortion) > 0.05) {
                    // Wobbly buildings
                    b.scale.y = 1 + Math.sin(time * 5 + b.position.x) * 0.3 * distortion;
                    b.rotation.z = Math.cos(time * 3 + b.position.z) * 0.1 * distortion;
                } else if (b.scale.y !== 1) {
                    b.scale.y += (1 - b.scale.y) * 0.1;
                    b.rotation.z += (0 - b.rotation.z) * 0.1;
                }
            });
            
            rendererRef.current.render(sceneRef.current, cameraRef.current);

            // --- TÉLÉMÉTRIE (une fois par seconde, seulement si demandée) ---
            if (onStats) {
                statsRef.current.frames++;
                statsRef.current.clock += d;
                if (statsRef.current.clock >= 1) {
                    const info = rendererRef.current.info;
                    onStats({
                        fps: Math.round(statsRef.current.frames / statsRef.current.clock),
                        draws: info.render.calls,
                        tris: info.render.triangles,
                        buildings: animRef.current.buildingsList.length,
                        acts: ledgerActs().length,
                        frontier: Math.round(expansionRef.current?.frontier() ?? 0),
                        tiles: terrainRef.current?.tileCount() ?? 0,
                    });
                    statsRef.current.frames = 0;
                    statsRef.current.clock = 0;
                }
            }
        };
        animate();

        return () => {
            autonomyRef.current?.stop();
            studioRef.current?.stop();
            saveLedger();
            citizensRef.current?.dispose();
            trafficRef.current?.dispose();
            terrainRef.current?.dispose();
            hazeRef.current?.dispose();
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            window.removeEventListener('resize', hR);
            window.removeEventListener('pagehide', flush);
            window.removeEventListener('beforeunload', flush);
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('keyup', onKeyUp);
            if (rendererRef.current && rendererRef.current.domElement) {
                rendererRef.current.domElement.removeEventListener('mousedown', hMD);
                rendererRef.current.domElement.removeEventListener('contextmenu', hRC);
                if (mountRef.current) mountRef.current.removeChild(rendererRef.current.domElement);
                rendererRef.current.dispose();
            }
        };
    }, []);

    // --- 2. LIGHTING & WEATHER UPDATE ---
    useEffect(() => {
        const p = presets[lightingPreset] || presets[0];
        if (fogRef.current) {
            fogRef.current.color.setHex(p.fog);
            // plancher de densité : le brouillard doit toujours masquer la
            // frontière de génération (~430 m), sinon on verrait le monde apparaître
            // la nuit, on desserre un peu la brume : sinon la ville éclairée
            // disparaît avant même qu'on la voie
            fogRef.current.density = Math.max(0.0085, p.dens * fogLevel * (p.night ? 0.72 : 1));
        }
        hazeRef.current?.tune(p.fog, Math.max(0.0085, p.dens * fogLevel * (p.night ? 0.72 : 1)), p.night);
        if (ambientLightRef.current) ambientLightRef.current.intensity = p.amb;
        if (dirLightRef.current) { dirLightRef.current.intensity = p.dir; dirLightRef.current.color.setHex(p.dirC); }
        if (skyMaterialRef.current) {
            skyMaterialRef.current.uniforms.topColor.value.setHex(p.skyTop);
            skyMaterialRef.current.uniforms.bottomColor.value.setHex(p.skyBottom);
        }
        if (sunRef.current) {
            (sunRef.current.material as THREE.MeshBasicMaterial).color.setHex(p.sunColor);
            sunRef.current.position.set(p.sunPos[0], p.sunPos[1], p.sunPos[2]);
            if (dirLightRef.current) dirLightRef.current.position.set(p.sunPos[0], p.sunPos[1], p.sunPos[2]);
        }
        if (starsRef.current) starsRef.current.visible = p.night;
        sharedMaterials.lampLight.opacity = p.night ? 0.9 : 0.1;
        sharedMaterials.vehicleHeadlight.opacity = p.night ? 0.8 : 0.2;
        // Searchlight visibility based on day/night
        sharedMaterials.searchLightBeam.opacity = p.night ? 0.3 : 0.05;

        if (weatherSystemRef.current && particlePositionsRef.current && particleVelocitiesRef.current) {
            if (weather === 'clear') {
                weatherSystemRef.current.visible = false;
                fogRef.current.density = p.dens * fogLevel; 
            } else {
                weatherSystemRef.current.visible = true;
                const mat = weatherSystemRef.current.material as THREE.PointsMaterial;
                const vels = particleVelocitiesRef.current;
                
                if (weather === 'rain') {
                    mat.color.setHex(0x88ccff);
                    mat.size = 0.5;
                    fogRef.current.density = (p.dens * fogLevel) + 0.01; 
                    for(let i=0; i<vels.length/3; i++) {
                        vels[i*3] = (Math.random()-0.5) * 0.1; 
                        vels[i*3+1] = 0.8 + Math.random() * 0.8; 
                        vels[i*3+2] = (Math.random()-0.5) * 0.1; 
                    }
                } else if (weather === 'snow') {
                    mat.color.setHex(0xffffff);
                    mat.size = 0.3;
                    fogRef.current.density = (p.dens * fogLevel) + 0.02; 
                    for(let i=0; i<vels.length/3; i++) {
                        vels[i*3] = (Math.random()-0.5) * 0.2; 
                        vels[i*3+1] = 0.1 + Math.random() * 0.1; 
                        vels[i*3+2] = (Math.random()-0.5) * 0.2; 
                    }
                }
            }
        }
    }, [lightingPreset, fogLevel, weather]);

    // --- 3. CONTROLS MODE SWITCHING (UPDATED) ---
    useEffect(() => {
        if (!controlsRef.current || !controlsFPSRef.current || !cameraRef.current) return;

        if (walkMode) {
             // Activate FPS
             controlsRef.current.enabled = false;
             
             // Initial FPS position (center of city, ground level)
             // Only reset if we were far away (orbiting)
             if (cameraRef.current.position.y > 10) {
                 cameraRef.current.position.set(0, 1.7, 0); 
                 cameraRef.current.lookAt(0, 1.7, -10);
             }
             
             // NO AUTO LOCK: We rely on the user clicking to lock to prevent browser warnings.
             
        } else {
             // Revert to Orbit
             controlsFPSRef.current.unlock();
             controlsRef.current.enabled = !autoPilot; // Re-enable orbit unless in drone mode
             
             // Reset orbit position slightly above
             // cameraRef.current.position.set(50, 50, 50); // Optional reset
             // Clear any interaction label
             if(setInteractionLabel) setInteractionLabel(null);
        }

    }, [walkMode, autoPilot]);

    // --- 4. CITY GENERATION UPDATE (Logic only) ---
    useEffect(() => {
        if (!cityGroupRef.current) return;
        
        const baseRadius = generateCity({ cityGroup: cityGroupRef.current, architecturalStyle, animRef, fxRefs });
        spawnAiNpcs(cityGroupRef.current, animRef, AI_PERSONAS);
        drawLotMarkers(cityGroupRef.current);

        // La ville repart de son noyau, puis le registre rejoue TOUT ce qui a
        // déjà été construit (rien ne disparaît au démarrage), et de nouveaux
        // quartiers naîtront quand on s'approchera de la frontière.
        if (!expansionRef.current) {
            expansionRef.current = createExpansionManager({
                cityGroup: cityGroupRef.current,
                animRef,
                onDistrict: (label, n) => {
                    console.info(`[ville] nouveau quartier #${n} : ${label}`);
                    onStudioEvent?.({ t: Date.now(), text: `Nouveau quartier : ${label}` });
                },
                onBuilding: (label, by) => console.info(`[ville] ${by} livre ${label}`),
                onGroundChanged: (x, z, r) => terrainRef.current?.invalidate(x, z, r),
            });
        }
        expansionRef.current.reset(baseRadius, architecturalStyle);

        // Le sol/la forêt sont resemés MAINTENANT que le cadastre de la nouvelle
        // ville existe : sinon les arbres pousseraient au milieu des rues.
        if (terrainRef.current && cameraRef.current) {
            terrainRef.current.dispose();
            terrainRef.current.update({ x: cameraRef.current.position.x, z: cameraRef.current.position.z });
        }

        // Le cabinet d'architectes : il construit en continu, apprend, et trace
        // de nouvelles rues quand le foncier est épuisé.
        if (!studioRef.current) {
            studioRef.current = createStudio({
                world: expansionRef.current,
                cityGroup: cityGroupRef.current,
                playerPos: () => (walkModeRef.current || vehicleRef.current.current
                    ? (cameraRef.current?.position ?? new THREE.Vector3())
                    : (controlsRef.current?.target ?? new THREE.Vector3())),
                onEvent: (e) => {
                    console.info(`[atelier] ${e.text}`);
                    onStudioEvent?.(e, studioRef.current?.roster(), studioRef.current?.report());
                },
            });
            studioRef.current.start();
        }

        // Les habitants, eux, bâtissent LEUR projet (boulangerie, clinique…)
        if (!autonomyRef.current) {
            autonomyRef.current = createAutonomyTicker(
                {
                    world: expansionRef.current,
                    personas: AI_PERSONAS,
                    onEvent: (text) => { console.info(`[habitants] ${text}`); onStudioEvent?.({ t: Date.now(), text }); },
                },
                { intervalMs: 30000, initialDelayMs: 12000 },
            );
            autonomyRef.current.start();
        }

    }, [architecturalStyle]);
    
    return <div ref={mountRef} className="w-full h-full" />;
};

export default VoxelCityScene;