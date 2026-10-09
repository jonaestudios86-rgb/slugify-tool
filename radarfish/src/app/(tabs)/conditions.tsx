import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Chip } from '../../components/Btn';
import { colors, ui } from '../../components/theme';
import { compass, fetchConditions, nowHourKey } from '../../lib/conditions';
import { selectionStore, spotsStore } from '../../lib/stores';
import { tideEvents } from '../../lib/tides';
import type { HourPoint } from '../../lib/types';

const f = (n: number | null, d = 1) => (n == null ? '–' : n.toFixed(d));
const day = (t: string) => new Date(t).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });

export default function Conditions() {
  const [spots] = spotsStore.useValue();
  const [selectedId, setSelected] = selectionStore.useValue();
  const spot = spots.find((s) => s.id === selectedId) ?? spots[0] ?? null;
  const [points, setPoints] = useState<HourPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!spot) return;
    setLoading(true);
    setError(null);
    try {
      setPoints(await fetchConditions(spot.lat, spot.lon, 5));
    } catch (e) {
      setError('No se pudieron cargar las condiciones. Revisa la conexión.');
    } finally {
      setLoading(false);
    }
  }, [spot?.id, spot?.lat, spot?.lon]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);

  if (!spot) return <View style={[ui.screen, { padding: 16 }]}><Text style={ui.text}>Guarda un spot en el mapa para ver sus condiciones.</Text></View>;

  const now = nowHourKey();
  const upcoming = points?.filter((p) => p.time >= now) ?? [];
  const current = upcoming[0];
  const tides = tideEvents(points ?? []).filter((e) => e.time >= now).slice(0, 6);

  return (
    <ScrollView style={ui.screen} contentContainerStyle={{ padding: 12 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
        {spots.map((s) => <Chip key={s.id} label={s.name} on={s.id === spot.id} onPress={() => setSelected(s.id)} />)}
      </ScrollView>
      {loading && !points && <ActivityIndicator color={colors.accent} />}
      {error && <Text style={{ color: colors.danger }}>{error}</Text>}

      {current && (
        <View style={ui.card}>
          <Text style={ui.h2}>Ahora en {spot.name}</Text>
          <Text style={ui.text}>🌊 Oleaje {f(current.waveM)} m   🌡 Agua {f(current.seaTempC, 0)} °C</Text>
          <Text style={ui.text}>💨 Viento {f(current.windKn, 0)} kn {compass(current.windDirDeg)}   ⏲ {f(current.pressureHpa, 0)} hPa</Text>
        </View>
      )}

      {!!tides.length && (
        <View style={ui.card}>
          <Text style={ui.h2}>Próximas mareas</Text>
          {tides.map((e) => (
            <Text key={e.time} style={ui.text}>{e.type === 'high' ? '▲ Pleamar' : '▼ Bajamar'} · {day(e.time)} {e.time.slice(11, 16)} · {f(e.levelM, 2)} m</Text>
          ))}
          <Text style={[ui.muted, { marginTop: 6 }]}>Aproximadas: derivadas del nivel del mar modelado (Open-Meteo). Contrasta con tablas oficiales.</Text>
        </View>
      )}

      {!!upcoming.length && (
        <View style={ui.card}>
          <Text style={ui.h2}>Próximas horas</Text>
          <View style={[ui.row, { marginTop: 6 }]}>
            {['Hora', 'Olas', 'Viento', 'hPa', 'Nivel'].map((h) => <Text key={h} style={[ui.muted, { flex: 1 }]}>{h}</Text>)}
          </View>
          {upcoming.filter((_, i) => i % 3 === 0).slice(0, 24).map((p) => (
            <View key={p.time} style={ui.row}>
              <Text style={[ui.text, { flex: 1 }]}>{p.time.slice(8, 10)}·{p.time.slice(11, 13)}h</Text>
              <Text style={[ui.text, { flex: 1 }]}>{f(p.waveM)}</Text>
              <Text style={[ui.text, { flex: 1 }]}>{f(p.windKn, 0)} {compass(p.windDirDeg)}</Text>
              <Text style={[ui.text, { flex: 1 }]}>{f(p.pressureHpa, 0)}</Text>
              <Text style={[ui.text, { flex: 1 }]}>{f(p.seaLevelM, 2)}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
