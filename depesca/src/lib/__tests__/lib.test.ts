import { describe, expect, it } from 'vitest';
import { alertWindows } from '../alerts';
import { mergeConditions } from '../conditions';
import { catchStats } from '../stats';
import { tideEvents, tidePhaseAt } from '../tides';
import type { AlertRule, Catch, HourPoint } from '../types';

const pt = (h: number, o: Partial<HourPoint> = {}): HourPoint => ({
  time: `2026-10-09T${String(h).padStart(2, '0')}:00`,
  waveM: 0.5, wavePeriodS: 5, waveDirDeg: 180, swellM: 0.3, currentMs: 0.1, currentDirDeg: 90,
  seaTempC: 20, seaLevelM: 0, windKmh: 9, windDirDeg: 90, gustKmh: 14, airTempC: 20,
  pressureHpa: 1015, cloudPct: 10, rainMm: 0, rainProbPct: 0,
  ...o,
});

const rule: AlertRule = {
  id: 'r', name: 'r', enabled: true, spotId: 's', fishingType: 'fondo',
  maxWindKmh: 18, maxWaveM: 1, tide: 'any', fromHour: 0, toHour: 24,
};

describe('tides', () => {
  const levels = [0, 0.2, 0.4, 0.3, 0.1, -0.1, 0.0, 0.2];
  const pts = levels.map((l, i) => pt(i, { seaLevelM: l }));
  it('finds highs and lows', () => {
    expect(tideEvents(pts).map((e) => [e.time.slice(11, 13), e.type])).toEqual([
      ['02', 'high'],
      ['05', 'low'],
    ]);
  });
  it('reports phase', () => {
    expect(tidePhaseAt(pts, 1)).toBe('rising');
    expect(tidePhaseAt(pts, 3)).toBe('falling');
  });
});

describe('alertWindows', () => {
  it('groups consecutive matching hours and skips the past', () => {
    const pts = [pt(6), pt(7), pt(8, { windKmh: 45 }), pt(9), pt(10)];
    expect(alertWindows(pts, rule, '2026-10-09T07:00')).toEqual([
      { start: '2026-10-09T07:00', end: '2026-10-09T07:00' },
      { start: '2026-10-09T09:00', end: '2026-10-09T10:00' },
    ]);
  });
  it('honours tide phase and hour range', () => {
    const pts = [0, 1, 2, 1, 0].map((l, i) => pt(i + 5, { seaLevelM: l }));
    const w = alertWindows(pts, { ...rule, tide: 'rising', fromHour: 5, toHour: 7 }, '2026-10-09T00:00');
    expect(w).toEqual([{ start: '2026-10-09T05:00', end: '2026-10-09T06:00' }]);
  });
  it('rejects missing data and low pressure', () => {
    const pts = [pt(6, { windKmh: null }), pt(7, { pressureHpa: 1000 })];
    expect(alertWindows(pts, { ...rule, minPressureHpa: 1010 }, '2026-10-09T00:00')).toEqual([]);
  });
});

describe('mergeConditions', () => {
  it('joins by timestamp', () => {
    const out = mergeConditions(
      { hourly: { time: ['a', 'b'], wave_height: [1, null], ocean_current_velocity: [3.6, 7.2], sea_surface_temperature: [18, 18], sea_level_height_msl: [0.1, 0.2] } },
      { hourly: { time: ['b'], wind_speed_10m: [13], wind_direction_10m: [180], pressure_msl: [1012] } },
    );
    expect(out[0].windKmh).toBeNull();
    expect(out[0].wavePeriodS).toBeNull();
    expect(out[0].currentMs).toBeCloseTo(1);
    expect(out[1]).toMatchObject({ waveM: null, windKmh: 13, pressureHpa: 1012 });
  });
});

describe('catchStats', () => {
  const c = (species: string, weightKg: number, spotId?: string): Catch => ({
    id: species + weightKg, date: '2026-10-09T00:00:00Z', species, weightKg, spotId, notes: '',
  });
  it('aggregates', () => {
    const s = catchStats([c('Lubina', 2, 'a'), c('lubina', 1, 'a'), c('Dorada', 3.5, 'b')]);
    expect(s.total).toBe(3);
    expect(s.totalKg).toBe(6.5);
    expect(s.biggest?.species).toBe('Dorada');
    expect(s.bySpecies[0]).toEqual({ species: 'lubina', count: 2, kg: 3 });
    expect(s.bySpot[0]).toEqual({ spotId: 'a', count: 2 });
  });
  it('handles empty', () => {
    expect(catchStats([])).toMatchObject({ total: 0, biggest: null });
  });
});

describe('imported places', () => {
  it('derives defaults from type and surface', async () => {
    const { placeDefaults } = await import('../places');
    expect(placeDefaults('beach', 'sand').seabed).toBe('arena');
    expect(placeDefaults('beach', 'pebbles').seabed).toBe('mixto');
    expect(placeDefaults('breakwater').seabed).toBe('roca');
    expect(placeDefaults('pier').species).toContain('Dorada');
  });
  it('faces the sea from a coastline with land on its left', async () => {
    const { coastOrientation } = await import('../places');
    // coastline running north (land to the west) -> sea to the east
    expect(coastOrientation(36.5, -4.5, [[[36.4, -4.5], [36.6, -4.5]]])).toBe(90);
    // running east (land to the north) -> sea to the south
    expect(coastOrientation(36.5, -4.5, [[[36.5, -4.6], [36.5, -4.4]]])).toBe(180);
    expect(coastOrientation(36.5, -4.5, [])).toBeUndefined();
  });
});
