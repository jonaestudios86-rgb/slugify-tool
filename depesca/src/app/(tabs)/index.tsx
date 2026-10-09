import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Btn, Chip } from '../../components/Btn';
import { SpotMap, type MapHandle } from '../../components/SpotMap';
import { colors, ui } from '../../components/theme';
import { selectionStore, spotsStore } from '../../lib/stores';
import { ORIENTATIONS } from '../../lib/geo';
import { uid } from '../../lib/storage';
import type { Seabed, Spot } from '../../lib/types';

const SEABEDS: Seabed[] = ['arena', 'roca', 'fango', 'posidonia', 'mixto'];
const csv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

type Draft = Omit<Spot, 'species' | 'techniques'> & { species: string; techniques: string };

export default function MapScreen() {
  const [spots, setSpots] = spotsStore.useValue();
  const [selectedId, setSelected] = selectionStore.useValue();
  const [draft, setDraft] = useState<Draft | null>(null);
  const handle = useRef<MapHandle | null>(null);
  const selected = spots.find((s) => s.id === selectedId) ?? null;

  const startNew = (lat: number, lon: number) =>
    setDraft({ id: uid(), name: '', lat, lon, seabed: 'mixto', species: '', techniques: '', notes: '', favorite: false });
  const edit = (s: Spot) => setDraft({ ...s, species: s.species.join(', '), techniques: s.techniques.join(', ') });

  const save = () => {
    if (!draft || !draft.name.trim()) return Alert.alert('Falta el nombre del spot');
    const spot: Spot = { ...draft, name: draft.name.trim(), species: csv(draft.species), techniques: csv(draft.techniques) };
    setSpots((prev) => (prev.some((s) => s.id === spot.id) ? prev.map((s) => (s.id === spot.id ? spot : s)) : [...prev, spot]));
    setSelected(spot.id);
    setDraft(null);
  };

  const remove = (s: Spot) =>
    Alert.alert('Borrar spot', `¿Borrar "${s.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => { setSpots((p) => p.filter((x) => x.id !== s.id)); setSelected(null); } },
    ]);

  const locate = async () => {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return Alert.alert('Sin permiso de ubicación');
    const pos = await Location.getCurrentPositionAsync({});
    handle.current?.setMe(pos.coords.latitude, pos.coords.longitude, true);
  };

  const addHere = async () => {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return Alert.alert('Sin permiso de ubicación');
    const pos = await Location.getCurrentPositionAsync({});
    startNew(pos.coords.latitude, pos.coords.longitude);
  };

  return (
    <View style={ui.screen}>
      <View style={{ flex: 1 }}>
        <SpotMap spots={spots} selectedId={selectedId} onSelect={setSelected} onAdd={startNew} handleRef={handle} />
        <View style={{ position: 'absolute', right: 10, top: 10, gap: 8 }}>
          <Btn label="📍 Yo" onPress={locate} />
          <Btn label="＋ Aquí" onPress={addHere} />
        </View>
        {!spots.length && (
          <View style={[ui.card, { position: 'absolute', left: 10, bottom: 10, right: 10 }]}>
            <Text style={ui.text}>Mantén pulsado el mapa para guardar un spot, o usa “＋ Aquí”.</Text>
          </View>
        )}
      </View>

      {selected && (
        <View style={[ui.card, { margin: 10, marginBottom: 0 }]}>
          <View style={ui.row}>
            <Text style={[ui.h2, { flex: 1 }]}>{selected.favorite ? '★ ' : ''}{selected.name}</Text>
            <Pressable onPress={() => handle.current?.flyTo(selected.lat, selected.lon)}><Text style={{ color: colors.accent }}>Centrar</Text></Pressable>
          </View>
          <Text style={ui.muted}>Fondo: {selected.seabed}{selected.orientation != null ? ` · Costa al ${ORIENTATIONS.find((o) => o.deg === selected.orientation)?.label ?? ''}` : ''} · {selected.lat.toFixed(4)}, {selected.lon.toFixed(4)}</Text>
          {!!selected.species.length && <Text style={ui.text}>Especies: {selected.species.join(', ')}</Text>}
          {!!selected.techniques.length && <Text style={ui.text}>Técnicas: {selected.techniques.join(', ')}</Text>}
          {!!selected.notes && <Text style={ui.muted}>{selected.notes}</Text>}
          <View style={[ui.row, { gap: 8, marginTop: 8 }]}>
            <Btn label="Predicción" onPress={() => router.navigate('/conditions')} style={{ flex: 1 }} />
            <Btn ghost label={selected.favorite ? '★' : '☆'} onPress={() => setSpots((p) => p.map((s) => (s.id === selected.id ? { ...s, favorite: !s.favorite } : s)))} />
            <Btn ghost label="Editar" onPress={() => edit(selected)} />
            <Btn ghost label="🗑" onPress={() => remove(selected)} />
          </View>
        </View>
      )}

      <ScrollView horizontal style={{ flexGrow: 0, padding: 10 }} showsHorizontalScrollIndicator={false}>
        {[...spots].sort((a, b) => Number(b.favorite) - Number(a.favorite)).map((s) => (
          <Chip key={s.id} label={(s.favorite ? '★ ' : '') + s.name} on={s.id === selectedId} onPress={() => { setSelected(s.id); handle.current?.flyTo(s.lat, s.lon); }} />
        ))}
      </ScrollView>

      <Modal visible={!!draft} animationType="slide" onRequestClose={() => setDraft(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={ui.screen}>
          {draft && (
            <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
              <Text style={ui.h1}>{spots.some((s) => s.id === draft.id) ? 'Editar spot' : 'Nuevo spot'}</Text>
              <Text style={ui.muted}>{draft.lat.toFixed(5)}, {draft.lon.toFixed(5)}</Text>
              <TextInput style={ui.input} placeholder="Nombre" placeholderTextColor={colors.muted} value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} />
              <Text style={ui.muted}>Tipo de fondo</Text>
              <ScrollView horizontal style={{ marginVertical: 8 }}>
                {SEABEDS.map((s) => <Chip key={s} label={s} on={draft.seabed === s} onPress={() => setDraft({ ...draft, seabed: s })} />)}
              </ScrollView>
              <Text style={ui.muted}>Orientación de la costa (hacia dónde mira el mar)</Text>
              <ScrollView horizontal style={{ marginVertical: 8 }}>
                {ORIENTATIONS.map((o) => <Chip key={o.label} label={o.label} on={draft.orientation === o.deg} onPress={() => setDraft({ ...draft, orientation: draft.orientation === o.deg ? undefined : o.deg })} />)}
              </ScrollView>
              <TextInput style={ui.input} placeholder="Especies (separadas por comas)" placeholderTextColor={colors.muted} value={draft.species} onChangeText={(species) => setDraft({ ...draft, species })} />
              <TextInput style={ui.input} placeholder="Técnicas (spinning, fondo, curricán…)" placeholderTextColor={colors.muted} value={draft.techniques} onChangeText={(techniques) => setDraft({ ...draft, techniques })} />
              <TextInput style={[ui.input, { height: 90 }]} multiline placeholder="Notas (accesos, mejor marea, cebos…)" placeholderTextColor={colors.muted} value={draft.notes} onChangeText={(notes) => setDraft({ ...draft, notes })} />
              <View style={[ui.row, { gap: 8 }]}>
                <Btn ghost label="Cancelar" onPress={() => setDraft(null)} style={{ flex: 1 }} />
                <Btn label="Guardar" onPress={save} style={{ flex: 1 }} />
              </View>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
