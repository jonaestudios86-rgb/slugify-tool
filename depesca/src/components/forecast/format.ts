export const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));

export const f1 = (n: number | null | undefined, d = 1) => (n == null || !Number.isFinite(n) ? '–' : n.toFixed(d));

const MOONS = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
export const moonEmoji = (phase: number) => MOONS[Math.round(phase * 8) % 8];

export function weekday(date: string, index: number): string {
  if (index === 0) return 'Hoy';
  const [y, m, d] = date.split('-').map(Number);
  const s = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-ES', { weekday: 'short', timeZone: 'UTC' });
  return s.charAt(0).toUpperCase() + s.slice(1).replace('.', '');
}

export const dm = (date: string) => `${Number(date.slice(8, 10))}/${Number(date.slice(5, 7))}`;

export function ago(ms: number, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - ms) / 60_000));
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
}

export const pad = (h: number) => `${String(h).padStart(2, '0')}:00`;
