import type { HourPoint } from './types';

interface MarineResponse {
  hourly: {
    time: string[];
    wave_height: (number | null)[];
    sea_surface_temperature: (number | null)[];
    sea_level_height_msl: (number | null)[];
  };
}

interface WeatherResponse {
  hourly: {
    time: string[];
    wind_speed_10m: (number | null)[];
    wind_direction_10m: (number | null)[];
    pressure_msl: (number | null)[];
  };
}

/** Merge the two Open-Meteo responses by timestamp. */
export function mergeConditions(marine: MarineResponse, weather: WeatherResponse): HourPoint[] {
  const w = new Map<string, number>();
  weather.hourly.time.forEach((t, i) => w.set(t, i));
  return marine.hourly.time.map((time, i) => {
    const j = w.get(time);
    return {
      time,
      waveM: marine.hourly.wave_height[i] ?? null,
      seaTempC: marine.hourly.sea_surface_temperature[i] ?? null,
      seaLevelM: marine.hourly.sea_level_height_msl[i] ?? null,
      windKn: j == null ? null : (weather.hourly.wind_speed_10m[j] ?? null),
      windDirDeg: j == null ? null : (weather.hourly.wind_direction_10m[j] ?? null),
      pressureHpa: j == null ? null : (weather.hourly.pressure_msl[j] ?? null),
    };
  });
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  return (await res.json()) as T;
}

/** Free, keyless data from Open-Meteo. Tides are derived from modelled sea level (coarse near the coast). */
export async function fetchConditions(lat: number, lon: number, days = 5): Promise<HourPoint[]> {
  const q = `latitude=${lat}&longitude=${lon}&timezone=auto&forecast_days=${days}`;
  const [marine, weather] = await Promise.all([
    getJson<MarineResponse>(
      `https://marine-api.open-meteo.com/v1/marine?${q}&hourly=wave_height,sea_surface_temperature,sea_level_height_msl`,
    ),
    getJson<WeatherResponse>(
      `https://api.open-meteo.com/v1/forecast?${q}&wind_speed_unit=kn&hourly=wind_speed_10m,wind_direction_10m,pressure_msl`,
    ),
  ]);
  return mergeConditions(marine, weather);
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
export function compass(deg: number | null): string {
  return deg == null ? '–' : COMPASS[Math.round(deg / 45) % 8];
}

/** Local "now" in the same format as HourPoint.time, truncated to the hour. */
export function nowHourKey(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`;
}
