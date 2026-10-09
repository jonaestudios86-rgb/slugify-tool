import { describe, expect, it } from 'vitest';
import { fetchConditions, hm, keyToDate, localKey, nowHourKey, type Conditions } from '../conditions';
import { buildForecast, bestWindows } from '../forecast';
import { angleDiff, compass, onshoreComponent, waveExposure } from '../geo';
import { buildPlan, castDistance, inSeason, SPECIES } from '../plan';
import { parseShops } from '../places';
import { combine, explainScore, factorsFor, scoreLevel, type Factors } from '../score';
import { solunarDay, tideCoefficient } from '../solunar';
import type { HourPoint, Spot } from '../types';

const OFF = 7200; // Europe/Madrid summer time
const spot: Spot = {
  id: 's', name: 'Dique', lat: 36.71, lon: -4.41, seabed: 'roca', species: [], techniques: [], notes: '', favorite: false, orientation: 180,
};

/** Seven days of synthetic hourly data starting 2026-10-09 00:00 local, with a semidiurnal tide. */
function synthetic(days = 7, over: Partial<HourPoint> = {}): Conditions {
  const points: HourPoint[] = [];
  for (let i = 0; i < days * 24; i++) {
    const d = new Date(Date.UTC(2026, 9, 9) + i * 3_600_000);
    const time = localKey(new Date(d.getTime() - OFF * 1000), OFF);
    points.push({
      time, waveM: 0.6, wavePeriodS: 5, waveDirDeg: 170, swellM: 0.3, currentMs: 0.07, currentDirDeg: 45,
      seaTempC: 22, seaLevelM: 0.3 * Math.sin((2 * Math.PI * i) / 12.42), windKmh: 8, windDirDeg: 0, gustKmh: 14,
      airTempC: 20, pressureHpa: 1018 + (i % 5) * 0.2, cloudPct: 10, rainMm: 0, rainProbPct: 5, ...over,
    });
  }
  return { points, utcOffsetSec: OFF, timezone: 'Europe/Madrid' };
}
const NOW = new Date('2026-10-09T13:21:00Z'); // 15:21 local

describe('time helpers', () => {
  it('round-trips local keys', () => {
    const d = keyToDate('2026-10-09T15:00', OFF);
    expect(d.toISOString()).toBe('2026-10-09T13:00:00.000Z');
    expect(localKey(d, OFF)).toBe('2026-10-09T15:00');
    expect(nowHourKey(OFF, NOW)).toBe('2026-10-09T15:00');
    expect(hm(d, OFF)).toBe('15:00');
  });
});

describe('geo', () => {
  it('names bearings in Spanish', () => {
    expect([compass(0), compass(202), compass(225), compass(null)]).toEqual(['N', 'SSO', 'SO', '–']);
  });
  it('computes exposure and onshore wind', () => {
    expect(angleDiff(350, 10)).toBe(20);
    expect(waveExposure(180, 180)).toBeCloseTo(1);
    expect(waveExposure(0, 180)).toBe(0.15);
    expect(waveExposure(null, 180)).toBe(0.6);
    expect(onshoreComponent(180, 180)).toBeCloseTo(1);
    expect(onshoreComponent(0, 180)).toBeCloseTo(-1);
  });
});

describe('score', () => {
  const base = (over: Partial<HourPoint> = {}, o: Partial<Parameters<typeof factorsFor>[0]> = {}): Factors =>
    factorsFor({
      point: { ...synthetic(1).points[12], ...over }, pressure3hAgo: 1018, coefficient: 90, moonFraction: 0.02,
      tideMovement: 1, orientation: 180, minutesToTwilight: 30, isNight: false, ...o,
    });
  it('rewards calm, penalises rough', () => {
    const calm = combine(base({ waveM: 0.1, windKmh: 6 }));
    const rough = combine(base({ waveM: 2.5, waveDirDeg: 180, windKmh: 40, windDirDeg: 180 }));
    expect(calm).toBeGreaterThan(80);
    expect(rough).toBeLessThan(55);
    expect(calm).toBeGreaterThan(rough);
  });
  it('maps levels and explains the weakest factor', () => {
    expect(['excelente', 'bueno', 'moderado', 'flojo', 'malo']).toEqual([90, 75, 58, 40, 10].map(scoreLevel));
    const f = base({ waveM: 2, waveDirDeg: 180 });
    expect(explainScore(58, f)).toMatch(/^Día normal: pesa el oleaje\.$/);
    expect(explainScore(90, base())).toMatch(/^Día excelente: destaca/);
  });
});

