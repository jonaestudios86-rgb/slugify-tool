import { keyToDate, localKey, nowHourKey, type Conditions } from './conditions';
import { buildPlan, type PlanWindow, type TimeOfDay, type WindowInput } from './plan';
import {
  averageFactors, combine, explainScore, factorsFor, nearshore, scoreLevel,
  type Factors, type ScoreLevel,
} from './score';
import { moonInfo, solunarDay, tideCoefficient, type SolunarDay, type TideCoefficient } from './solunar';
import { tideEvents } from './tides';
import type { HourPoint, Spot, TideEvent } from './types';

export interface HourDetail {
  point: HourPoint;
  hour: number;
  score: number;
  factors: Factors;
  /** Estimated wave height / biggest waves at this coast. */
  waveM: number;
  seriesM: number;
}

export interface Headline {
  score: number;
  level: ScoreLevel;
  explanation: string;
  factors: Factors;
  /** The hour the headline numbers describe. */
  ref: HourDetail | null;
}

export interface DayForecast {
  date: string;
  hours: HourDetail[];
  /** Score of the whole day: mean of its best eight hours. */
  dayScore: number;
  dayLevel: ScoreLevel;
  headline: Headline;
  bestHour: number | null;
  bestStretch: { start: number; end: number } | null;
  coefficient: TideCoefficient;
  tides: TideEvent[];
  tideRangeM: number | null;
  solunar: SolunarDay;
  plan: PlanWindow[];
  seaMinM: number;
  seaMaxM: number;
  openSeaM: number;
  seriesMaxM: number;
  waterTempC: number | null;
}

