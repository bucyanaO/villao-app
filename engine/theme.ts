/**
 * CITY_THEME — global color & opacity configuration for the whole voxel city.
 * Tweak the hex values here to restyle the entire city instantly.
 */
import * as THREE from 'three';

export const CITY_THEME = {
    colors: {
        // --- ENVIRONNEMENT (SOL & CIEL) ---
        ground: {
            floor: 0x3a3042,      // Sol: Gris Violet bien visible
            roadBase: 0x5d4e60,   // Route: Mauve Gris (désaturé)
            roadGrid: 0xff88ff,   // Grille Route: (Non utilisé)
            sidewalkBase: 0x22182e, // Trottoir: Violet foncé
            sidewalkGrid: 0x00eaff, // Grille Trottoir: Cyan
            markings: 0x00ffff,     // Marquages
        },
        sky: {
            top: 0x1a0b36,        // Ciel haut: Violet nuit profond
            bottom: 0x4a1c6e,     // Horizon: Violet plus chaud
        },

        // --- JARDINS & NATURE ---
        nature: {
            grass: 0x2d4c1e, // Vert sombre riche pour la pelouse
            flowers: [
                0xFF69B4, // Hot Pink
                0xFFD700, // Gold
                0xE6E6FA, // Lavender
                0xFF4500, // Orange Red
                0xFFFFFF  // White
            ]
        },

        // --- PERSONNAGES (HABITANTS) ---
        characters: {
            // Palette de vêtements
            clothes: [
                0x00ffff, // Cyan
                0xff00ff, // Magenta
                0xffff00, // Jaune
                0x00ff00, // Vert Néon
                0xffffff, // Blanc
                0xff3333  // Rouge
            ],
            // Palette de cheveux
            hair: [
                0x111111, // Noir
                0x555555, // Gris
                0xffffff, // Blanc
                0xff00ff, // Rose fluo
                0x00ffff, // Bleu fluo
                0xaa0000, // Roux sombre
                0xffaa00  // Blond
            ],
            accessories: 0x111111, 
            skin: 0xffccaa 
        },

        // --- VÉHICULES ---
        vehicles: {
            taxi: 0xffaa00,  // Jaune Taxi
            bus: 0x2244aa,   // Bleu Bus
            truck: 0xaaaaaa, // Gris Camion
            cars: [0xcc3333, 0x33cc33, 0x3333cc, 0xffffff, 0x111111, 0x880088]
        },

        // --- OBJETS & MOBILIER URBAIN ---
        props: {
            wood: 0x8B4513,       
            metal: 0xaaaaaa,      
            trashBin: 0x228822,   
            mailbox: 0x0000aa,    
            signs: 0xaaaaaa,      
            plantLeaves: 0x00ff00, 
            plantPot: 0x8B4513,    
            water: 0x00ffff,       
            lampPost: 0x555555,
            fence: {
                base: 0x1a1a1a, // Dark Concrete
                glass: 0xaaddff, // Frosted Blue-ish Glass
                frame: 0x888888 // Aluminum
            },
            // Palette mixte pour la ville générique
            treeFoliage: [
                0x2E8B57, // Vert Forêt
                0x228B22, // Vert Classique
                0x00ff66, // Vert Néon
                0xffaa00, // Automne Orange
                0xff3333, // Automne Rouge
                0xff00ff, // Cerisier (Rose)
                0x00ccff  // Alien (Bleu)
            ],
            // Palette STRICTEMENT VERTE pour le résidentiel
            greenFoliage: [
                0x2E8B57, // SeaGreen
                0x228B22, // ForestGreen
                0x32CD32, // LimeGreen
                0x00FF7F, // SpringGreen
                0x006400, // DarkGreen
                0x66CDAA  // MediumAquamarine
            ]
        },

        // --- BÂTIMENTS ---
        buildings: {
            glass: 0x88ccff,      
            frames: 0x333333,     
            neon: 0xff00ff,
            // Palette de murs variée
            walls: [
                0x00aaff, // Bleu Cyan
                0x00ffff, // Cyan clair
                0x0088ff, // Bleu Roi
                0xff8800, // Orange
                0xcc4444, // Rouge brique
                0x884488, // Violet
                0xaaaaaa, // Blanc gris
                0x44ffaa, // Menthe
                0xffcc00  // Jaune
            ],
            // Palette Villa Moderne LUXE (Neutre & Chic)
            modernWalls: [
                0xFFFFFF, // Pure White
                0xEEEEEE, // Off White
                0xCCCCCC, // Concrete Grey
                0x888888, // Medium Grey
            ],
            modernAccents: [
                0x222222, // Black Metal
                0x8B4513, // Rich Wood
                0x444444, // Dark Stone
            ],
            modernRoofs: [
                0x1a1a1a, // Dark Asphalt
                0x333333, // Dark Grey
                0xFFFFFF, // Clean White Roof
            ]
        }
    },
    
    // --- OPACITÉS ---
    opacity: {
        glass: 0.2,
        wireframe: 0.5,
        road: 0.95
    }
};
