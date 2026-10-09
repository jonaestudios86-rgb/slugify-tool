import { fetchConditions, type Conditions } from './conditions';
import { buildForecast } from './forecast';
import type { Spot } from './types';

export interface PlacePoint {
  id: string;
  lat: number;
  lon: number;
  /** Direction the coast faces (deg), when known. */
  orientation?: number;
}

/** Weather barely changes within ~20 km, so places share one forecast per cell. */
const CELL = 0.2;
const MAX_CELLS = 10;
const TTL_MS = 30 * 60_000;

const cellOf = (lat: number, lon: number) => ({ y: Math.round(lat / CELL), x: Math.round(lon / CELL) });
const keyOf = (c: { x: number; y: number }) => `${c.y}:${c.x}`;

const cache = new Map<string, { at: number; cond: Promise<Conditions> }>();

/** The cells to fetch for these places: the ones nearest the map centre, at most MAX_CELLS. */
export function pickCells(places: PlacePoint[], center: { lat: number; lon: number }): Map<string, { lat: number; lon: number }> {
  const cells = new Map<string, { lat: number; lon: number; d: number }>();
  for (const p of places) {
    const c = cellOf(p.lat, p.lon);
    const k = keyOf(c);
    if (cells.has(k)) continue;
    const lat = c.y * CELL, lon = c.x * CELL;
    cells.set(k, { lat, lon, d: Math.hypot(lat - center.lat, lon - center.lon) });
  }
  return new Map([...cells].sort((a, b) => a[1].d - b[1].d).slice(0, MAX_CELLS).map(([k, v]) => [k, { lat: v.lat, lon: v.lon }]));
}

/** Fishing score (0-100, right now) for each place, estimated from its area's forecast. Places outside the fetched cells are left out. */
export async function scorePlaces(
  places: PlacePoint[],
  center: { lat: number; lon: number },
  load: (lat: number, lon: number) => Promise<Conditions> = (la, lo) => fetchConditions(la, lo, 1),
  now = new Date(),
): Promise<Record<string, number>> {
  const cells = pickCells(places, center);
  const conds = new Map<string, Conditions>();
  await Promise.all([...cells].map(async ([k, c]) => {
    let hit = cache.get(k);
    if (!hit || now.getTime() - hit.at > TTL_MS) {
      hit = { at: now.getTime(), cond: load(c.lat, c.lon) };
      cache.set(k, hit);
      hit.cond.catch(() => cache.delete(k));
    }
    try {
      conds.set(k, await hit.cond);
    } catch {
      /* area without data: its places just get no number */
    }
  }));
  const out: Record<string, number> = {};
  for (const p of places) {
    const cond = conds.get(keyOf(cellOf(p.lat, p.lon)));
    if (!cond) continue;
    const spot: Spot = { id: p.id, name: '', lat: p.lat, lon: p.lon, seabed: 'arena', species: [], techniques: [], notes: '', favorite: false, orientation: p.orientation };
    const day = buildForecast(cond, spot, now).days[0];
    if (day) out[p.id] = day.headline.score;
  }
  return out;
}

export const clearAreaCache = () => cache.clear();
