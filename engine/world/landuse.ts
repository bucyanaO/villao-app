/**
 * LANDUSE — règles d'affectation des sols (le « zonage » au sens urbanistique).
 *
 * Le cadastre (`zoning.ts`) dit ce qui est PHYSIQUEMENT possible ; ce module dit
 * ce qui est SOUHAITABLE. C'est lui qui empêche l'usine de s'installer entre
 * deux maisons.
 *
 * Deux mécanismes :
 *  - DISTANCES DE PRIORITÉ : une matrice de séparation minimale entre familles
 *    d'usages (une école tient l'usine à 150 m, un entrepôt tient le logement à
 *    120 m, etc.). Non respectée ⇒ le terrain est écarté.
 *  - PÔLES : l'industrie et la logistique se REGROUPENT (zone d'activités),
 *    tandis que commerces et équipements se dispersent dans le tissu habité.
 */
import type { ProgramKind } from './programs';

export type LandClass = 'residentiel' | 'commerce' | 'tertiaire' | 'equipement' | 'industrie' | 'agricole' | 'vert';

export const CLASS_OF: Record<ProgramKind, LandClass> = {
  maison: 'residentiel', immeuble: 'residentiel',
  magasin: 'commerce', boulangerie: 'commerce', cafe: 'commerce', marche: 'commerce',
  atelier: 'commerce', banque: 'commerce', hotel: 'commerce', station_service: 'commerce',
  bureau: 'tertiaire',
  ecole: 'equipement', clinique: 'equipement', mairie: 'equipement', universite: 'equipement',
  bibliotheque: 'equipement', musee: 'equipement', cinema: 'equipement', stade: 'equipement',
  poste: 'equipement', caserne: 'equipement', police: 'equipement', gare: 'equipement',
  entrepot: 'industrie', usine: 'industrie', energie: 'industrie', telecom: 'industrie',
  ferme: 'agricole',
  parc: 'vert',
};

/**
 * Distance minimale (m) entre un nouveau bâtiment et un bâtiment existant,
 * selon leurs familles. Symétrique. 0 = aucune contrainte.
 */
const SEPARATION: Partial<Record<LandClass, Partial<Record<LandClass, number>>>> = {
  industrie: {
    residentiel: 130,   // on ne fait pas dormir les gens contre une usine
    equipement: 150,    // écoles et cliniques encore plus loin
    commerce: 55,
    tertiaire: 80,
    vert: 45,
    industrie: 0,       // …mais les activités se regroupent volontiers
  },
  residentiel: { industrie: 130, agricole: 35 },
  equipement: { industrie: 150, agricole: 30 },
  commerce: { industrie: 55 },
  tertiaire: { industrie: 80 },
  vert: { industrie: 45 },
  agricole: {
    // les champs veulent de l'espace, mais s'accommodent du voisinage productif
    residentiel: 35, equipement: 30, agricole: 0, industrie: 0,
  },
};

export function separation(a: LandClass, b: LandClass): number {
  return SEPARATION[a]?.[b] ?? SEPARATION[b]?.[a] ?? 0;
}

/** Les usages qui se regroupent en pôle (zone d'activités, quartier d'affaires). */
export const CLUSTERS: Partial<Record<LandClass, number>> = {
  industrie: 90,   // zone d'activités
  tertiaire: 70,   // quartier d'affaires
  agricole: 120,   // terroir : les fermes se tiennent compagnie
};

export interface PlacedUse { kind: string; x: number; z: number; }

/**
 * Le terrain (x,z) respecte-t-il les distances de priorité vis-à-vis du bâti
 * existant ? Retourne aussi la distance au pôle du même usage (pour le score).
 */
export function evaluateSite(
  kind: ProgramKind,
  x: number,
  z: number,
  existing: readonly PlacedUse[],
): { ok: boolean; poleDistance: number } {
  const cls = CLASS_OF[kind];
  let poleDistance = Infinity;
  for (const b of existing) {
    const other = CLASS_OF[b.kind as ProgramKind];
    if (!other) continue;
    const d = Math.hypot(b.x - x, b.z - z);
    if (other === cls) poleDistance = Math.min(poleDistance, d);
    const min = separation(cls, other);
    if (min > 0 && d < min) return { ok: false, poleDistance };
  }
  return { ok: true, poleDistance };
}
