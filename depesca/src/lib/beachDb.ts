import type { Spot } from './types';

/** [lat, lon, name, kind, orientation, surface, place] */
type Row = [number, number, string | null, number, number, string | null, string | null];

let db: Promise<Row[] | null> | null = null;

/** The prebuilt beach database (web build only; elsewhere it is simply not available). */
function load(): Promise<Row[] | null> {
  db ??= fetch('/beaches-es.json')
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (j && Array.isArray(j.b) ? (j.b as Row[]) : null))
    .catch(() => null);
  return db;
}

/** Nearest database entry within `maxM` metres, to read its town. */
export function nearestPlace(rows: Row[], lat: number, lon: number, maxM = 400): string | undefined {
  const kx = Math.cos((lat * Math.PI) / 180);
  let best: { d: number; place: string } | null = null;
  for (const r of rows) {
    if (!r[6] || Math.abs(r[0] - lat) > 0.01) continue;
    const d = Math.hypot((r[0] - lat) * 111320, (r[1] - lon) * kx * 111320);
    if (d <= maxM && (!best || d < best.d)) best = { d, place: r[6] };
  }
  return best?.place;
}

/** Saved spots from before towns existed get theirs from the database. Returns the spots that changed. */
export async function fillPlaces(spots: Spot[]): Promise<Spot[]> {
  const missing = spots.filter((s) => !s.place && !s.customName);
  if (!missing.length) return [];
  const rows = await load();
  if (!rows) return [];
  const out: Spot[] = [];
  for (const s of missing) {
    const place = nearestPlace(rows, s.lat, s.lon);
    if (place) out.push({ ...s, place });
  }
  return out;
}
