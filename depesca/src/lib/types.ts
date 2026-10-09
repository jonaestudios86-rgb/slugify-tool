export type Seabed = 'arena' | 'roca' | 'fango' | 'posidonia' | 'mixto';

export interface Spot {
  id: string;
  name: string;
  lat: number;
  lon: number;
  seabed: Seabed;
  species: string[];
  techniques: string[];
  notes: string;
  favorite: boolean;
  /** Compass bearing (deg) the coast faces, towards the open sea. Used to estimate nearshore waves. */
  orientation?: number;
}

export interface Catch {
  id: string;
  date: string; // ISO
  species: string;
  weightKg: number;
  lengthCm?: number;
  spotId?: string;
  photoUri?: string;
  notes: string;
}

export type TidePhase = 'any' | 'rising' | 'falling';

export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  spotId: string;
  /** Free label, e.g. "spinning", "fondo", "surfcasting". */
  fishingType: string;
  maxWindKmh: number;
  maxWaveM: number;
  minPressureHpa?: number;
  tide: TidePhase;
  /** Only consider hours between these local hours (inclusive start, exclusive end). */
  fromHour: number;
  toHour: number;
}

/** One hour of merged marine + weather data. `time` is local ISO without zone ("2026-10-09T14:00"). */
export interface HourPoint {
  time: string;
  waveM: number | null;
  wavePeriodS: number | null;
  /** Direction the waves come FROM, degrees. */
  waveDirDeg: number | null;
  swellM: number | null;
  currentMs: number | null;
  /** Direction the current flows TOWARDS, degrees. */
  currentDirDeg: number | null;
  seaTempC: number | null;
  seaLevelM: number | null;
  windKmh: number | null;
  /** Direction the wind comes FROM, degrees. */
  windDirDeg: number | null;
  gustKmh: number | null;
  airTempC: number | null;
  pressureHpa: number | null;
  cloudPct: number | null;
  rainMm: number | null;
  rainProbPct: number | null;
}

export interface TideEvent {
  time: string;
  type: 'high' | 'low';
  levelM: number;
}

export interface AlertWindow {
  start: string;
  end: string;
}
