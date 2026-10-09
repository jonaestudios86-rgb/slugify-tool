import { onshoreComponent, waveExposure } from './geo';
import type { HourPoint } from './types';

export interface Factors {
  tide: number;
  wind: number;
  sea: number;
  light: number;
  moon: number;
  pressure: number;
  rain: number;
}

export const WEIGHTS: Factors = { sea: 0.25, wind: 0.2, tide: 0.2, light: 0.15, pressure: 0.08, moon: 0.05, rain: 0.07 };

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
/** Linear map of x from [a,b] to [ya,yb], clamped to that range. */
const lerp = (x: number, a: number, b: number, ya: number, yb: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return ya + (yb - ya) * t;
};

export interface NearshoreWaves {
  /** Estimated wave height at this coast. */
  waveM: number;
  /** Estimated height of the biggest waves in a set. */
  seriesM: number;
}

export function nearshore(p: HourPoint, orientation: number | undefined): NearshoreWaves {
  const open = p.waveM ?? 0;
  const waveM = open * waveExposure(p.waveDirDeg, orientation);
  return { waveM, seriesM: waveM * 1.5 };
}

export interface ScoreContext {
  point: HourPoint;
  /** Pressure three hours earlier, if known. */
  pressure3hAgo: number | null;
  coefficient: number;
  moonFraction: number;
  /** Normalised tide movement this hour: 0 slack .. 1 strong flow. */
  tideMovement: number;
  orientation: number | undefined;
  /** Minutes from this hour to the nearest sunrise/sunset. */
  minutesToTwilight: number;
  isNight: boolean;
}

export function factorsFor(c: ScoreContext): Factors {
  const p = c.point;
  const { waveM } = nearshore(p, c.orientation);
  const wind = p.windKmh ?? 15;
  const onshore = Math.max(0, onshoreComponent(p.windDirDeg, c.orientation));

  const windF = clamp(lerp(wind, 8, 40, 100, 0) * (1 - 0.25 * onshore * Math.min(1, wind / 25)));
  const seaF = waveM <= 0.3 ? 100 : waveM <= 1 ? lerp(waveM, 0.3, 1, 100, 50) : lerp(waveM, 1, 2, 50, 0);
  const tideF = clamp(0.7 * lerp(c.coefficient, 20, 120, 20, 100) + 30 * clamp(c.tideMovement, 0, 1));
  const lightF = c.minutesToTwilight <= 60 ? 100 : c.minutesToTwilight <= 120 ? 80 : c.isNight ? 55 : 45;
  const moonF = 40 + 60 * Math.abs(2 * c.moonFraction - 1);

  let pressureF = 75;
  if (p.pressureHpa != null && c.pressure3hAgo != null) {
    const d = p.pressureHpa - c.pressure3hAgo;
    pressureF = d < -3 ? 50 : d < -1 ? 100 : d <= 1 ? 80 : d <= 3 ? 70 : 55;
  }
  if (p.pressureHpa != null && p.pressureHpa < 1005) pressureF = Math.max(0, pressureF - 10);

  let rainF = 100 - (p.rainProbPct ?? 0) * 0.8;
  if ((p.rainMm ?? 0) > 1) rainF -= 30;

  return { tide: tideF, wind: windF, sea: seaF, light: lightF, moon: moonF, pressure: pressureF, rain: clamp(rainF) };
}

export function combine(f: Factors): number {
  return Math.round(clamp((Object.keys(WEIGHTS) as (keyof Factors)[]).reduce((s, k) => s + WEIGHTS[k] * f[k], 0)));
}

export type ScoreLevel = 'excelente' | 'bueno' | 'moderado' | 'flojo' | 'malo';

export function scoreLevel(score: number): ScoreLevel {
  return score >= 85 ? 'excelente' : score >= 70 ? 'bueno' : score >= 50 ? 'moderado' : score >= 30 ? 'flojo' : 'malo';
}

export const LEVEL_LABEL: Record<ScoreLevel, string> = {
  excelente: 'Excelente', bueno: 'Bueno', moderado: 'Moderado', flojo: 'Flojo', malo: 'Malo',
};

export const LEVEL_COLOR: Record<ScoreLevel, string> = {
  excelente: '#22c55e', bueno: '#3b82f6', moderado: '#f59e0b', flojo: '#f97316', malo: '#ef4444',
};

/** Colour for a 0-100 factor: green good, amber so-so, red poor. */
export function factorColor(v: number): string {
  return v >= 70 ? '#22c55e' : v >= 45 ? '#f59e0b' : '#ef4444';
}

const FACTOR_TEXT: Record<keyof Factors, { weak: string; strong: string }> = {
  sea: { weak: 'pesa el oleaje', strong: 'destaca el mar en calma' },
  wind: { weak: 'pesa el viento', strong: 'destaca el viento flojo' },
  tide: { weak: 'pesa la marea', strong: 'destaca la marea' },
  light: { weak: 'la luz no acompaña', strong: 'destaca la luz del amanecer y el atardecer' },
  moon: { weak: 'pesa la luna', strong: 'destaca la luna' },
  pressure: { weak: 'pesa la presión', strong: 'destaca la presión' },
  rain: { weak: 'pesa la lluvia', strong: 'destaca el tiempo seco' },
};

const DAY_TEXT: Record<ScoreLevel, string> = {
  excelente: 'Día excelente', bueno: 'Buen día', moderado: 'Día normal', flojo: 'Día flojo', malo: 'Día malo',
};

/** One-line reason for a score: the factor that costs most points, or the one that adds most on good days. */
export function explainScore(score: number, f: Factors): string {
  const keys = Object.keys(WEIGHTS) as (keyof Factors)[];
  const level = scoreLevel(score);
  if (level === 'excelente' || level === 'bueno') {
    const top = keys.reduce((a, k) => (WEIGHTS[k] * f[k] > WEIGHTS[a] * f[a] ? k : a));
    return `${DAY_TEXT[level]}: ${FACTOR_TEXT[top].strong}.`;
  }
  const worst = keys.reduce((a, k) => (WEIGHTS[k] * (100 - f[k]) > WEIGHTS[a] * (100 - f[a]) ? k : a));
  return `${DAY_TEXT[level]}: ${FACTOR_TEXT[worst].weak}.`;
}

export function averageFactors(list: Factors[]): Factors {
  const keys = Object.keys(WEIGHTS) as (keyof Factors)[];
  const out = {} as Factors;
  for (const k of keys) out[k] = list.length ? list.reduce((s, f) => s + f[k], 0) / list.length : 0;
  return out;
}
