import type { Seabed } from './types';

export interface Shop {
  id: number;
  name: string;
  lat: number;
  lon: number;
  distanceKm: number;
}

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

interface OverpassElement {
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: { name?: string };
}

export function parseShops(elements: OverpassElement[], lat: number, lon: number): Shop[] {
  return elements
    .map((e) => {
      const la = e.lat ?? e.center?.lat;
      const lo = e.lon ?? e.center?.lon;
      if (la == null || lo == null) return null;
      return { id: e.id, name: e.tags?.name ?? 'Tienda de pesca', lat: la, lon: lo, distanceKm: distanceKm(lat, lon, la, lo) };
    })
    .filter((s): s is Shop => s !== null)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/** Fishing shops within 25 km, from OpenStreetMap via Overpass. */
export async function fetchShops(lat: number, lon: number): Promise<Shop[]> {
  const q = `[out:json][timeout:20];nwr(around:25000,${lat},${lon})["shop"="fishing"];out center 15;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(q)}`,
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const json = (await res.json()) as { elements: OverpassElement[] };
  return parseShops(json.elements, lat, lon);
}

export type PlaceKind = 'beach' | 'pier' | 'breakwater';

export interface PlaceDefaults {
  seabed: Seabed;
  species: string;
  techniques: string;
  notes: string;
}

/** Sensible spot data for a place imported from OpenStreetMap, from its type and `surface` tag. */
export function placeDefaults(kind: PlaceKind, surface?: string): PlaceDefaults {
  const s = (surface ?? '').toLowerCase();
  const seabed: Seabed =
    kind === 'breakwater' || /rock|stone|bedrock/.test(s) ? 'roca'
    : kind === 'pier' || /pebble|gravel|shingle|cobble/.test(s) ? 'mixto'
    : 'arena';
  const byBed: Record<Seabed, Pick<PlaceDefaults, 'species' | 'techniques'>> = {
    arena: { species: 'Lubina, Dorada, Palometa', techniques: 'Surfcasting, Spinning' },
    roca: { species: 'Sargo, Lubina, Calamar', techniques: 'Spinning, Lance con boya' },
    mixto: { species: 'Dorada, Sargo, Lubina', techniques: 'Fondo, Spinning' },
    posidonia: { species: 'Sargo, Lubina', techniques: 'Spinning' },
    fango: { species: 'Dorada, Lubina', techniques: 'Fondo' },
  };
  const label = kind === 'beach' ? 'Playa' : kind === 'pier' ? 'Espigón' : 'Escollera';
  return { seabed, ...byBed[seabed], notes: `${label} importada de OpenStreetMap${surface ? ` (suelo: ${surface})` : ''}. Revisa fondo y accesos.` };
}

/** Compass bearing (deg) from a→b. */
const bearing = (a: [number, number], b: [number, number]) => {
  const r = Math.PI / 180;
  const y = Math.sin((b[1] - a[1]) * r) * Math.cos(b[0] * r);
  const x = Math.cos(a[0] * r) * Math.sin(b[0] * r) - Math.sin(a[0] * r) * Math.cos(b[0] * r) * Math.cos((b[1] - a[1]) * r);
  return ((Math.atan2(y, x) / r) + 360) % 360;
};

/**
 * Direction the coast faces (towards the sea), snapped to 45°. OSM coastlines run with the land on the left,
 * so the sea is 90° to the right of the nearest segment. `ways` are lists of [lat, lon].
 */
export function coastOrientation(lat: number, lon: number, ways: [number, number][][]): number | undefined {
  const kx = Math.cos((lat * Math.PI) / 180);
  let best: { d: number; deg: number } | null = null;
  for (const w of ways) {
    for (let i = 0; i + 1 < w.length; i++) {
      const [a, b] = [w[i], w[i + 1]];
      const ax = (a[1] - lon) * kx, ay = a[0] - lat, bx = (b[1] - lon) * kx, by = b[0] - lat;
      const dx = bx - ax, dy = by - ay;
      const len2 = dx * dx + dy * dy || 1e-12;
      const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
      const d = Math.hypot(ax + t * dx, ay + t * dy);
      if (!best || d < best.d) best = { d, deg: (bearing(a, b) + 90) % 360 };
    }
  }
  return best ? (Math.round(best.deg / 45) * 45) % 360 : undefined;
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** "Costa del Sol · Almayate": the name plus its town, so beaches with the same name can be told apart. */
export function spotLabel(s: { name: string; place?: string; customName?: boolean }): string {
  return !s.customName && s.place && !fold(s.name).includes(fold(s.place)) ? `${s.name} · ${s.place}` : s.name;
}

/**
 * Display label of every spot, made unique: spots that still share a label (same name in the same town)
 * get "(oeste)/(este)" or "(norte)/(sur)" when there are two, or "(1)", "(2)"… when there are more.
 */
export function spotLabels(spots: { id: string; name: string; place?: string; customName?: boolean; lat: number; lon: number }[]): Record<string, string> {
  const out: Record<string, string> = {};
  const groups = new Map<string, typeof spots>();
  for (const s of spots) {
    const l = spotLabel(s);
    groups.set(l, [...(groups.get(l) ?? []), s]);
  }
  for (const [label, group] of groups) {
    if (group.length === 1) {
      out[group[0].id] = label;
      continue;
    }
    const lonSpread = Math.max(...group.map((g) => g.lon)) - Math.min(...group.map((g) => g.lon));
    const latSpread = Math.max(...group.map((g) => g.lat)) - Math.min(...group.map((g) => g.lat));
    const byLon = lonSpread * Math.cos((group[0].lat * Math.PI) / 180) >= latSpread;
    const sorted = [...group].sort((a, b) => (byLon ? a.lon - b.lon : b.lat - a.lat));
    sorted.forEach((s, i) => {
      const tag = sorted.length === 2 ? (byLon ? ['oeste', 'este'] : ['norte', 'sur'])[i] : String(i + 1);
      out[s.id] = `${label} (${tag})`;
    });
  }
  return out;
}
