import { tidePhaseAt } from './tides';
import type { AlertRule, AlertWindow, HourPoint } from './types';

function hourOf(time: string): number {
  return Number(time.slice(11, 13));
}

export function hourMatches(points: HourPoint[], i: number, rule: AlertRule): boolean {
  const p = points[i];
  const h = hourOf(p.time);
  const inRange =
    rule.fromHour <= rule.toHour ? h >= rule.fromHour && h < rule.toHour : h >= rule.fromHour || h < rule.toHour;
  if (!inRange) return false;
  if (p.windKmh == null || p.windKmh > rule.maxWindKmh) return false;
  if (p.waveM == null || p.waveM > rule.maxWaveM) return false;
  if (rule.minPressureHpa != null && (p.pressureHpa == null || p.pressureHpa < rule.minPressureHpa)) return false;
  if (rule.tide !== 'any' && tidePhaseAt(points, i) !== rule.tide) return false;
  return true;
}

/** Groups consecutive matching hours (at or after `fromTime`) into windows. `end` is the last matching hour. */
export function alertWindows(points: HourPoint[], rule: AlertRule, fromTime: string): AlertWindow[] {
  const windows: AlertWindow[] = [];
  let current: AlertWindow | null = null;
  let lastIdx = -2;
  points.forEach((p, i) => {
    const ok = p.time >= fromTime && hourMatches(points, i, rule);
    if (ok && current && lastIdx === i - 1) {
      current.end = p.time;
    } else if (ok) {
      current = { start: p.time, end: p.time };
      windows.push(current);
    } else {
      current = null;
    }
    if (ok) lastIdx = i;
  });
  return windows;
}
