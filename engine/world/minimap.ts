/**
 * MINIMAP — l'échantillon du monde qui sert à dessiner la carte de poche.
 *
 * Le cadastre et le registre savent déjà tout ; il suffit d'en extraire ce qui
 * entre dans le cadre, en coordonnées monde. Aucun rendu ici : le dessin est
 * fait par `components/ui/MiniMap.tsx` sur un canvas 2D (quelques centaines de
 * traits, deux fois par seconde).
 */
import { roadsNear } from './zoning';
import { buildings as ledgerBuildings, districts as ledgerDistricts } from './ledger';
import { CLASS_OF, type LandClass } from './landuse';
import type { ProgramKind } from './programs';

export interface MapSample {
  center: { x: number; z: number };
  radius: number;
  heading: number;                     // orientation du joueur (radians)
  roads: { x1: number; z1: number; x2: number; z2: number; w: number }[];
  buildings: { x: number; z: number; c: LandClass }[];
  districts: { x: number; z: number; label: string }[];
}

export function sampleMap(
  center: { x: number; z: number },
  heading: number,
  radius = 260,
): MapSample {
  const r2 = radius * radius;
  const roads = roadsNear(center, radius * 1.3).map((s) => ({
    x1: s.x1, z1: s.z1, x2: s.x2, z2: s.z2, w: s.w,
  }));

  const buildings: MapSample['buildings'] = [];
  for (const b of ledgerBuildings()) {
    const dx = b.x - center.x, dz = b.z - center.z;
    if (dx * dx + dz * dz > r2) continue;
    buildings.push({ x: b.x, z: b.z, c: CLASS_OF[b.kind as ProgramKind] ?? 'residentiel' });
  }

  const districts: MapSample['districts'] = [];
  for (const d of ledgerDistricts()) {
    const dx = d.x - center.x, dz = d.z - center.z;
    if (dx * dx + dz * dz > r2 * 2.2) continue;
    districts.push({ x: d.x, z: d.z, label: d.theme });
  }

  return { center, radius, heading, roads, buildings, districts };
}
