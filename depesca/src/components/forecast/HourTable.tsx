import { useRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, Polygon, Polyline, Text as SvgText } from 'react-native-svg';
import type { DayForecast } from '../../lib/forecast';
import { compass } from '../../lib/geo';
import { LEVEL_COLOR, scoreLevel } from '../../lib/score';
import { colors, ui } from '../theme';
import { f1 } from './format';

const COL = 54;
const LABEL_W = 84;
const NOW_BG = 'rgba(46,196,182,0.28)';
const SEL_BG = 'rgba(244,185,66,0.30)';
const BEST_BG = 'rgba(34,197,94,0.14)';

type Row = { k: string; label: string; unit?: string; h: number; section?: boolean };
const ROWS: Row[] = [
  { k: 'score', label: 'Punt.', h: 50 },
  { k: 's1', label: 'Mar', h: 30, section: true },
  { k: 'wave', label: 'Olas', unit: 'm', h: 50 },
  { k: 'series', label: 'Series hasta', unit: 'm', h: 46 },
  { k: 'period', label: 'Per. ola', unit: 's', h: 46 },
  { k: 'wdir', label: 'Dir. ola', h: 40 },
  { k: 'cur', label: 'Corriente', unit: 'm/s', h: 46 },
  { k: 'cdir', label: 'Dir. Corr.', h: 40 },
  { k: 'sea', label: 'Agua', h: 40 },
  { k: 's2', label: 'Viento', h: 30, section: true },
  { k: 'wind', label: 'Velocidad', unit: 'km/h', h: 46 },
  { k: 'dir', label: 'Dir', h: 40 },
  { k: 'gust', label: 'Rachas', unit: 'km/h', h: 46 },
  { k: 's3', label: 'Cielo', h: 30, section: true },
  { k: 'temp', label: 'Temp', h: 40 },
  { k: 'press', label: 'Presión', unit: 'hPa', h: 70 },
  { k: 'cloud', label: 'Nubes', h: 40 },
  { k: 'rain', label: 'Lluvia', unit: 'mm', h: 46 },
  { k: 'prob', label: 'Prob. lluvia', h: 40 },
];

function Arrow({ deg, travel = false }: { deg: number | null; travel?: boolean }) {
  if (deg == null) return <Text style={ui.muted}>–</Text>;
  const rot = travel ? deg : (deg + 180) % 360; // arrow shows where it is heading
  return (
    <View style={ui.row}>
      <Text style={{ color: colors.muted, fontSize: 13, transform: [{ rotate: `${rot}deg` }], marginRight: 3 }}>↑</Text>
      <Text style={{ color: colors.muted, fontSize: 12 }}>{compass(deg)}</Text>
    </View>
  );
}

