import { describe, expect, it } from 'vitest';
import { applyBackup, buildBackup, parseBackup } from '../backup';
import type { AlertRule, Catch, Spot } from '../types';

const spot: Spot = { id: 's1', name: 'Dique', lat: 36.7, lon: -4.4, seabed: 'roca', species: ['lubina'], techniques: [], notes: 'n', favorite: true, orientation: 180 };
const cat = (id: string, date: string, photoUri?: string): Catch => ({ id, date, species: 'Lubina', weightKg: 1.5, spotId: 's1', photoUri, notes: '' });
const rule: AlertRule = { id: 'r1', name: 'Alba', enabled: true, spotId: 's1', fishingType: '', maxWindKmh: 20, maxWaveM: 1, tide: 'rising', fromHour: 5, toHour: 9 };

describe('backup', () => {
  it('round-trips and drops device-local photo paths', () => {
    const b = buildBackup(
      { spots: [spot], catches: [cat('c1', '2026-10-01T10:00:00Z', 'file:///x.jpg'), cat('c2', '2026-10-02T10:00:00Z', 'data:image/jpeg;base64,AAA')], alerts: [rule] },
      new Date('2026-10-09T00:00:00Z'),
    );
    expect(b.catches[0].photoUri).toBeUndefined();
    expect(b.catches[1].photoUri).toBe('data:image/jpeg;base64,AAA');
    const r = parseBackup(JSON.stringify(b));
    expect(r.ok && r.skipped).toBe(0);
    expect(r.ok && r.backup.spots[0]).toEqual(spot);
    expect(r.ok && r.backup.alerts[0]).toEqual(rule);
  });
  it('rejects garbage and foreign files', () => {
    expect(parseBackup('no json').ok).toBe(false);
    expect(parseBackup('{"app":"otra"}')).toMatchObject({ ok: false });
    expect(parseBackup('{"app":"depesca","version":2}')).toMatchObject({ ok: false });
    expect(parseBackup('[]').ok).toBe(false);
  });
  it('drops invalid records and counts them', () => {
    const r = parseBackup(JSON.stringify({
      app: 'depesca', version: 1,
      spots: [spot, { id: 'x', name: 'mal', lat: 999, lon: 0 }, null, 'str'],
      catches: [cat('c1', '2026-10-01T10:00:00Z'), { id: 'c', species: 'x', weightKg: 'pesado', date: '2026-10-01' }, cat('c3', 'no-fecha')],
      alerts: [rule, { id: 'r' }],
    }));
    expect(r.ok && [r.backup.spots.length, r.backup.catches.length, r.backup.alerts.length, r.skipped]).toEqual([1, 1, 1, 6]);
  });
  it('normalises odd field values', () => {
    const r = parseBackup(JSON.stringify({ app: 'depesca', version: 1, spots: [{ id: 'a', name: 'A', lat: 1, lon: 1, seabed: 'lava', species: [1, 'x'] }] }));
    expect(r.ok && r.backup.spots[0]).toMatchObject({ seabed: 'mixto', species: ['x'], favorite: false, notes: '' });
  });
  it('merges by id with the file winning, or replaces', () => {
    const cur = { spots: [spot], catches: [cat('c1', '2026-10-01T10:00:00Z')], alerts: [rule] };
    const inc = { spots: [{ ...spot, name: 'Nuevo' }, { ...spot, id: 's2' }], catches: [cat('c2', '2026-10-05T10:00:00Z')], alerts: [] };
    const m = applyBackup(cur, inc, 'merge');
    expect(m.spots.map((s) => s.name)).toEqual(['Nuevo', 'Dique']);
    expect(m.catches.map((c) => c.id)).toEqual(['c2', 'c1']);
    expect(m.alerts).toHaveLength(1);
    expect(applyBackup(cur, inc, 'replace')).toEqual(inc);
  });
});
