import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { hm } from '../../lib/conditions';
import { factorDetails } from '../../lib/factorDetail';
import type { DayForecast, Forecast, HourDetail } from '../../lib/forecast';
import { compass, ORIENTATIONS } from '../../lib/geo';
import { castDistance, candidateSpecies } from '../../lib/plan';
import type { Shop } from '../../lib/places';
import { explainScore, factorColor, LEVEL_COLOR, LEVEL_LABEL, scoreLevel, type Factors } from '../../lib/score';
import { catchStats } from '../../lib/stats';
import type { Catch, Spot } from '../../lib/types';
import { Accordion } from '../Accordion';
import { Btn, Chip } from '../Btn';
import { colors, ui } from '../theme';
import { ago, dm, f1, moonEmoji, pad, stars, weekday } from './format';

export function Header({ spot, tz, onNavigate, onAlert, onFavorite, onShare, onClose }: {
  spot: Spot; tz: string; onNavigate: () => void; onAlert: () => void; onFavorite: () => void; onShare: () => void; onClose: () => void;
}) {
  const Icon = ({ glyph, onPress, label, color }: { glyph: string; onPress: () => void; label: string; color?: string }) => (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={8} style={{ paddingHorizontal: 7 }}>
      <Text style={{ color: color ?? colors.muted, fontSize: 21 }}>{glyph}</Text>
    </Pressable>
  );
  return (
    <View style={[ui.row, { justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 }]}>
      <View style={{ flex: 1, paddingRight: 6 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>{spot.name}</Text>
        <Text style={ui.muted}>🕒 {tz === 'Europe/Madrid' ? 'Hora de España' : tz === 'Atlantic/Canary' ? 'Hora de Canarias' : `Hora local · ${tz}`}</Text>
      </View>
      <View style={ui.row}>
        <Icon glyph="➤" onPress={onNavigate} label="Cómo llegar" />
        <Icon glyph="🔔" onPress={onAlert} label="Alertas" />
        <Icon glyph={spot.favorite ? '♥' : '♡'} onPress={onFavorite} label="Favorito" color={spot.favorite ? colors.danger : undefined} />
        <Icon glyph="⤴" onPress={onShare} label="Compartir" />
        <Icon glyph="✕" onPress={onClose} label="Cerrar" />
      </View>
    </View>
  );
}

export function ScoreBlock({ day, fetchedAt, stale, onFish, onNavigate, onRefresh }: {
  day: DayForecast; fetchedAt: number; stale: boolean; onFish: () => void; onNavigate: () => void; onRefresh: () => void;
}) {
  const h = day.headline;
  const color = LEVEL_COLOR[h.level];
  return (
    <View style={{ paddingHorizontal: 12 }}>
      <View style={[ui.row, { gap: 14, marginVertical: 10 }]}>
        <View style={{ width: 5, height: 70, borderRadius: 3, backgroundColor: color }} />
        <Text style={{ color: colors.text, fontSize: 62, fontWeight: '800', lineHeight: 70 }}>{h.score}</Text>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ alignSelf: 'flex-start', backgroundColor: color, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 }}>
            <Text style={{ color: '#06121b', fontWeight: '800', fontSize: 16 }}>{LEVEL_LABEL[h.level]}</Text>
          </View>
          <Pressable onPress={onRefresh} accessibilityLabel="Actualizar" hitSlop={8}>
            <Text style={ui.muted}>🕒 {stale ? 'Datos guardados' : 'Actualizado'} {ago(fetchedAt)}  <Text style={{ color: colors.accent }}>↻ Actualizar</Text></Text>
          </Pressable>
          {day.bestHour != null && <Text style={ui.muted}>⏱ Mejor hora: <Text style={{ color: colors.text, fontWeight: '700' }}>{pad(day.bestHour)}</Text></Text>}
        </View>
      </View>
      <View style={[ui.row, { gap: 10, marginBottom: 12 }]}>
        <Btn label="🐟  Pescar aquí" onPress={onFish} style={{ flex: 1, paddingVertical: 14 }} />
        <Btn ghost label="➤" onPress={onNavigate} style={{ paddingVertical: 14 }} />
      </View>
    </View>
  );
}

