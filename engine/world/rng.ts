/**
 * RNG déterministe (mulberry32).
 *
 * Tout ce que le cabinet d'architectes construit est engendré à partir d'une
 * graine enregistrée dans le registre de la ville : au rechargement, la même
 * graine redonne EXACTEMENT le même bâtiment. C'est ce qui permet de sauvegarder
 * une ville entière en quelques octets par édifice.
 */
export interface Rng {
  (): number;                                   // [0,1)
  range(a: number, b: number): number;
  int(a: number, b: number): number;            // entier inclusif
  pick<T>(arr: readonly T[]): T;
  chance(p: number): boolean;
}

export function makeRng(seed: number): Rng {
  let s = seed >>> 0 || 1;
  const next = () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = next as Rng;
  rng.range = (a, b) => a + next() * (b - a);
  rng.int = (a, b) => Math.floor(a + next() * (b - a + 1));
  rng.pick = <T,>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length) % arr.length];
  rng.chance = (p) => next() < p;
  return rng;
}

/** Graine aléatoire (utilisée une seule fois, à la création — puis mémorisée). */
export function newSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}
