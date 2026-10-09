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
