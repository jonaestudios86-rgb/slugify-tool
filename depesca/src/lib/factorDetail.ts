import { hm } from './conditions';
import type { DayForecast, HourDetail } from './forecast';
import { compass } from './geo';
import type { Factors } from './score';

export interface FactorDetail {
  value: string;
  sub?: string;
}

const n = (v: number | null | undefined, d = 0) => (v == null || !Number.isFinite(v) ? '–' : v.toFixed(d));
const range = (xs: (number | null)[], d = 0) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? `${Math.min(...v).toFixed(d)}–${Math.max(...v).toFixed(d)}` : '–';
};

/** Real numbers behind each 0-100 factor bar, for the selected hour and the whole day. */
export function factorDetails(day: DayForecast, hour: HourDetail, utcOffsetSec: number): Record<keyof Factors, FactorDetail> {
  const p = hour.point;
  const all = day.hours.map((h) => h.point);
  const i = day.hours.indexOf(hour);
  const before = i >= 3 ? day.hours[i - 3].point.pressureHpa : null;
  const trend = p.pressureHpa != null && before != null ? p.pressureHpa - before : null;
  const trendText = trend == null ? '' : ` · ${trend > 0.5 ? '↑ sube' : trend < -0.5 ? '↓ baja' : '→ estable'} ${trend > 0 ? '+' : ''}${trend.toFixed(1)} en 3 h`;
  const tides = day.tides.map((t) => `${t.type === 'high' ? 'Pleamar' : 'Bajamar'} ${t.time.slice(11, 16)}`).join(' · ');
  const rainDay = all.reduce((s, x) => s + (x.rainMm ?? 0), 0);

  return {
    sea: {
      value: `${n(hour.waveM, 1)} m`,
      sub: `Series ${n(hour.seriesM, 1)} m · periodo ${n(p.wavePeriodS)} s · día ${range(day.hours.map((h) => h.waveM), 1)} m`,
    },
    wind: {
      value: `${n(p.windKmh)} km/h ${compass(p.windDirDeg)}`.trim(),
      sub: `Rachas ${n(p.gustKmh)} km/h · día ${range(all.map((x) => x.windKmh))} km/h`,
    },
    tide: { value: `Coef. ${day.coefficient.value}`, sub: tides || day.coefficient.verdict },
    light: { value: `${hm(day.solunar.sunrise, utcOffsetSec)} – ${hm(day.solunar.sunset, utcOffsetSec)}`, sub: 'Amanecer – atardecer' },
    pressure: { value: `${n(p.pressureHpa)} hPa`, sub: `Día ${range(all.map((x) => x.pressureHpa))} hPa${trendText}` },
    moon: {
      value: `${Math.round(day.solunar.moon.fraction * 100)}% ${day.solunar.moon.waxing ? 'creciente' : 'menguante'}`,
      sub: `Sale ${hm(day.solunar.moonrise, utcOffsetSec)} · se pone ${hm(day.solunar.moonset, utcOffsetSec)}`,
    },
    rain: {
      value: `${n(p.rainProbPct)}% · ${n(p.rainMm, 1)} mm`,
      sub: `Nubes ${n(p.cloudPct)}% · lluvia del día ${rainDay.toFixed(1)} mm`,
    },
  };
}
