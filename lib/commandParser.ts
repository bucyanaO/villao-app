// Local, offline command parser for the "God Mode" chat.
// No API key required: it maps natural French phrases to engine intents.
// Returns null when nothing is recognised so the caller can fall back to Gemini.

export type SummonType = 'car' | 'taxi' | 'truck' | 'bus';

export interface ParsedCommand {
    thought: string;
    action: string;
    settings?: {
        lightingPreset?: number;
        weather?: 'clear' | 'rain' | 'snow';
        fog?: number;
        realityBending?: { distortion: number; glitchIntensity: number; timeScale: number; gravity: number };
        specialEffects?: Record<string, boolean>;
        npcState?: any;
        trafficSpeed?: number;
        globalChaos?: boolean;
    };
    godOperations?: any[];
    summon?: { type: SummonType; label: string } | null;
}

const normalize = (s: string) =>
    s.toLowerCase()
     .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
     .replace(/[?!.,]/g, ' ')
     .replace(/\s+/g, ' ')
     .trim();

const has = (text: string, words: string[]) => words.some(w => text.includes(w));

// Vehicle summoning synonyms. Order matters: most specific (taxi) before generic (voiture).
const VEHICLE_RULES: { type: SummonType; label: string; triggers: string[] }[] = [
    {
        type: 'taxi', label: 'Taxi',
        triggers: ['taxi', 'vtc', 'uber', 'chauffeur'],
    },
    {
        type: 'bus', label: 'Bus',
        triggers: ['bus', 'autobus', 'car scolaire', 'transport en commun'],
    },
    {
        type: 'truck', label: 'Camion',
        triggers: ['camion', 'utilitaire', 'fourgon', 'livraison'],
    },
    {
        type: 'car', label: 'Voiture',
        triggers: ['voiture', 'vehicule', 'vehicule', 'bagnole', 'caisse', 'auto', 'automobile', 'voiturier', 'berline'],
    },
];

// Phrases that indicate an intent to make something arrive / come to the player.
const ARRIVE_INTENT = [
    'commande', 'command', 'appelle', 'appele', 'appel', 'fait venir', 'fais venir', 'amene', 'amene', 'ramene', 'ramene',
    'envoie', 'envoye', 'envoye', 'invoque', 'invoque', 'invoquer', 'viens', 'vient', 'arrive', 'arriver', 'appel un', 'appel une',
    'je veux une', 'je veux un', 'donne moi', 'donne-moi', 'fais apparaitre', 'fais apparaitre', 'spawn', 'invoque une', 'invoque un',
    'viens me chercher', 'viens me chercher', 'amene moi', 'amene-moi', 'viens me',
];

const REMOVE_INTENT = ['supprime', 'supprimes', 'enleve', 'enleve', 'retire', 'retire', 'detruit', 'detruit', 'efface', 'efface', 'virer', 'remove', 'delete'];

const WEATHER_RULES: { key: 'clear' | 'rain' | 'snow'; triggers: string[]; thought: string }[] = [
    { key: 'rain', triggers: ['pluie', 'pleuve', 'pleuvoir', 'orage', 'tempete', 'tempete', 'deluge', 'rain', 'averse'], thought: "Les cieux s'ouvrent. La pluie s'abat sur le quartier." },
    { key: 'snow', triggers: ['neige', 'neiger', 'neigeux', 'blizzard', 'hiver', 'snow', 'flocon'], thought: "Un froid polaire s'installe. La neige recouvre la ville." },
    { key: 'clear', triggers: ['soleil', 'clair', 'clear', 'beau temps', 'degage', 'ensoleille'], thought: "Les nuages se dissipent. Le ciel s'éclaircit." },
];