export function HourTable({ day, nowKey, selectedHour, onPickHour }: { day: DayForecast; nowKey: string; selectedHour?: number; onPickHour?: (hour: number) => void }) {
  const scroller = useRef<ScrollView>(null);
  const nowIdx = day.hours.findIndex((h) => h.point.time === nowKey);
  const press = day.hours.map((h) => h.point.pressureHpa);
  const pv = press.filter((v): v is number => v != null);
  const pMin = pv.length ? Math.min(...pv) : 0;
  const pMax = pv.length ? Math.max(...pv) : 1;
  const y = (v: number) => 24 + (1 - (v - pMin) / (pMax - pMin || 1)) * 22;
  const pts = press.map((v, i) => (v == null ? null : { x: i * COL + COL / 2, y: y(v), v }));
  const valid = pts.filter((p): p is { x: number; y: number; v: number } => p !== null);

  const bg = (hour: number, time: string) =>
    hour === selectedHour ? SEL_BG : time === nowKey ? NOW_BG : day.bestStretch && hour >= day.bestStretch.start && hour < day.bestStretch.end ? BEST_BG : undefined;

  const cell = (r: Row, h: DayForecast['hours'][number]) => {
    const p = h.point;
    const t = (s: string, dim = false) => <Text style={[ui.text, dim && { color: colors.muted }]}>{s}</Text>;
    switch (r.k) {
      case 'score': {
        const c = LEVEL_COLOR[scoreLevel(h.score)];
        return <View style={{ backgroundColor: c, borderRadius: 8, width: COL - 8, paddingVertical: 6, alignItems: 'center' }}><Text style={{ color: '#06121b', fontWeight: '800', fontSize: 15 }}>{h.score}</Text></View>;
      }
      case 'wave': return t(f1(h.waveM));
      case 'series': return t(f1(h.seriesM), true);
      case 'period': return t(f1(p.wavePeriodS, 0));
      case 'wdir': return <Arrow deg={p.waveDirDeg} />;
      case 'cur': return t(f1(p.currentMs, 2));
      case 'cdir': return <Arrow deg={p.currentDirDeg} travel />;
      case 'sea': return t(p.seaTempC == null ? '–' : `${f1(p.seaTempC)}°`);
      case 'wind': return t(f1(p.windKmh, 0));
      case 'dir': return <Arrow deg={p.windDirDeg} />;
      case 'gust': return t(f1(p.gustKmh, 0));
      case 'temp': return t(p.airTempC == null ? '–' : `${f1(p.airTempC, 0)}°`, true);
      case 'cloud': return t(p.cloudPct == null ? '–' : `${f1(p.cloudPct, 0)}%`, true);
      case 'rain': return t(f1(p.rainMm), true);
      case 'prob': return t(p.rainProbPct == null ? '–' : `${f1(p.rainProbPct, 0)}%`, true);
      default: return null;
    }
  };

  return (
    <View style={[ui.card, { padding: 0, overflow: 'hidden', minWidth: 0 }]}>
      <Text style={[ui.muted, { fontSize: 15, padding: 14, paddingBottom: 6 }]}>Detalles por Hora</Text>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: LABEL_W }}>
          <View style={{ height: 38 }} />
          {ROWS.map((r) => (
            <View key={r.k} style={{ height: r.h, justifyContent: 'center', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={r.section ? { color: colors.muted, fontSize: 13 } : { color: colors.text, fontSize: 13, fontWeight: '600', textAlign: 'center' }}>{r.label}</Text>
              {r.unit && !r.section && <Text style={{ color: colors.muted, fontSize: 11 }}>{r.unit}</Text>}
            </View>
          ))}
        </View>
        <ScrollView
          horizontal
          style={{ flex: 1, minWidth: 0 }}
          ref={scroller}
          showsHorizontalScrollIndicator={false}
          onLayout={() => scroller.current?.scrollTo({ x: Math.max(0, (nowIdx >= 0 ? nowIdx - 1 : 6) * COL), animated: false })}>
          <View style={{ width: day.hours.length * COL }}>
            <View style={{ flexDirection: 'row', height: 38, alignItems: 'center' }}>
              {day.hours.map((h) => (
                <Pressable key={h.point.time} onPress={() => onPickHour?.(h.hour)} style={{ width: COL, alignItems: 'center', height: 38, justifyContent: 'center', backgroundColor: bg(h.hour, h.point.time) }}>
                  <Text style={{ color: h.point.time === nowKey ? colors.accent : colors.text, fontWeight: '700', fontSize: 13 }}>{String(h.hour).padStart(2, '0')}h</Text>
                </Pressable>
              ))}
            </View>
            {ROWS.map((r) => (
              <View key={r.k} style={{ flexDirection: 'row', height: r.h, borderTopWidth: 1, borderTopColor: colors.border }}>
                {day.hours.map((h) => (
                  <Pressable key={h.point.time} onPress={() => onPickHour?.(h.hour)} style={{ width: COL, height: r.h, alignItems: 'center', justifyContent: 'center', backgroundColor: bg(h.hour, h.point.time) }}>
                    {r.section ? null : cell(r, h)}
                  </Pressable>
                ))}
                {r.k === 'press' && valid.length > 1 && (
                  <Svg pointerEvents="none" width={day.hours.length * COL} height={r.h} style={{ position: 'absolute', left: 0, top: 0 }}>
                    <Polygon points={`${valid[0].x},${r.h} ${valid.map((p) => `${p.x},${p.y}`).join(' ')} ${valid[valid.length - 1].x},${r.h}`} fill="rgba(143,168,186,0.18)" />
                    <Polyline points={valid.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={colors.muted} strokeWidth={2} />
                    {valid.map((p, i) => (
                      <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#e8f1f7" />
                    ))}
                    {valid.map((p, i) => (i % 2 === 0 ? <SvgText key={`t${i}`} x={p.x} y={p.y - 8} fill="#e8f1f7" fontSize={11} fontWeight="700" textAnchor="middle">{Math.round(p.v)}</SvgText> : null))}
                  </Svg>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
      <View style={[ui.row, { gap: 16, padding: 14, paddingBottom: 6 }]}>
        <View style={ui.row}><View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: NOW_BG, marginRight: 6 }} /><Text style={ui.muted}>Ahora</Text></View>
        <View style={ui.row}><View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: BEST_BG, marginRight: 6 }} /><Text style={ui.muted}>Mejor tramo del día</Text></View>
        <View style={ui.row}><View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: SEL_BG, marginRight: 6 }} /><Text style={ui.muted}>Hora elegida</Text></View>
      </View>
      <Text style={[ui.muted, { paddingHorizontal: 14, paddingBottom: 14 }]}>Ola estimada para esta costa según su orientación, no la altura de mar abierto.</Text>
    </View>
  );
}
