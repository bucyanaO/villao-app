/**
 * LIGHTING_PRESETS — 8 visual ambiances (sky/fog/lights/sun).
 * Index maps to the `lightingPreset` prop (0..7).
 */
import { CITY_THEME } from './theme';

export const LIGHTING_PRESETS = [
    { sky: 0x87CEEB, fog: 0xE0F7FA, dens: 0.005, amb: 0.8, dir: 1.0, dirC: 0xffffff, night: false, skyTop: 0x0077ff, skyBottom: 0xffffff, sunColor: 0xffffaa, sunPos: [50, 100, -50] },
    { sky: 0xFF7E5F, fog: 0xFEB47B, dens: 0.015, amb: 0.6, dir: 0.7, dirC: 0xffaa00, night: false, skyTop: 0x4b0082, skyBottom: 0xFF7E5F, sunColor: 0xffaa00, sunPos: [80, 30, -80] },
    { sky: 0x050510, fog: 0x0a0a1a, dens: 0.025, amb: 0.4, dir: 0.3, dirC: 0x4444ff, night: true, skyTop: CITY_THEME.colors.sky.top, skyBottom: CITY_THEME.colors.sky.bottom, sunColor: 0xcccccc, sunPos: [-30, 80, 30] }, 
    { sky: 0x9CA3AF, fog: 0x9CA3AF, dens: 0.02, amb: 0.7, dir: 0.3, dirC: 0xffffff, night: false, skyTop: 0x555555, skyBottom: 0xaaaaaa, sunColor: 0xdddddd, sunPos: [50, 90, 0] },
    { sky: 0x8B3A3A, fog: 0xCD5C5C, dens: 0.03, amb: 0.5, dir: 0.6, dirC: 0xff4400, night: true, skyTop: 0x330000, skyBottom: 0xff5500, sunColor: 0xffaa00, sunPos: [100, 40, 0] },
    { sky: 0x2468f2, fog: 0x2468f2, dens: 0.02, amb: 0.6, dir: 0.8, dirC: 0xffffff, night: false, skyTop: 0x000088, skyBottom: 0x0044ff, sunColor: 0xffffff, sunPos: [50, 100, -50] },
    { sky: 0x000000, fog: 0x003300, dens: 0.04, amb: 0.2, dir: 0.2, dirC: 0x00ff00, night: true, skyTop: 0x000000, skyBottom: 0x003300, sunColor: 0x00ff00, sunPos: [0, 100, 0] },
    { sky: 0xff71ce, fog: 0x01cdfe, dens: 0.02, amb: 0.6, dir: 0.7, dirC: 0xff00ff, night: false, skyTop: 0x220044, skyBottom: 0xff71ce, sunColor: 0x00ffff, sunPos: [80, 40, -80] },
];


