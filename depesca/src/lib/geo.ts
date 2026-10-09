const COMPASS16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];

export function compass(deg: number | null | undefined): string {
  return deg == null ? '–' : COMPASS16[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

/** Smallest absolute difference between two bearings, 0..180. */
export function angleDiff(a: number, b: number): number {
  return Math.abs((((a - b) % 360) + 540) % 360 - 180);
}

const rad = (d: number) => (d * Math.PI) / 180;

/** Share of open-sea wave energy that reaches a coast facing `orientation` (deg). 0.15 floor for refraction. */
export function waveExposure(waveFromDeg: number | null, orientation: number | undefined): number {
  if (orientation == null || waveFromDeg == null) return 0.6;
  const d = angleDiff(waveFromDeg, orientation);
  return d >= 90 ? 0.15 : Math.max(0.15, Math.cos(rad(d)));
}

/** +1 wind blowing straight onto the coast, -1 straight off it. */
export function onshoreComponent(windFromDeg: number | null, orientation: number | undefined): number {
  if (orientation == null || windFromDeg == null) return 0;
  return Math.cos(rad(angleDiff(windFromDeg, orientation)));
}

export const ORIENTATIONS: { label: string; deg: number }[] = [
  { label: 'N', deg: 0 }, { label: 'NE', deg: 45 }, { label: 'E', deg: 90 }, { label: 'SE', deg: 135 },
  { label: 'S', deg: 180 }, { label: 'SO', deg: 225 }, { label: 'O', deg: 270 }, { label: 'NO', deg: 315 },
];
