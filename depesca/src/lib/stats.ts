import type { Catch } from './types';

export interface CatchStats {
  total: number;
  totalKg: number;
  biggest: Catch | null;
  bySpecies: { species: string; count: number; kg: number }[];
  bySpot: { spotId: string; count: number }[];
}

export function catchStats(catches: Catch[]): CatchStats {
  const species = new Map<string, { count: number; kg: number }>();
  const spots = new Map<string, number>();
  let biggest: Catch | null = null;
  let totalKg = 0;
  for (const c of catches) {
    totalKg += c.weightKg;
    if (!biggest || c.weightKg > biggest.weightKg) biggest = c;
    const key = c.species.trim().toLowerCase() || 'sin especie';
    const s = species.get(key) ?? { count: 0, kg: 0 };
    species.set(key, { count: s.count + 1, kg: s.kg + c.weightKg });
    if (c.spotId) spots.set(c.spotId, (spots.get(c.spotId) ?? 0) + 1);
  }
  return {
    total: catches.length,
    totalKg: Math.round(totalKg * 100) / 100,
    biggest,
    bySpecies: [...species].map(([k, v]) => ({ species: k, ...v })).sort((a, b) => b.count - a.count),
    bySpot: [...spots].map(([spotId, count]) => ({ spotId, count })).sort((a, b) => b.count - a.count),
  };
}
