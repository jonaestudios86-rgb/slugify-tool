import type { AlertRule, Catch, Seabed, Spot } from './types';

export interface BackupData {
  spots: Spot[];
  catches: Catch[];
  alerts: AlertRule[];
}

export interface Backup extends BackupData {
  app: 'depesca';
  version: 1;
  exportedAt: string;
}

const SEABEDS: Seabed[] = ['arena', 'roca', 'fango', 'posidonia', 'mixto'];

export function buildBackup(data: BackupData, now = new Date()): Backup {
  return {
    app: 'depesca',
    version: 1,
    exportedAt: now.toISOString(),
    spots: data.spots,
    // file:// and content:// photo paths mean nothing on another device; only embedded photos survive.
    catches: data.catches.map((c) => (c.photoUri && !c.photoUri.startsWith('data:') ? { ...c, photoUri: undefined } : c)),
    alerts: data.alerts,
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string';
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter(str) : []);

function toSpot(v: unknown): Spot | null {
  if (!isObj(v) || !str(v.id) || !str(v.name) || !num(v.lat) || !num(v.lon)) return null;
  if (Math.abs(v.lat) > 90 || Math.abs(v.lon) > 180) return null;
  return {
    id: v.id, name: v.name, lat: v.lat, lon: v.lon,
    seabed: SEABEDS.includes(v.seabed as Seabed) ? (v.seabed as Seabed) : 'mixto',
    species: strs(v.species), techniques: strs(v.techniques), notes: str(v.notes) ? v.notes : '',
    favorite: v.favorite === true, orientation: num(v.orientation) ? v.orientation : undefined,
  };
}

function toCatch(v: unknown): Catch | null {
  if (!isObj(v) || !str(v.id) || !str(v.species) || !num(v.weightKg) || !str(v.date) || Number.isNaN(Date.parse(v.date))) return null;
  return {
    id: v.id, date: v.date, species: v.species, weightKg: v.weightKg, lengthCm: num(v.lengthCm) ? v.lengthCm : undefined,
    spotId: str(v.spotId) ? v.spotId : undefined, photoUri: str(v.photoUri) ? v.photoUri : undefined, notes: str(v.notes) ? v.notes : '',
  };
}

function toAlert(v: unknown): AlertRule | null {
  if (!isObj(v) || !str(v.id) || !str(v.spotId) || !num(v.maxWindKmh) || !num(v.maxWaveM)) return null;
  return {
    id: v.id, name: str(v.name) ? v.name : 'Alerta', enabled: v.enabled !== false, spotId: v.spotId,
    fishingType: str(v.fishingType) ? v.fishingType : '', maxWindKmh: v.maxWindKmh, maxWaveM: v.maxWaveM,
    minPressureHpa: num(v.minPressureHpa) ? v.minPressureHpa : undefined,
    tide: v.tide === 'rising' || v.tide === 'falling' ? v.tide : 'any',
    fromHour: num(v.fromHour) ? v.fromHour : 0, toHour: num(v.toHour) ? v.toHour : 24,
  };
}

export type ParseResult = { ok: true; backup: Backup; skipped: number } | { ok: false; error: string };

/** Validates a backup file. Records that don't fit the schema are dropped and counted, never trusted. */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'El texto no es una copia válida (JSON incorrecto).' };
  }
  if (!isObj(raw) || raw.app !== 'depesca') return { ok: false, error: 'Este archivo no es una copia de DePesca.' };
  if (raw.version !== 1) return { ok: false, error: 'La copia es de una versión que esta app no entiende.' };
  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  const inSpots = list(raw.spots), inCatches = list(raw.catches), inAlerts = list(raw.alerts);
  const spots = inSpots.map(toSpot).filter((x): x is Spot => x !== null);
  const catches = inCatches.map(toCatch).filter((x): x is Catch => x !== null);
  const alerts = inAlerts.map(toAlert).filter((x): x is AlertRule => x !== null);
  const skipped = inSpots.length - spots.length + (inCatches.length - catches.length) + (inAlerts.length - alerts.length);
  return {
    ok: true, skipped,
    backup: { app: 'depesca', version: 1, exportedAt: str(raw.exportedAt) ? raw.exportedAt : '', spots, catches, alerts },
  };
}

const mergeById = <T extends { id: string }>(current: T[], incoming: T[]): T[] => {
  const incomingIds = new Set(incoming.map((x) => x.id));
  return [...current.filter((x) => !incomingIds.has(x.id)), ...incoming];
};

/** "merge" keeps what you have and lets the file win on matching ids; "replace" swaps everything. */
export function applyBackup(current: BackupData, incoming: BackupData, mode: 'merge' | 'replace'): BackupData {
  if (mode === 'replace') return { spots: incoming.spots, catches: incoming.catches, alerts: incoming.alerts };
  return {
    spots: mergeById(current.spots, incoming.spots),
    catches: mergeById(current.catches, incoming.catches).sort((a, b) => b.date.localeCompare(a.date)),
    alerts: mergeById(current.alerts, incoming.alerts),
  };
}

export const backupFileName = (now = new Date()) => `depesca-copia-${now.toISOString().slice(0, 10)}.json`;