export interface Forecast {
  days: DayForecast[];
  utcOffsetSec: number;
  timezone: string;
  nowKey: string;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const hourOfKey = (k: string) => Number(k.slice(11, 13));
const decimalHour = (d: Date | undefined, off: number) => {
  if (!d) return null;
  const k = localKey(d, off);
  return Number(k.slice(11, 13)) + Number(k.slice(14, 16)) / 60;
};

function timeOfDay(start: number, end: number, sunrise: number | null, sunset: number | null): TimeOfDay {
  const overlaps = (a: number, b: number) => start < b && end > a;
  if (sunrise != null && overlaps(sunrise - 1, sunrise + 1.5)) return 'dawn';
  if (sunset != null && overlaps(sunset - 1.5, sunset + 1)) return 'dusk';
  const mid = (start + end) / 2;
  if ((sunrise != null && mid < sunrise) || (sunset != null && mid > sunset)) return 'night';
  return 'day';
}

/** Greedy best non-overlapping windows of the given lengths over per-hour scores (NaN = unavailable). */
export function bestWindows(scores: number[], lengths: number[]): { start: number; end: number }[] {
  const used = new Array(scores.length).fill(false);
  const out: { start: number; end: number }[] = [];
  for (const len of lengths) {
    let best = -1;
    let bestMean = -Infinity;
    for (let s = 0; s + len <= scores.length; s++) {
      const slice = scores.slice(s, s + len);
      if (slice.some((v, k) => Number.isNaN(v) || used[s + k])) continue;
      const m = mean(slice);
      if (m > bestMean) { bestMean = m; best = s; }
    }
    if (best < 0) continue;
    for (let k = best; k < best + len; k++) used[k] = true;
    out.push({ start: best, end: best + len });
  }
  return out;
}

export function buildForecast(cond: Conditions, spot: Spot, now = new Date()): Forecast {
  const { points, utcOffsetSec: off } = cond;
  const nowKey = nowHourKey(off, now);
  const dates = [...new Set(points.map((p) => p.time.slice(0, 10)))];

  const days = dates.map((date): DayForecast => {
    const noon = keyToDate(`${date}T12:00`, off);
    const solunar = solunarDay(date, spot.lat, spot.lon, off);
    const coefficient = tideCoefficient(noon, spot.lat, spot.lon);
    const moon = moonInfo(noon);
    const sunrise = decimalHour(solunar.sunrise, off);
    const sunset = decimalHour(solunar.sunset, off);

    const idxs = points.map((p, i) => (p.time.startsWith(date) ? i : -1)).filter((i) => i >= 0);
    const levels = idxs.map((i) => points[i].seaLevelM).filter((v): v is number => v != null);
    const range = levels.length ? Math.max(...levels) - Math.min(...levels) : 0;
    const flowScale = range > 0 ? range / 3 : 0.03;

    const hours: HourDetail[] = idxs.map((i) => {
      const p = points[i];
      const hour = hourOfKey(p.time);
      const instant = keyToDate(p.time, off).getTime() + 30 * 60_000;
      const edges = [solunar.sunrise, solunar.sunset].filter((d): d is Date => !!d).map((d) => d.getTime());
      const minutesToTwilight = edges.length ? Math.min(...edges.map((e) => Math.abs(e - instant))) / 60_000 : 999;
      const isNight = edges.length === 2 && (instant < edges[0] - 30 * 60_000 || instant > edges[1] + 30 * 60_000);
      const prev = points[i - 1]?.seaLevelM;
      const next = points[i + 1]?.seaLevelM;
      const flow = prev != null && next != null ? Math.abs(next - prev) / 2 : null;
      const factors = factorsFor({
        point: p,
        pressure3hAgo: points[i - 3]?.pressureHpa ?? null,
        coefficient: coefficient.value,
        moonFraction: moon.fraction,
        tideMovement: flow == null ? 0.5 : flow / flowScale,
        orientation: spot.orientation,
        minutesToTwilight,
        isNight,
      });
      const ns = nearshore(p, spot.orientation);
      return { point: p, hour, score: combine(factors), factors, waveM: ns.waveM, seriesM: ns.seriesM };
    });

    const isToday = nowKey.startsWith(date);
    const fromHour = isToday ? hourOfKey(nowKey) : 0;
    const remaining = hours.filter((h) => h.hour >= fromHour);

    const top = [...hours].sort((a, b) => b.score - a.score).slice(0, 8);
    const dayScore = Math.round(mean(top.map((h) => h.score)));

    const refHour = isToday ? (remaining[0] ?? hours[hours.length - 1]) : (hours.find((h) => h.hour === 12) ?? hours[0]);
    const ref = refHour ?? null;
    const headlineScore = isToday && ref ? ref.score : dayScore;
    const headlineFactors = isToday && ref ? ref.factors : averageFactors(top.map((h) => h.factors));

    const bestHour = remaining.length ? remaining.reduce((a, b) => (b.score > a.score ? b : a)).hour : null;

    const scoresFrom = new Array(24).fill(NaN);
    remaining.forEach((h) => (scoresFrom[h.hour] = h.score));
    const wins = bestWindows(scoresFrom, [4, 5, 6]);
    const windowInputs: WindowInput[] = wins.map((w) => ({
      startHour: w.start, endHour: w.end, tod: timeOfDay(w.start, w.end, sunrise, sunset),
    }));

    const temps = hours.map((h) => h.point.seaTempC).filter((v): v is number => v != null);
    const waterTempC = temps.length ? mean(temps) : null;
    const month = Number(date.slice(5, 7));

    const events = tideEvents(points).filter((e) => e.time.startsWith(date));
    const highs = events.filter((e) => e.type === 'high').slice(0, 2);
    const lows = events.filter((e) => e.type === 'low').slice(0, 2);
    const tides = [...highs, ...lows].sort((a, b) => a.time.localeCompare(b.time));

    const waves = hours.map((h) => h.waveM);
    return {
      date,
      hours,
      dayScore,
      dayLevel: scoreLevel(dayScore),
      headline: {
        score: headlineScore,
        level: scoreLevel(headlineScore),
        explanation: explainScore(headlineScore, headlineFactors),
        factors: headlineFactors,
        ref,
      },
      bestHour,
      bestStretch: wins[0] ?? null,
      coefficient,
      tides,
      tideRangeM: levels.length ? range : null,
      solunar,
      plan: buildPlan(windowInputs, spot, waterTempC, month),
      seaMinM: waves.length ? Math.min(...waves) : 0,
      seaMaxM: waves.length ? Math.max(...waves) : 0,
      openSeaM: ref?.point.waveM ?? 0,
      seriesMaxM: hours.length ? Math.max(...hours.map((h) => h.seriesM)) : 0,
      waterTempC,
    };
  });

  return { days, utcOffsetSec: off, timezone: cond.timezone, nowKey };
}