export function DayPicker({ forecast, index, onPick }: { forecast: Forecast; index: number; onPick: (i: number) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }} style={{ flexGrow: 0, marginBottom: 12 }}>
      {forecast.days.map((d, i) => (
        <Pressable key={d.date} onPress={() => onPick(i)} style={[{ width: 104, borderRadius: 12, backgroundColor: colors.card, borderTopWidth: 4, borderTopColor: LEVEL_COLOR[d.dayLevel], padding: 10, borderWidth: 1, borderColor: i === index ? colors.accent : colors.border }]}>
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <Text style={ui.text}>{weekday(d.date, i)}</Text>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18 }}>{d.dayScore}</Text>
          </View>
          <Text style={ui.muted}>{dm(d.date)}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function Metric({ icon, value, label, factor, sub }: { icon: string; value: string; label: string; factor?: number; sub?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 2 }}>
      <Text style={{ fontSize: 22 }}>{icon}</Text>
      <View style={{ width: 28, height: 4, borderRadius: 2, marginVertical: 6, backgroundColor: factor == null ? colors.border : factorColor(factor) }} />
      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', textAlign: 'center' }}>{value}</Text>
      <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>{label}</Text>
      {sub && <Text style={{ color: colors.muted, fontSize: 11, textAlign: 'center' }}>{sub}</Text>}
    </View>
  );
}

export function Metrics({ day, spot, hour }: { day: DayForecast; spot: Spot; hour?: HourDetail | null }) {
  const ref = (hour ?? day.headline.ref)?.point;
  const f = (hour ?? day.headline.ref)?.factors ?? day.headline.factors;
  const sea = `${f1(day.seaMinM)}-${f1(day.seaMaxM)} m`;
  return (
    <View style={{ paddingHorizontal: 12, marginBottom: 6 }}>
      <View style={{ flexDirection: 'row', marginBottom: 10 }}>
        <Metric icon="⚓" value={String(day.coefficient.value)} label="Mareas" factor={f.tide} />
        <Metric icon="💨" value={`${f1(ref?.windKmh, 0)} km/h`} label="Viento" factor={f.wind} />
        <Metric icon="🌊" value={sea} label="Estado del mar (est.)" factor={f.sea} />
        <Metric icon={moonEmoji(day.solunar.moon.phase)} value={`${Math.round(day.solunar.moon.fraction * 100)}%`} label={day.solunar.moon.waxing ? 'Creciente' : 'Menguante'} factor={f.moon} />
      </View>
      <Text style={[ui.muted, { textAlign: 'center' }]}>Mar abierto: {f1(day.openSeaM)} m</Text>
      <Text style={[ui.muted, { textAlign: 'center', marginBottom: 12 }]}>Series hasta {f1(day.seriesMaxM)} m</Text>
      <View style={{ flexDirection: 'row', paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
        <Metric icon="⏲" value={f1(ref?.pressureHpa, 0)} label="hPa" factor={f.pressure} />
        <Metric icon="🌡" value={ref?.seaTempC == null ? '–' : `${f1(ref.seaTempC)}°`} label="Temp. agua" />
        <Metric icon="🧭" value={spot.orientation == null ? '–' : compass(spot.orientation)} label="Orientación" sub={spot.orientation == null ? 'Defínela en el spot' : undefined} />
        <View style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const FACTOR_NAMES: Record<keyof Factors, string> = { sea: 'Mar', wind: 'Viento', tide: 'Marea', light: 'Luz', pressure: 'Presión', moon: 'Luna', rain: 'Lluvia' };

export function WhyScore({ day, hour, utcOffsetSec }: { day: DayForecast; hour: HourDetail; utcOffsetSec: number }) {
  const f = hour.factors;
  const d = factorDetails(day, hour, utcOffsetSec);
  return (
    <Accordion title={`¿Por qué esta puntuación? · ${pad(hour.hour)}`} defaultOpen>
      <Text style={{ color: colors.text, fontSize: 20, marginBottom: 4 }}>{explainScore(hour.score, f)}</Text>
      <Text style={[ui.muted, { marginBottom: 10 }]}>Hora {pad(hour.hour)} · puntuación {hour.score}. Toca otra hora en la tabla de abajo para cambiarla.</Text>
      {(Object.keys(FACTOR_NAMES) as (keyof Factors)[]).map((k) => (
        <View key={k} style={{ marginBottom: 9 }}>
          <View style={ui.row}>
            <Text style={[ui.muted, { width: 64 }]}>{FACTOR_NAMES[k]}</Text>
            <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border }}>
              <View style={{ width: `${Math.round(f[k])}%`, height: 6, borderRadius: 3, backgroundColor: factorColor(f[k]) }} />
            </View>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14, width: 128, textAlign: 'right' }}>{d[k].value}</Text>
          </View>
          {!!d[k].sub && <Text style={{ color: colors.muted, fontSize: 12, marginLeft: 64, marginTop: 2 }}>{d[k].sub}</Text>}
        </View>
      ))}
    </Accordion>
  );
}

