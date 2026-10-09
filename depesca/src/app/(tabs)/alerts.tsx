import { useState } from 'react';
import { Modal, Platform, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { Btn, Chip } from '../../components/Btn';
import { colors, ui } from '../../components/theme';
import { refreshAlerts, type AlertHit } from '../../lib/notify';
import { notice } from '../../lib/dialog';
import { uid } from '../../lib/storage';
import { alertsStore, spotsStore } from '../../lib/stores';
import type { AlertRule, TidePhase } from '../../lib/types';

const TIDES: [TidePhase, string][] = [['any', 'Cualquiera'], ['rising', 'Subiendo'], ['falling', 'Bajando']];
const num = (s: string, fallback: number) => (Number.isFinite(Number(s.replace(',', '.'))) && s !== '' ? Number(s.replace(',', '.')) : fallback);

interface Draft { name: string; spotId: string; fishingType: string; wind: string; wave: string; pressure: string; tide: TidePhase; from: string; to: string }

export default function Alerts() {
  const [rules, setRules] = alertsStore.useValue();
  const [spots] = spotsStore.useValue();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [hits, setHits] = useState<AlertHit[] | null>(null);
  const [busy, setBusy] = useState(false);

  const check = async (list = rules) => {
    setBusy(true);
    try {
      setHits(await refreshAlerts(list, spots));
    } catch {
      notice('No se pudieron comprobar las alertas', 'Revisa la conexión.');
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!draft) return;
    if (!draft.spotId) return notice('Elige un spot');
    const rule: AlertRule = {
      id: uid(), enabled: true, name: draft.name.trim() || 'Condiciones ideales', spotId: draft.spotId, fishingType: draft.fishingType.trim(),
      maxWindKmh: num(draft.wind, 20), maxWaveM: num(draft.wave, 1), minPressureHpa: draft.pressure ? num(draft.pressure, 0) : undefined,
      tide: draft.tide, fromHour: Math.min(24, Math.max(0, num(draft.from, 0))), toHour: Math.min(24, Math.max(0, num(draft.to, 24))),
    };
    const next = [...rules, rule];
    setRules(next);
    setDraft(null);
    void check(next);
  };

  const toggle = (id: string, enabled: boolean) => {
    const next = rules.map((r) => (r.id === id ? { ...r, enabled } : r));
    setRules(next);
    void check(next);
  };

  const remove = (id: string) => {
    const next = rules.filter((r) => r.id !== id);
    setRules(next);
    void check(next);
  };

  const spotName = (id: string) => spots.find((s) => s.id === id)?.name ?? '(spot borrado)';

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={{ padding: 12 }}>
        <Text style={ui.muted}>Avisos locales cuando el pronóstico cumple tus condiciones. Se recalculan al abrir la app o pulsar “Comprobar”.</Text>
        {Platform.OS === 'web' && <Text style={{ color: colors.warn, marginTop: 6 }}>En la versión web no se envían notificaciones: aquí solo ves las ventanas calculadas. Para recibir avisos, usa la app en el móvil.</Text>}
        {rules.map((r) => (
          <View key={r.id} style={[ui.card, { marginTop: 10 }]}>
            <View style={ui.row}>
              <Text style={[ui.h2, { flex: 1 }]}>{r.name}</Text>
              <Switch value={r.enabled} onValueChange={(v) => toggle(r.id, v)} trackColor={{ true: colors.accent }} />
            </View>
            <Text style={ui.text}>{spotName(r.spotId)}{r.fishingType ? ` · ${r.fishingType}` : ''}</Text>
            <Text style={ui.muted}>Viento ≤ {r.maxWindKmh} km/h · Olas ≤ {r.maxWaveM} m{r.minPressureHpa ? ` · ≥ ${r.minPressureHpa} hPa` : ''} · Marea: {TIDES.find((t) => t[0] === r.tide)?.[1]} · {r.fromHour}–{r.toHour} h</Text>
            <Text onPress={() => remove(r.id)} style={{ color: colors.danger, marginTop: 6 }}>Borrar</Text>
          </View>
        ))}
        {!rules.length && <Text style={[ui.text, { marginTop: 12 }]}>Sin alertas. Crea la primera.</Text>}

        {hits && (
          <View style={[ui.card, { marginTop: 10 }]}>
            <Text style={ui.h2}>Próximas ventanas</Text>
            {!hits.length && <Text style={ui.muted}>Ninguna en los próximos 5 días.</Text>}
            {hits.slice(0, 20).map((h) => (
              <Text key={h.rule.id + h.start} style={ui.text}>{h.start.slice(8, 10)}/{h.start.slice(5, 7)} {h.start.slice(11, 16)}–{h.end.slice(11, 16)} · {h.spot.name} · {h.rule.name}</Text>
            ))}
          </View>
        )}
      </ScrollView>
      <View style={[ui.row, { padding: 12, gap: 8 }]}>
        <Btn ghost label={busy ? 'Comprobando…' : 'Comprobar'} onPress={() => check()} style={{ flex: 1 }} />
        <Btn label="＋ Nueva alerta" onPress={() => setDraft({ name: '', spotId: spots[0]?.id ?? '', fishingType: '', wind: '20', wave: '1', pressure: '', tide: 'any', from: '0', to: '24' })} style={{ flex: 1 }} />
      </View>

      <Modal visible={!!draft} animationType="slide" onRequestClose={() => setDraft(null)}>
        <ScrollView style={ui.screen} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          {draft && (
            <>
              <Text style={ui.h1}>Nueva alerta</Text>
              <TextInput style={ui.input} placeholder="Nombre (p. ej. Lubina al amanecer)" placeholderTextColor={colors.muted} value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} />
              <Text style={ui.muted}>Spot</Text>
              <ScrollView horizontal style={{ marginVertical: 8 }}>
                {spots.map((s) => <Chip key={s.id} label={s.name} on={draft.spotId === s.id} onPress={() => setDraft({ ...draft, spotId: s.id })} />)}
              </ScrollView>
              {!spots.length && <Text style={{ color: colors.warn }}>Primero guarda un spot en el mapa.</Text>}
              <TextInput style={ui.input} placeholder="Tipo de pesca (spinning, fondo…)" placeholderTextColor={colors.muted} value={draft.fishingType} onChangeText={(fishingType) => setDraft({ ...draft, fishingType })} />
              <TextInput style={ui.input} placeholder="Viento máx. (km/h)" keyboardType="decimal-pad" placeholderTextColor={colors.muted} value={draft.wind} onChangeText={(wind) => setDraft({ ...draft, wind })} />
              <TextInput style={ui.input} placeholder="Oleaje máx. (m)" keyboardType="decimal-pad" placeholderTextColor={colors.muted} value={draft.wave} onChangeText={(wave) => setDraft({ ...draft, wave })} />
              <TextInput style={ui.input} placeholder="Presión mín. hPa (opcional)" keyboardType="decimal-pad" placeholderTextColor={colors.muted} value={draft.pressure} onChangeText={(pressure) => setDraft({ ...draft, pressure })} />
              <Text style={ui.muted}>Marea</Text>
              <ScrollView horizontal style={{ marginVertical: 8 }}>
                {TIDES.map(([v, l]) => <Chip key={v} label={l} on={draft.tide === v} onPress={() => setDraft({ ...draft, tide: v })} />)}
              </ScrollView>
              <View style={[ui.row, { gap: 8 }]}>
                <TextInput style={[ui.input, { flex: 1 }]} placeholder="Desde (h)" keyboardType="number-pad" placeholderTextColor={colors.muted} value={draft.from} onChangeText={(from) => setDraft({ ...draft, from })} />
                <TextInput style={[ui.input, { flex: 1 }]} placeholder="Hasta (h)" keyboardType="number-pad" placeholderTextColor={colors.muted} value={draft.to} onChangeText={(to) => setDraft({ ...draft, to })} />
              </View>
              <View style={[ui.row, { gap: 8 }]}>
                <Btn ghost label="Cancelar" onPress={() => setDraft(null)} style={{ flex: 1 }} />
                <Btn label="Guardar" onPress={save} style={{ flex: 1 }} />
              </View>
            </>
          )}
        </ScrollView>
      </Modal>
    </View>
  );
}
