import type { HourPoint, TideEvent, TidePhase } from './types';

/** High/low tides found as local extrema of the hourly sea level series. */
export function tideEvents(points: HourPoint[]): TideEvent[] {
  const events: TideEvent[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1].seaLevelM;
    const cur = points[i].seaLevelM;
    const next = points[i + 1].seaLevelM;
    if (prev == null || cur == null || next == null) continue;
    if (cur > prev && cur >= next) events.push({ time: points[i].time, type: 'high', levelM: cur });
    else if (cur < prev && cur <= next) events.push({ time: points[i].time, type: 'low', levelM: cur });
  }
  return events;
}

/** Tide direction at index i, comparing with the next hour (or previous at the end). */
export function tidePhaseAt(points: HourPoint[], i: number): Exclude<TidePhase, 'any'> | null {
  const cur = points[i]?.seaLevelM;
  if (cur == null) return null;
  const next = points[i + 1]?.seaLevelM;
  if (next != null && next !== cur) return next > cur ? 'rising' : 'falling';
  const prev = points[i - 1]?.seaLevelM;
  if (prev != null && prev !== cur) return cur > prev ? 'rising' : 'falling';
  return null;
}
