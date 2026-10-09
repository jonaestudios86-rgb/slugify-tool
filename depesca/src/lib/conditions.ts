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

type Fetch = (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

async function getJson<T>(url: string, doFetch: Fetch): Promise<T> {
  const res = await doFetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  return (await res.json()) as T;
}

/** Tries each URL in turn and returns the first response that works; the last error is thrown if none does. */
async function firstOk<T>(urls: string[], doFetch: Fetch): Promise<T> {
  let last: unknown = new Error('sin URL');
  for (const u of urls) {
    try {
      return await getJson<T>(u, doFetch);
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

const MARINE_FULL = 'wave_height,wave_period,wave_direction,swell_wave_height,ocean_current_velocity,ocean_current_direction,sea_surface_temperature,sea_level_height_msl';
const MARINE_BASIC = 'wave_height,wave_period,wave_direction,sea_surface_temperature';
const WEATHER_FULL = 'wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,pressure_msl,cloud_cover,precipitation,precipitation_probability';
const WEATHER_BASIC = 'wind_speed_10m,wind_direction_10m,temperature_2m,pressure_msl';

/**
 * Free, keyless data from Open-Meteo. Marine variables come from a coarse global model, so nearshore waves and
 * tides are estimates. Times are local to the spot. If the API rejects some variables, fewer are requested; if
 * the marine API has nothing for the point (e.g. inland), the forecast still works from weather alone.
 */
export async function fetchConditions(lat: number, lon: number, days = 7, doFetch: Fetch = fetch as unknown as Fetch): Promise<Conditions> {
  const q = `latitude=${lat}&longitude=${lon}&timezone=auto&forecast_days=${days}`;
  const marineUrl = (vars: string) => `https://marine-api.open-meteo.com/v1/marine?${q}&cell_selection=sea&hourly=${vars}`;
  const weatherUrl = (vars: string) => `https://api.open-meteo.com/v1/forecast?${q}&hourly=${vars}`;

  const [marine, weather] = await Promise.all([
    firstOk<MarineResponse>([marineUrl(MARINE_FULL), marineUrl(MARINE_BASIC)], doFetch).catch(() => null),
    firstOk<WeatherResponse>([weatherUrl(WEATHER_FULL), weatherUrl(WEATHER_BASIC)], doFetch),
  ]);
  const base: MarineResponse = marine ?? { hourly: { time: weather.hourly.time } };
  return {
    points: mergeConditions(base, weather),
    utcOffsetSec: weather.utc_offset_seconds ?? marine?.utc_offset_seconds ?? 0,
    timezone: weather.timezone ?? marine?.timezone ?? 'local',
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