describe('solunar', () => {
  it('matches known sun times and moon phase for Málaga on 2026-10-09', () => {
    const s = solunarDay('2026-10-09', 36.71, -4.41, OFF);
    expect(hm(s.sunrise, OFF)).toBe('08:19');
    expect(hm(s.sunset, OFF)).toBe('19:49');
    expect(s.moon.fraction).toBeLessThan(0.05);
    expect(s.moon.name).toBe('Luna menguante');
    expect(s.periods.length).toBeGreaterThanOrEqual(3);
    for (const p of s.periods) {
      const len = (p.end.getTime() - p.start.getTime()) / 60_000;
      expect(len).toBe(p.kind === 'major' ? 120 : 60);
      expect(p.stars).toBeGreaterThanOrEqual(1);
      expect(p.stars).toBeLessThanOrEqual(5);
    }
    expect(s.best.length).toBeGreaterThan(0);
  });
  it('keeps the tide coefficient in range and labels it', () => {
    for (let d = 0; d < 30; d++) {
      const c = tideCoefficient(new Date(Date.UTC(2026, 9, 1 + d, 12)), 36.7, -4.4);
      expect(c.value).toBeGreaterThanOrEqual(20);
      expect(c.value).toBeLessThanOrEqual(120);
    }
    expect(tideCoefficient(new Date('2026-10-11T12:00:00Z'), 36.7, -4.4).title).toBe('Marea viva');
  });
});

describe('plan', () => {
  it('handles seasons that wrap the year', () => {
    const lubina = SPECIES.find((s) => s.id === 'lubina')!;
    expect([12, 2, 10, 7].map((m) => inSeason(lubina, m))).toEqual([true, true, true, false]);
  });
  it('picks a plan per window with reasons and respects the spot species', () => {
    const plan = buildPlan(
      [{ startHour: 5, endHour: 9, tod: 'dawn' }, { startHour: 9, endHour: 14, tod: 'day' }, { startHour: 0, endHour: 6, tod: 'night' }],
      { species: [] }, 20, 10,
    );
    expect(plan.map((p) => p.role)).toEqual(['Ventana principal', 'Alternativa', 'Plan B']);
    expect(plan[0].reason).toMatch(/temperatura del agua/);
    const only = buildPlan([{ startHour: 5, endHour: 9, tod: 'dawn' }], { species: ['Sargo'] }, 20, 10);
    expect(only[0].species).toBe('Sargo');
  });
  it('shortens casts in surf', () => {
    const dorada = SPECIES.find((s) => s.id === 'dorada')!;
    expect(castDistance(dorada, 0.1)).toEqual([40, 80]);
    expect(castDistance(dorada, 1.2)[1]).toBeLessThan(80);
  });
});

describe('bestWindows', () => {
  it('finds non-overlapping windows and skips unavailable hours', () => {
    const s = [NaN, 10, 10, 10, 10, 90, 90, 90, 90, 50, 50, 50, 50, 50];
    expect(bestWindows(s, [4, 5])).toEqual([{ start: 5, end: 9 }, { start: 9, end: 14 }]);
  });
});

describe('buildForecast', () => {
  const f = buildForecast(synthetic(), spot, NOW);
  it('builds seven days with full hours', () => {
    expect(f.days).toHaveLength(7);
    expect(f.days[0].hours).toHaveLength(24);
    expect(f.nowKey).toBe('2026-10-09T15:00');
  });
  it('produces sane numbers everywhere', () => {
    for (const d of f.days) {
      expect(Number.isFinite(d.dayScore)).toBe(true);
      expect(d.dayScore).toBeGreaterThanOrEqual(0);
      expect(d.dayScore).toBeLessThanOrEqual(100);
      expect(d.tides.length).toBeGreaterThanOrEqual(2);
      expect(d.plan.length).toBeGreaterThan(0);
      for (const h of d.hours) expect(Number.isFinite(h.score)).toBe(true);
      const w = d.plan.map((p) => [p.startHour, p.endHour]).sort((a, b) => a[0] - b[0]);
      w.forEach((x, i) => i && expect(x[0]).toBeGreaterThanOrEqual(w[i - 1][1]));
    }
  });
  it("headline for today uses the current hour and plans only future hours", () => {
    const t = f.days[0];
    expect(t.headline.ref?.hour).toBe(15);
    expect(t.bestHour).toBeGreaterThanOrEqual(15);
    for (const p of t.plan) expect(p.startHour).toBeGreaterThanOrEqual(15);
    expect(f.days[1].headline.score).toBe(f.days[1].dayScore);
    expect(f.days[1].headline.ref?.hour).toBe(12);
  });
  it('estimates nearshore waves from coast orientation', () => {
    const exposed = buildForecast(synthetic(2, { waveM: 1, waveDirDeg: 180 }), spot, NOW).days[0];
    const sheltered = buildForecast(synthetic(2, { waveM: 1, waveDirDeg: 0 }), spot, NOW).days[0];
    expect(exposed.seaMaxM).toBeCloseTo(1);
    expect(sheltered.seaMaxM).toBeCloseTo(0.15);
    expect(exposed.seriesMaxM).toBeGreaterThan(exposed.seaMaxM);
  });
  it('survives missing data', () => {
    const empty = synthetic(2, { waveM: null, windKmh: null, pressureHpa: null, seaLevelM: null, seaTempC: null, rainProbPct: null });
    const d = buildForecast(empty, spot, NOW).days[0];
    expect(Number.isFinite(d.dayScore)).toBe(true);
    expect(d.tides).toEqual([]);
  });
});

