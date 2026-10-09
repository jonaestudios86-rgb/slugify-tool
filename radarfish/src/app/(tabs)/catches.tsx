import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { Alert, Image, Modal, ScrollView, Text, TextInput, View } from 'react-native';
import { Btn, Chip } from '../../components/Btn';
import { colors, ui } from '../../components/theme';
import { uid } from '../../lib/storage';
import { catchStats } from '../../lib/stats';
import { catchesStore, spotsStore } from '../../lib/stores';
import type { Catch } from '../../lib/types';

type Draft = { species: string; weight: string; length: string; spotId?: string; photoUri?: string; notes: string };
const EMPTY: Draft = { species: '', weight: '', length: '', notes: '' };
const num = (s: string) => Number(s.replace(',', '.'));

export default function Catches() {
  const [catches, setCatches] = catchesStore.useValue();
  const [spots] = spotsStore.useValue();
  const [draft, setDraft] = useState<Draft | null>(null);
  const stats = useMemo(() => catchStats(catches), [catches]);
  const spotName = (id?: string) => spots.find((s) => s.id === id)?.name;

  const pick = async (camera: boolean) => {
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', quality: 0.6 };
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Sin permiso');
    const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!res.canceled && draft) setDraft({ ...draft, photoUri: res.assets[0].uri });
  };

  const save = () => {
    if (!draft) return;
    const weightKg = num(draft.weight);
    if (!draft.species.trim() || !Number.isFinite(weightKg) || weightKg < 0) return Alert.alert('Indica especie y un peso válido (kg)');
    const lengthCm = draft.length ? num(draft.length) : undefined;
    const c: Catch = { id: uid(), date: new Date().toISOString(), species: draft.species.trim(), weightKg, lengthCm: Number.isFinite(lengthCm) ? lengthCm : undefined, spotId: draft.spotId, photoUri: draft.photoUri, notes: draft.notes };
    setCatches((p) => [c, ...p]);
    setDraft(null);
  };

  const remove = (c: Catch) =>
    Alert.alert('Borrar captura', `¿Borrar ${c.species}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => setCatches((p) => p.filter((x) => x.id !== c.id)) },
    ]);

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={{ padding: 12 }}>
        <View style={ui.card}>
          <Text style={ui.h2}>Resumen</Text>
          <Text style={ui.text}>{stats.total} capturas · {stats.totalKg} kg</Text>
          {stats.biggest && <Text style={ui.text}>Mayor: {stats.biggest.species} ({stats.biggest.weightKg} kg)</Text>}
          {stats.bySpecies.slice(0, 5).map((s) => <Text key={s.species} style={ui.muted}>{s.species}: {s.count} · {Math.round(s.kg * 100) / 100} kg</Text>)}
          {stats.bySpot[0] && <Text style={ui.muted}>Mejor spot: {spotName(stats.bySpot[0].spotId) ?? '—'} ({stats.bySpot[0].count})</Text>}
        </View>
        {catches.map((c) => (
          <View key={c.id} style={[ui.card, ui.row]}>
            {c.photoUri && <Image source={{ uri: c.photoUri }} style={{ width: 64, height: 64, borderRadius: 8, marginRight: 10 }} />}
            <View style={{ flex: 1 }}>
              <Text style={ui.h2}>{c.species} · {c.weightKg} kg{c.lengthCm ? ` · ${c.lengthCm} cm` : ''}</Text>
              <Text style={ui.muted}>{new Date(c.date).toLocaleDateString('es-ES')}{spotName(c.spotId) ? ` · ${spotName(c.spotId)}` : ''}</Text>
              {!!c.notes && <Text style={ui.muted}>{c.notes}</Text>}
            </View>
            <Text onPress={() => remove(c)} style={{ color: colors.danger, padding: 6 }}>🗑</Text>
          </View>
        ))}
        {!catches.length && <Text style={ui.muted}>Aún no hay capturas. Añade la primera.</Text>}
      </ScrollView>
      <View style={{ padding: 12 }}><Btn label="＋ Nueva captura" onPress={() => setDraft(EMPTY)} /></View>

      <Modal visible={!!draft} animationType="slide" onRequestClose={() => setDraft(null)}>
        <ScrollView style={ui.screen} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          {draft && (
            <>
              <Text style={ui.h1}>Nueva captura</Text>
              <TextInput style={ui.input} placeholder="Especie" placeholderTextColor={colors.muted} value={draft.species} onChangeText={(species) => setDraft({ ...draft, species })} />
              <TextInput style={ui.input} placeholder="Peso (kg)" keyboardType="decimal-pad" placeholderTextColor={colors.muted} value={draft.weight} onChangeText={(weight) => setDraft({ ...draft, weight })} />
              <TextInput style={ui.input} placeholder="Longitud (cm, opcional)" keyboardType="decimal-pad" placeholderTextColor={colors.muted} value={draft.length} onChangeText={(length) => setDraft({ ...draft, length })} />
              <Text style={ui.muted}>Spot</Text>
              <ScrollView horizontal style={{ marginVertical: 8 }}>
                {spots.map((s) => <Chip key={s.id} label={s.name} on={draft.spotId === s.id} onPress={() => setDraft({ ...draft, spotId: draft.spotId === s.id ? undefined : s.id })} />)}
              </ScrollView>
              <TextInput style={[ui.input, { height: 80 }]} multiline placeholder="Notas (cebo, hora, marea…)" placeholderTextColor={colors.muted} value={draft.notes} onChangeText={(notes) => setDraft({ ...draft, notes })} />
              {draft.photoUri && <Image source={{ uri: draft.photoUri }} style={{ width: '100%', height: 200, borderRadius: 8, marginBottom: 8 }} />}
              <View style={[ui.row, { gap: 8, marginBottom: 12 }]}>
                <Btn ghost label="📷 Cámara" onPress={() => pick(true)} style={{ flex: 1 }} />
                <Btn ghost label="🖼 Galería" onPress={() => pick(false)} style={{ flex: 1 }} />
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
