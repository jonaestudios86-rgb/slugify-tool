import type { HourPoint } from './types';

type Col = (number | null)[] | undefined;

export interface MarineResponse {
  utc_offset_seconds?: number;
  timezone?: string;
  hourly: {
    time: string[];
    wave_height?: Col;
    wave_period?: Col;
    wave_direction?: Col;
    swell_wave_height?: Col;
    ocean_current_velocity?: Col;
    ocean_current_direction?: Col;
    sea_surface_temperature?: Col;
    sea_level_height_msl?: Col;
  };
}

export interface WeatherResponse {
  utc_offset_seconds?: number;
  timezone?: string;
  hourly: {
    time: string[];
    wind_speed_10m?: Col;
    wind_direction_10m?: Col;
    wind_gusts_10m?: Col;
    temperature_2m?: Col;
    pressure_msl?: Col;
    cloud_cover?: Col;
    precipitation?: Col;
    precipitation_probability?: Col;
  };
}

export interface Conditions {
  points: HourPoint[];
  utcOffsetSec: number;
  timezone: string;
}

const at = (c: Col, i: number): number | null => c?.[i] ?? null;

/** Merge the two Open-Meteo responses by timestamp. Any variable the API omits becomes null. */
export function mergeConditions(marine: MarineResponse, weather: WeatherResponse): HourPoint[] {
  const w = new Map<string, number>();
  weather.hourly.time.forEach((t, i) => w.set(t, i));
  const m = marine.hourly;
  const h = weather.hourly;
  return m.time.map((time, i) => {
    const j = w.get(time);
    const wx = (c: Col) => (j == null ? null : at(c, j));
    const kmhToMs = (v: number | null) => (v == null ? null : v / 3.6);
    return {
      time,
      waveM: at(m.wave_height, i),
      wavePeriodS: at(m.wave_period, i),
      waveDirDeg: at(m.wave_direction, i),
      swellM: at(m.swell_wave_height, i),
      currentMs: kmhToMs(at(m.ocean_current_velocity, i)),
      currentDirDeg: at(m.ocean_current_direction, i),
      seaTempC: at(m.sea_surface_temperature, i),
      seaLevelM: at(m.sea_level_height_msl, i),
      windKmh: wx(h.wind_speed_10m),
      windDirDeg: wx(h.wind_direction_10m),
      gustKmh: wx(h.wind_gusts_10m),
      airTempC: wx(h.temperature_2m),
      pressureHpa: wx(h.pressure_msl),
      cloudPct: wx(h.cloud_cover),
      rainMm: wx(h.precipitation),
      rainProbPct: wx(h.precipitation_probability),
    };
  });
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  return (await res.json()) as T;
}

/**
 * Free, keyless data from Open-Meteo. Marine variables come from a coarse global model, so
 * nearshore waves and tides are estimates. Times are local to the spot.
 */
export async function fetchConditions(lat: number, lon: number, days = 7): Promise<Conditions> {
  const q = `latitude=${lat}&longitude=${lon}&timezone=auto&forecast_days=${days}`;
  const [marine, weather] = await Promise.all([
    getJson<MarineResponse>(
      `https://marine-api.open-meteo.com/v1/marine?${q}&cell_selection=sea&hourly=wave_height,wave_period,wave_direction,swell_wave_height,ocean_current_velocity,ocean_current_direction,sea_surface_temperature,sea_level_height_msl`,
    ),
    getJson<WeatherResponse>(
      `https://api.open-meteo.com/v1/forecast?${q}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,pressure_msl,cloud_cover,precipitation,precipitation_probability`,
    ),
  ]);
  return {
    points: mergeConditions(marine, weather),
    utcOffsetSec: weather.utc_offset_seconds ?? marine.utc_offset_seconds ?? 0,
    timezone: weather.timezone ?? marine.timezone ?? 'local',
  };
}

const p2 = (n: number) => String(n).padStart(2, '0');

/** Local wall-clock key ("YYYY-MM-DDTHH:mm") of an instant in the spot's zone. */
export function localKey(d: Date, offsetSec: number): string {
  const s = new Date(d.getTime() + offsetSec * 1000);
  return `${s.getUTCFullYear()}-${p2(s.getUTCMonth() + 1)}-${p2(s.getUTCDate())}T${p2(s.getUTCHours())}:${p2(s.getUTCMinutes())}`;
}

/** Inverse of localKey. Accepts "YYYY-MM-DD" (midnight) or "YYYY-MM-DDTHH:mm". */
export function keyToDate(key: string, offsetSec: number): Date {
  const [d, t = '00:00'] = key.split('T');
  const [y, mo, da] = d.split('-').map(Number);
  const [h, mi] = t.split(':').map(Number);
  return new Date(Date.UTC(y, mo - 1, da, h, mi) - offsetSec * 1000);
}

/** Current hour in the spot's zone, same format as HourPoint.time. */
export function nowHourKey(offsetSec: number, now = new Date()): string {
  return localKey(now, offsetSec).slice(0, 13) + ':00';
}

/** "HH:MM" of an instant in the spot's zone. */
export function hm(d: Date | undefined, offsetSec: number): string {
  return d ? localKey(d, offsetSec).slice(11, 16) : '–';
}