describe('places', () => {
  it('parses and sorts shops by distance', () => {
    const shops = parseShops(
      [
        { id: 1, lat: 36.8, lon: -4.4, tags: { name: 'Lejos' } },
        { id: 2, center: { lat: 36.72, lon: -4.41 } },
        { id: 3 },
      ],
      36.71, -4.41,
    );
    expect(shops.map((s) => s.name)).toEqual(['Tienda de pesca', 'Lejos']);
    expect(shops[0].distanceKm).toBeLessThan(2);
  });
});

describe('fetchConditions fallbacks', () => {
  const T = ['2026-10-09T00:00', '2026-10-09T01:00'];
  const weather = { utc_offset_seconds: 7200, timezone: 'Europe/Madrid', hourly: { time: T, wind_speed_10m: [10, 12], pressure_msl: [1015, 1016] } };
  const marine = { hourly: { time: T, wave_height: [0.5, 0.6], sea_surface_temperature: [21, 21] } };
  const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
  const bad = { ok: false, status: 400, json: async () => ({}) };

  it('retries marine with fewer variables', async () => {
    const urls: string[] = [];
    const c = await fetchConditions(36.7, -4.4, 1, async (u) => {
      urls.push(u);
      if (u.includes('marine-api')) return u.includes('ocean_current') ? bad : ok(marine);
      return ok(weather);
    });
    expect(urls.filter((u) => u.includes('marine-api'))).toHaveLength(2);
    expect(c.points[0]).toMatchObject({ waveM: 0.5, windKmh: 10, currentMs: null });
    expect(c.utcOffsetSec).toBe(7200);
  });
  it('keeps going on weather alone when marine has no data', async () => {
    const c = await fetchConditions(40, -3.7, 1, async (u) => (u.includes('marine-api') ? bad : ok(weather)));
    expect(c.points).toHaveLength(2);
    expect(c.points[1]).toMatchObject({ waveM: null, seaTempC: null, windKmh: 12 });
    const f = buildForecast(c, spot, NOW);
    expect(Number.isFinite(f.days[0].dayScore)).toBe(true);
  });
  it('fails when weather is unavailable', async () => {
    await expect(fetchConditions(36.7, -4.4, 1, async () => bad)).rejects.toThrow(/Open-Meteo 400/);
  });
});

describe('area scores', () => {
  it('shares one forecast per ~20 km cell and scores each place', async () => {
    const { scorePlaces, pickCells, clearAreaCache } = await import('../areaScore');
    clearAreaCache();
    const hours = Array.from({ length: 24 }, (_, h) => ({
      time: `2026-10-09T${String(h).padStart(2, '0')}:00`,
      waveM: 0.3, wavePeriodS: 5, waveDirDeg: 180, swellM: 0.2, currentMs: 0.1, currentDirDeg: 90,
      seaTempC: 20, seaLevelM: Math.sin(h / 2) * 0.3, windKmh: 8, windDirDeg: 0, gustKmh: 12, airTempC: 20,
      pressureHpa: 1015, cloudPct: 10, rainMm: 0, rainProbPct: 0,
    }));
    let calls = 0;
    const load = async () => { calls++; return { points: hours, utcOffsetSec: 7200, timezone: 'Europe/Madrid' }; };
    const places = [
      { id: 'a', lat: 36.70, lon: -4.40 }, { id: 'b', lat: 36.71, lon: -4.41 }, { id: 'c', lat: 40.4, lon: -3.7 },
    ];
    const center = { lat: 36.7, lon: -4.4 };
    expect(pickCells(places, center).size).toBe(2);
    const s = await scorePlaces(places, center, load, new Date('2026-10-09T10:00:00Z'));
    expect(calls).toBe(2);
    expect(Object.keys(s).sort()).toEqual(['a', 'b', 'c']);
    expect(s.a).toBeGreaterThan(0);
    expect(s.a).toBeLessThanOrEqual(100);
  });
});