export function ZoneInfo({ spot }: { spot: Spot }) {
  const o = ORIENTATIONS.find((x) => x.deg === spot.orientation)?.label ?? (spot.orientation != null ? compass(spot.orientation) : 'sin definir');
  return (
    <Accordion title="Info de la zona">
      <Text style={ui.text}>Fondo: {spot.seabed}</Text>
      <Text style={ui.text}>Orientación de la costa: {o}</Text>
      <Text style={ui.text}>Coordenadas: {spot.lat.toFixed(4)}, {spot.lon.toFixed(4)}</Text>
      {!!spot.species.length && <Text style={ui.text}>Especies: {spot.species.join(', ')}</Text>}
      {!!spot.techniques.length && <Text style={ui.text}>Técnicas: {spot.techniques.join(', ')}</Text>}
      {!!spot.notes && <Text style={[ui.muted, { marginTop: 4 }]}>{spot.notes}</Text>}
    </Accordion>
  );
}

export function PlanCard({ day }: { day: DayForecast }) {
  return (
    <Accordion title="Plan de pesca" defaultOpen>
      {!day.plan.length && <Text style={ui.muted}>No quedan tramos con buenas condiciones para este día.</Text>}
      {day.plan.map((p, i) => (
        <View key={p.role} style={{ paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>{pad(p.startHour).slice(0, 5)} - {pad(p.endHour % 24).slice(0, 5)}</Text>
            <Text style={{ color: i === 0 ? colors.text : colors.muted, fontSize: 14 }}>{p.role}</Text>
          </View>
          <Text style={{ color: colors.text, fontSize: 16, marginVertical: 6 }}>{p.species} · {p.technique} · {p.lure}</Text>
          <Text style={ui.muted}>{p.reason}</Text>
        </View>
      ))}
      {day.plan.length > 1 && <Text style={[ui.muted, { marginTop: 6 }]}>Cambio recomendado si no hay picadas en la ventana principal.</Text>}
    </Accordion>
  );
}

export function ShopsSection({ shops, loading, error, onOpen, onShop }: { shops: Shop[] | null; loading: boolean; error: boolean; onOpen: () => void; onShop: (s: Shop) => void }) {
  return (
    <Accordion title="Tiendas de pesca cerca" onOpen={onOpen}>
      {loading && <Text style={ui.muted}>Buscando…</Text>}
      {error && <Text style={{ color: colors.danger }}>No se pudieron cargar las tiendas. Revisa la conexión.</Text>}
      {shops && !shops.length && <Text style={ui.muted}>No hay tiendas registradas a menos de 25 km (datos de OpenStreetMap).</Text>}
      {shops?.map((s) => (
        <Pressable key={s.id} onPress={() => onShop(s)} style={[ui.row, { justifyContent: 'space-between', paddingVertical: 8 }]}>
          <Text style={[ui.text, { flex: 1 }]}>{s.name}</Text>
          <Text style={{ color: colors.accent }}>{f1(s.distanceKm)} km ➤</Text>
        </Pressable>
      ))}
    </Accordion>
  );
}

const Card = ({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) => (
  <View style={[ui.card, { padding: 16, marginHorizontal: 12 }]}>
    <View style={[ui.row, { justifyContent: 'space-between', marginBottom: 10 }]}>
      <Text style={{ color: colors.muted, fontSize: 20 }}>{title}</Text>
      {right}
    </View>
    {children}
  </View>
);

export function TideCard({ day }: { day: DayForecast }) {
  const c = day.coefficient;
  const pct = ((c.value - 20) / 100) * 100;
  return (
    <Card title="Coeficiente">
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: '600' }}>〰 {c.title}  {c.value}</Text>
      <Text style={{ color: colors.muted, fontSize: 18, marginTop: 2 }}>{c.verdict}</Text>
      {day.tideRangeM != null && <Text style={{ color: colors.muted, fontSize: 18 }}>Recorrido: {f1(day.tideRangeM)} m</Text>}
      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.bg, marginTop: 10 }}>
        <View style={{ width: `${pct}%`, height: 6, borderRadius: 3, backgroundColor: colors.text }} />
      </View>
      <View style={{ height: 18, marginVertical: 6 }}>
        {[20, 60, 80, 120].map((n) => (
          <Text key={n} style={[ui.muted, { position: 'absolute', width: 30, textAlign: n === 20 ? 'left' : n === 120 ? 'right' : 'center', left: n === 20 ? 0 : n === 120 ? undefined : `${n - 20}%`, right: n === 120 ? 0 : undefined, marginLeft: n === 20 || n === 120 ? 0 : -15 }]}>{n}</Text>
        ))}
      </View>
      {day.tides.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {day.tides.map((e) => (
            <View key={e.time} style={{ width: '48%', backgroundColor: '#0a1a28', borderRadius: 16, paddingVertical: 20, alignItems: 'center', gap: 6 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: e.type === 'high' ? '#e8f1f7' : '#8fa8ba', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#0b1d2a', fontSize: 26, fontWeight: '800', lineHeight: 30 }}>{e.type === 'high' ? '↑' : '↓'}</Text>
              </View>
              <Text style={{ color: colors.text, fontSize: 28, fontWeight: '600' }}>{e.time.slice(11, 16)}</Text>
              <Text style={{ color: colors.muted, fontSize: 18 }}>{f1(e.levelM)}m</Text>
              <Text style={{ color: colors.muted, fontSize: 18 }}>{e.type === 'high' ? 'Marea alta' : 'Marea baja'}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={ui.muted}>Sin datos de marea para este día.</Text>
      )}
      <Text style={[ui.muted, { marginTop: 10 }]}>Alturas sobre el nivel medio del mar según el modelo (no sobre el cero hidrográfico); el coeficiente es una estimación. Contrasta con las tablas oficiales.</Text>
    </Card>
  );
}

export function SolunarCard({ day, utcOffsetSec, nowKey }: { day: DayForecast; utcOffsetSec: number; nowKey: string }) {
  const s = day.solunar;
  const t = (d?: Date) => hm(d, utcOffsetSec);
  const isToday = nowKey.startsWith(day.date);
  const nowMs = isToday ? Date.UTC(+nowKey.slice(0, 4), +nowKey.slice(5, 7) - 1, +nowKey.slice(8, 10), +nowKey.slice(11, 13)) - utcOffsetSec * 1000 : null;
  const starts = (start: Date) => {
    if (nowMs == null || start.getTime() <= nowMs) return null;
    const m = Math.round((start.getTime() - nowMs) / 60_000);
    return `Empieza en ${Math.floor(m / 60)}h ${m % 60}m`;
  };
  const barColor = (n: number) => (n >= 4 ? '#22c55e' : n === 3 ? '#f59e0b' : colors.muted);
  return (
    <Card title="Tabla Solunar" right={<Text style={{ color: colors.text, fontSize: 20 }}>{stars(s.stars)}</Text>}>
      <View style={[ui.row, { gap: 14, marginBottom: 14 }]}>
        <Text style={{ fontSize: 40 }}>{moonEmoji(s.moon.phase)}</Text>
        <View>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>{s.moon.name}</Text>
          <Text style={ui.muted}>{Math.round(s.moon.fraction * 100)}% iluminación</Text>
        </View>
      </View>
      <View style={[ui.row, { justifyContent: 'space-between', marginBottom: 14 }]}>
        <View><Text style={ui.muted}>🌅 Amanecer / Atardecer</Text><Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{t(s.sunrise)} / {t(s.sunset)}</Text></View>
        <View><Text style={ui.muted}>🌙 Sale / Se pone</Text><Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{t(s.moonrise)} / {t(s.moonset)}</Text></View>
      </View>
      <Text style={[ui.muted, { fontSize: 15, marginBottom: 6 }]}>Períodos de actividad</Text>
      {s.periods.map((p, i) => (
        <View key={p.label} style={{ flexDirection: 'row', gap: 10, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
          <View style={{ width: 4, borderRadius: 2, backgroundColor: barColor(p.stars) }} />
          <View style={{ flex: 1 }}>
            <View style={[ui.row, { justifyContent: 'space-between' }]}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{p.kind === 'major' ? 'Mayor' : 'Menor'} {starts(p.start) && <Text style={[ui.muted, { fontWeight: '400' }]}>  {starts(p.start)}</Text>}</Text>
              <Text style={{ color: colors.text }}>{stars(p.stars)}</Text>
            </View>
            <Text style={ui.muted}>{p.label}</Text>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 4 }}>🕒 {t(p.start)} - {t(p.end)}</Text>
          </View>
        </View>
      ))}
      {!s.periods.length && <Text style={ui.muted}>La luna no cruza el horizonte ni el meridiano en este día.</Text>}
      {!!s.best.length && (
        <>
          <Text style={[ui.muted, { fontSize: 15, marginTop: 14, marginBottom: 6 }]}>Mejores momentos</Text>
          {s.best.map((b) => (
            <Text key={b.label} style={[ui.text, { paddingVertical: 3 }]}>{t(b.center)} - {b.label}  <Text style={{ color: colors.warn }}>{'★'.repeat(b.stars)}</Text></Text>
          ))}
        </>
      )}
    </Card>
  );
}

export function SpeciesCard({ spot, day }: { spot: Spot; day: DayForecast }) {
  const list = candidateSpecies(spot);
  const [id, setId] = useState(list[0].id);
  const sp = list.find((s) => s.id === id) ?? list[0];
  const [lo, hi] = castDistance(sp, day.seaMaxM);
  return (
    <Card title="Especie objetivo">
      <Text style={[ui.muted, { marginBottom: 8 }]}>Elige el pez que quieres pescar para ver la distancia de lance recomendada.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
        {list.map((s) => <Chip key={s.id} label={s.name} on={s.id === sp.id} onPress={() => setId(s.id)} />)}
      </ScrollView>
      <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800' }}>{lo}-{hi} m</Text>
      <Text style={ui.muted}>Ajustada al oleaje previsto ({f1(day.seaMaxM)} m). Es una referencia orientativa: afínala con tu experiencia.</Text>
    </Card>
  );
}

export function HistoryCard({ spot, catches }: { spot: Spot; catches: Catch[] }) {
  const here = catches.filter((c) => c.spotId === spot.id);
  const stats = catchStats(here);
  return (
    <>
      <Card title="Tus especies en esta zona">
        {!here.length && <Text style={ui.muted}>Aún no has registrado capturas aquí. Usa “Pescar aquí”.</Text>}
        {stats.bySpecies.slice(0, 5).map((s) => (
          <View key={s.species} style={[ui.row, { justifyContent: 'space-between', paddingVertical: 6 }]}>
            <View>
              <Text style={{ color: colors.text, fontSize: 16, textTransform: 'capitalize' }}>{s.species}</Text>
              <Text style={ui.muted}>{s.count} {s.count === 1 ? 'captura' : 'capturas'}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', width: 110 }}>
              <Text style={{ color: colors.text }}>{Math.round((s.count / stats.total) * 100)}%</Text>
              <View style={{ width: 110, height: 4, borderRadius: 2, backgroundColor: colors.bg }}>
                <View style={{ width: `${Math.round((s.count / stats.total) * 100)}%`, height: 4, borderRadius: 2, backgroundColor: colors.muted }} />
              </View>
            </View>
          </View>
        ))}
      </Card>
      <Card title="Tu historial en esta zona">
        {!here.length && <Text style={ui.muted}>Tus capturas en este spot aparecerán aquí.</Text>}
        {here.slice(0, 5).map((c) => (
          <Text key={c.id} style={[ui.text, { paddingVertical: 4 }]}>
            {new Date(c.date).toLocaleDateString('es-ES')} · {c.species} · {c.weightKg} kg{c.lengthCm ? ` · ${c.lengthCm} cm` : ''}
          </Text>
        ))}
        {here.length > 5 && <Text style={ui.muted}>y {here.length - 5} más en la pestaña Capturas</Text>}
      </Card>
    </>
  );
}
