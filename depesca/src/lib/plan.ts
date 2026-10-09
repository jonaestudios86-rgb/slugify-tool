import type { Spot } from './types';

export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

interface PlanOption {
  when: TimeOfDay[];
  technique: string;
  lure: string;
}

export interface Species {
  id: string;
  name: string;
  tempMin: number;
  tempMax: number;
  /** Peak season months (1-12), inclusive; may wrap the year end. */
  seasonFrom: number;
  seasonTo: number;
  peak: TimeOfDay[];
  /** Typical casting distance from shore, metres. */
  castM: [number, number];
  options: PlanOption[];
}

/** Rule-of-thumb data for common Spanish coastal species. Tune freely: it is a guide, not science. */
export const SPECIES: Species[] = [
  {
    id: 'lubina', name: 'Lubina', tempMin: 11, tempMax: 23, seasonFrom: 10, seasonTo: 4,
    peak: ['dawn', 'dusk', 'night'], castM: [20, 50],
    options: [
      { when: ['dawn', 'dusk', 'night'], technique: 'Corcheo (flotador deslizante)', lure: 'Paseante (stickbait)' },
      { when: ['day'], technique: 'Spinning desde costa', lure: 'Vinilo (shad/paddle tail)' },
    ],
  },
  {
    id: 'dorada', name: 'Dorada', tempMin: 15, tempMax: 26, seasonFrom: 6, seasonTo: 11,
    peak: ['dawn', 'dusk', 'night'], castM: [40, 80],
    options: [{ when: ['dawn', 'day', 'dusk', 'night'], technique: 'Fondo (surfcasting)', lure: 'Gamba, coquina o mejillón' }],
  },
  {
    id: 'sargo', name: 'Sargo', tempMin: 14, tempMax: 24, seasonFrom: 4, seasonTo: 11,
    peak: ['dawn', 'day', 'dusk'], castM: [10, 30],
    options: [{ when: ['dawn', 'day', 'dusk', 'night'], technique: 'Lance con boya', lure: 'Pan, gamba o coquina' }],
  },
  {
    id: 'palometa', name: 'Palometa', tempMin: 18, tempMax: 27, seasonFrom: 6, seasonTo: 10,
    peak: ['dawn', 'dusk'], castM: [30, 60],
    options: [{ when: ['dawn', 'day', 'dusk', 'night'], technique: 'Spinning ligero', lure: 'Cucharilla o jig' }],
  },
  {
    id: 'calamar', name: 'Calamar', tempMin: 13, tempMax: 22, seasonFrom: 10, seasonTo: 3,
    peak: ['dusk', 'night'], castM: [15, 40],
    options: [{ when: ['dawn', 'day', 'dusk', 'night'], technique: 'Eging desde costa', lure: 'Jibia (egi)' }],
  },
  {
    id: 'caballa', name: 'Caballa', tempMin: 14, tempMax: 22, seasonFrom: 3, seasonTo: 6,
    peak: ['dawn', 'dusk', 'day'], castM: [20, 50],
    options: [{ when: ['dawn', 'day', 'dusk', 'night'], technique: 'Spinning ligero o sabiki', lure: 'Plumas o cucharilla' }],
  },
];

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export const inSeason = (sp: Species, month: number) =>
  sp.seasonFrom <= sp.seasonTo ? month >= sp.seasonFrom && month <= sp.seasonTo : month >= sp.seasonFrom || month <= sp.seasonTo;

export interface Suitability {
  total: number;
  temp: number;
  season: number;
  tod: number;
}

export function suitability(sp: Species, waterTempC: number | null, month: number, tod: TimeOfDay): Suitability {
  let temp = 0.7;
  if (waterTempC != null) {
    const d = waterTempC < sp.tempMin ? sp.tempMin - waterTempC : waterTempC > sp.tempMax ? waterTempC - sp.tempMax : 0;
    temp = Math.max(0, 1 - d / 6);
  }
  const season = inSeason(sp, month) ? 1 : 0.4;
  const todFit = sp.peak.includes(tod) ? 1 : 0.5;
  return { total: 0.4 * temp + 0.3 * season + 0.3 * todFit, temp, season, tod: todFit };
}

/** Species to consider for a spot: those the user listed that we know, otherwise all. */
export function candidateSpecies(spot: Pick<Spot, 'species'>): Species[] {
  const wanted = spot.species.map(norm);
  const known = SPECIES.filter((s) => wanted.some((w) => w.includes(norm(s.name)) || norm(s.name).includes(w)));
  return known.length ? known : SPECIES;
}

export interface PlanWindow {
  role: 'Ventana principal' | 'Alternativa' | 'Plan B';
  startHour: number;
  /** Exclusive end hour. */
  endHour: number;
  species: string;
  technique: string;
  lure: string;
  reason: string;
}

export interface WindowInput {
  startHour: number;
  endHour: number;
  tod: TimeOfDay;
}

export function reasonFor(s: Suitability): string {
  const parts: string[] = [];
  if (s.temp >= 0.99) parts.push('la temperatura del agua está dentro del rango que favorece a la especie');
  if (s.tod >= 0.99) parts.push('la hora coincide con el pico de actividad de la especie');
  if (s.season >= 0.99) parts.push('el mes está dentro de la temporada alta de la especie');
  if (!parts.length) return 'Es la opción menos desfavorable con las condiciones previstas.';
  const text = parts.slice(0, 2).join(', y ');
  return text.charAt(0).toUpperCase() + text.slice(1) + '.';
}

const ROLES: PlanWindow['role'][] = ['Ventana principal', 'Alternativa', 'Plan B'];

export function buildPlan(windows: WindowInput[], spot: Pick<Spot, 'species'>, waterTempC: number | null, month: number): PlanWindow[] {
  const pool = candidateSpecies(spot);
  const out: PlanWindow[] = [];
  windows.slice(0, 3).forEach((w, i) => {
    const ranked = pool
      .map((sp) => ({ sp, s: suitability(sp, waterTempC, month, w.tod) }))
      .sort((a, b) => b.s.total - a.s.total);
    const best = ranked[0];
    if (!best || best.s.total < 0.35) return;
    const opt = best.sp.options.find((o) => o.when.includes(w.tod)) ?? best.sp.options[0];
    out.push({
      role: ROLES[i], startHour: w.startHour, endHour: w.endHour, species: best.sp.name,
      technique: opt.technique, lure: opt.lure, reason: reasonFor(best.s),
    });
  });
  return out;
}

/** Recommended cast range (m): calm, clear water lets fish sit further out; surf pushes them in. */
export function castDistance(sp: Species, nearshoreWaveM: number): [number, number] {
  const f = nearshoreWaveM <= 0.3 ? 1 : nearshoreWaveM <= 0.8 ? 0.8 : 0.6;
  const r = (n: number) => Math.max(5, Math.round((n * f) / 5) * 5);
  return [r(sp.castM[0]), r(sp.castM[1])];
}