const LIGHTING_RULES: { preset: number; triggers: string[]; thought: string }[] = [
    { preset: 0, triggers: ['jour naturel', 'journee', 'beau temps', 'ensoleille', 'jour clair', 'plein jour', 'le jour', 'du jour'], thought: "L'aube naturelle envahit le quartier." },
    { preset: 1, triggers: ['coucher', 'crepuscule', 'sunset', 'soleil couchant'], thought: "Le soleil décline, l'heure dorée s'installe." },
    { preset: 2, triggers: ['nuit', 'neon', 'nocturne', 'minuit', 'nuit noire'], thought: "La nuit tombe. Les néons s'illuminent." },
];

export const parseLocalCommand = (raw: string): ParsedCommand | null => {
    const text = normalize(raw);
    if (!text) return null;

    // --- 1. SUMMON A VEHICLE ("commande une voiture" / "appelle un taxi") ---
    // Only trigger as a summon when there's an arrival intent OR the phrase is just the vehicle name.
    const wantsArrive = has(text, ARRIVE_INTENT);
    const vehicle = VEHICLE_RULES.find(r => has(text, r.triggers));

    if (vehicle && !has(text, REMOVE_INTENT) && (wantsArrive || text.split(' ').length <= 3)) {
        return {
            thought: `Une ${vehicle.label.toLowerCase()} est appelée et se dirige vers vous. Approchez et appuyez sur F pour monter à bord.`,
            action: `SUMMON_${vehicle.type.toUpperCase()}`,
            summon: { type: vehicle.type, label: vehicle.label },
        };
    }

    // --- 2. REMOVE VEHICLES ---
    if (has(text, REMOVE_INTENT) && has(text, ['voiture', 'vehicule', 'vehicule', 'bagnole', 'caisse', 'auto', 'taxi', 'camion', 'bus', 'traffic', 'trafic'])) {
        return {
            thought: "Les véhicules sélectionnés se volatilisent dans un éclair de données.",
            action: 'PURGE_TRAFFIC',
            godOperations: [{ action: 'REMOVE', selector: { type: 'vehicle', count: 'all' } }],
        };
    }

    // --- 3. WEATHER ---
    const weather = WEATHER_RULES.find(r => has(text, r.triggers));
    if (weather) {
        return {
            thought: weather.thought,
            action: `WEATHER_${weather.key.toUpperCase()}`,
            settings: { weather: weather.key },
        };
    }

    // --- 4. LIGHTING ---
    const light = LIGHTING_RULES.find(r => has(text, r.triggers));
    if (light) {
        return {
            thought: light.thought,
            action: `LIGHTING_${light.preset}`,
            settings: { lightingPreset: light.preset },
        };
    }

    // --- 5. SPAWN TREE (gold if "or") ---
    if (has(text, ['arbre', 'arbre', 'tree', 'sapin', 'chene', 'chene', 'palmier']) &&
        (wantsArrive || has(text, ['fais apparaitre', 'fais apparaitre', 'ajoute', ' cree', 'cree', 'spawn', 'plante']))) {
        const gold = has(text, ['en or', "d'or", 'dore', 'dore', 'gold']);
        return {
            thought: gold ? "Un arbre d'or pur pousse instantanément." : "Un arbre holographique émerge du sol.",
            action: 'SPAWN_TREE',
            godOperations: [{
                action: 'SPAWN',
                selector: { type: 'tree' },
                params: { type: 'tree', color: gold ? '#ffd700' : undefined, position: { x: 0, y: 0, z: 0 } },
            }],
        };
    }

    // --- 6. SPECIAL FX (a couple of fun ones) ---
    if (has(text, ['disco', 'discotheque', 'fete', 'boum'])) {
        return { thought: "Le quartier bascule en mode disco. Que la fête commence !", action: 'FX_DISCO', settings: { specialEffects: { disco: true } } };
    }
    if (has(text, ['kaiju', 'monstre', 'godzilla', 'giant'])) {
        return { thought: "Un Kaiju surgit des profondeurs. La ville tremble.", action: 'FX_KAIJU', settings: { specialEffects: { kaiju: true } } };
    }

    // Nothing recognised locally.
    return null;
};
