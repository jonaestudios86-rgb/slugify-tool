import { getMoonIllumination, getMoonPosition, getMoonTimes, getTimes } from 'suncalc';
import { keyToDate } from './conditions';

export interface MoonInfo {
  phase: number;
  fraction: number;
  waxing: boolean;
  name: string;
}

export function moonName(phase: number): string {
  if (phase < 0.02 || phase > 0.98) return 'Luna nueva';
  if (phase < 0.22) return 'Luna creciente';
  if (phase < 0.28) return 'Cuarto creciente';
  if (phase < 0.47) return 'Gibosa creciente';
  if (phase < 0.53) return 'Luna llena';
  if (phase < 0.72) return 'Gibosa menguante';
  if (phase < 0.78) return 'Cuarto menguante';
  return 'Luna menguante';
}

export function moonInfo(date: Date): MoonInfo {
  const m = getMoonIllumination(date);
  return { phase: m.phase, fraction: m.fraction, waxing: m.waxing, name: moonName(m.phase) };
}

export interface TideCoefficient {
  value: number;
  title: string;
  verdict: string;
}

/**
 * Approximate tidal coefficient (20-120, French convention) from lunar phase and distance.
 * Springs peak ~1.5 days after new/full moon and grow near perigee. An estimate, not an official figure.
 */
export function tideCoefficient(date: Date, lat: number, lon: number): TideCoefficient {
  const { phase } = getMoonIllumination(date);
  const dist = getMoonPosition(date, lat, lon).distance;
  const perigee = Math.max(-1, Math.min(1, (384400 - dist) / 28000));
  const value = Math.round(Math.max(20, Math.min(120, 70 + 28 * Math.cos(4 * Math.PI * (phase - 0.05)) + 12 * perigee)));
  if (value >= 70) return { value, title: 'Marea viva', verdict: value >= 85 ? 'Excelente para pesca' : 'Buena para pesca' };
  if (value >= 45) return { value, title: 'Marea media', verdict: 'Aceptable para pesca' };
  return { value, title: 'Marea muerta', verdict: 'Floja para pesca' };
}

export type PeriodLabel = 'Tránsito superior' | 'Tránsito inferior' | 'Salida de luna' | 'Puesta de luna';

export interface SolunarPeriod {
  kind: 'major' | 'minor';
  label: PeriodLabel;
  center: Date;
  start: Date;
  end: Date;
  stars: number;
}

export interface BestMoment {
  center: Date;
  label: string;
  stars: number;
}

export interface SolunarDay {
  moon: MoonInfo;
  sunrise?: Date;
  sunset?: Date;
  moonrise?: Date;
  moonset?: Date;
  periods: SolunarPeriod[];
  stars: number;
  best: BestMoment[];
}

const MIN = 60_000;

/** Solunar table for a civil day ("YYYY-MM-DD") at a spot. Major periods last 2 h, minor 1 h, centred on the event. */
export function solunarDay(dateKey: string, lat: number, lon: number, utcOffsetSec: number): SolunarDay {
  const noon = keyToDate(`${dateKey}T12:00`, utcOffsetSec);
  const offMin = utcOffsetSec / 60;
  const sun = getTimes(noon, lat, lon, 0, offMin);
  const moonT = getMoonTimes(noon, lat, lon, offMin);
  const moon = moonInfo(noon);
  const sunrise = sun.sunrise ?? undefined;
  const sunset = sun.sunset ?? undefined;
  const nearFullNew = moon.fraction < 0.1 || moon.fraction > 0.9;

  const events: [PeriodLabel, Date | undefined, 'major' | 'minor'][] = [
    ['Tránsito inferior', moonT.lowerTransit, 'major'],
    ['Salida de luna', moonT.rise, 'minor'],
    ['Tránsito superior', moonT.transit, 'major'],
    ['Puesta de luna', moonT.set, 'minor'],
  ];

  const sunNear = (d: Date) =>
    [sunrise, sunset].some((s) => s && Math.abs(s.getTime() - d.getTime()) <= 60 * MIN);

  const periods: SolunarPeriod[] = events
    .filter((e): e is [PeriodLabel, Date, 'major' | 'minor'] => !!e[1])
    .map(([label, center, kind]) => {
      const half = (kind === 'major' ? 60 : 30) * MIN;
      const stars = Math.min(5, (kind === 'major' ? 3 : 2) + (sunNear(center) ? 1 : 0) + (nearFullNew ? 1 : 0));
      return { kind, label, center, start: new Date(center.getTime() - half), end: new Date(center.getTime() + half), stars };
    })
    .sort((a, b) => a.center.getTime() - b.center.getTime());

  const best: BestMoment[] = periods
    .map((p) => {
      const sunEvt = [
        { d: sunrise, n: 'Amanecer' },
        { d: sunset, n: 'Atardecer' },
      ].find((s) => s.d && Math.abs(s.d.getTime() - p.center.getTime()) <= 75 * MIN);
      const base = p.label === 'Salida de luna' ? 'Salida de Luna' : p.label === 'Puesta de luna' ? 'Puesta de Luna' : p.label;
      return {
        center: p.center,
        label: sunEvt && p.kind === 'minor' ? `${base} + ${sunEvt.n}` : base,
        stars: Math.min(5, p.stars + (sunEvt && p.kind === 'minor' ? 1 : 0)),
      };
    })
    .sort((a, b) => b.stars - a.stars || a.center.getTime() - b.center.getTime())
    .slice(0, 3);

  return {
    moon,
    sunrise,
    sunset,
    moonrise: moonT.rise,
    moonset: moonT.set,
    periods,
    stars: periods.reduce((m, p) => Math.max(m, p.stars), 0),
    best,
  };
}
