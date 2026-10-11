import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { RenameModal } from '../../components/RenameModal';
import { colors, ui } from '../../components/theme';
import { scorePlaces } from '../../lib/areaScore';
import { compass } from '../../lib/geo';
import { spotLabels } from '../../lib/places';
import { LEVEL_COLOR, scoreLevel } from '../../lib/score';
import { selectionStore, spotsStore } from '../../lib/stores';

export default function Favorites() {
  const [spots, setSpots] = spotsStore.useValue();
  const [, setSelected] = selectionStore.useValue();
  const favorites = useMemo(() => spots.filter((s) => s.favorite).sort((a, b) => a.name.localeCompare(b.name, 'es')), [spots]);
  const labels = useMemo(() => spotLabels(spots), [spots]);
  const [renaming, setRenaming] = useState<string | null>(null);
  const renamingSpot = spots.find((s) => s.id === renaming);
  const [scores, setScores] = useState<Record<string, number>>({});

  // Today's fishing score for each favourite, from one forecast per ~20 km area.
  const key = favorites.map((s) => s.id).join('|');
  useEffect(() => {
    if (!favorites.length) return;
    const c = { lat: favorites[0].lat, lon: favorites[0].lon };
    scorePlaces(favorites.map((s) => ({ id: s.id, lat: s.lat, lon: s.lon, orientation: s.orientation })), c)
      .then(setScores)
      .catch(() => {});
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (id: string) => {
    setSelected(id);
    router.navigate('/conditions');
  };
  const rename = (name: string) => {
    setSpots((p) => p.map((s) => (s.id === renaming ? { ...s, name, place: undefined, customName: true } : s)));
    setRenaming(null);
  };
  const unfavorite = (id: string) => setSpots((p) => p.map((s) => (s.id === id ? { ...s, favorite: false } : s)));

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
        {!favorites.length && (
          <View style={ui.card}>
            <Text style={ui.h2}>Aún no tienes playas favoritas</Text>
            <Text style={[ui.muted, { marginTop: 6 }]}>Abre una playa desde el mapa y pulsa ♡ en su predicción: aparecerá aquí para entrar en un toque.</Text>
          </View>
        )}
        {favorites.map((s) => {
          const score = scores[s.id];
          return (
            <Pressable key={s.id} onPress={() => open(s.id)} style={[ui.card, ui.row, { gap: 12 }]}>
              <View style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: score == null ? colors.border : LEVEL_COLOR[scoreLevel(score)] }}>
                <Text style={{ color: score == null ? colors.muted : '#06121b', fontWeight: '800', fontSize: 18 }}>{score ?? '–'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>★ {labels[s.id] ?? s.name}</Text>
                <Text numberOfLines={1} style={ui.muted}>
                  Fondo: {s.seabed}{s.orientation != null ? ` · Costa al ${compass(s.orientation)}` : ''}
                </Text>
                {!!s.species.length && <Text numberOfLines={1} style={ui.muted}>{s.species.join(', ')}</Text>}
              </View>
              <Pressable onPress={() => setRenaming(s.id)} accessibilityLabel="Cambiar nombre" hitSlop={10}>
                <Text style={{ color: colors.muted, fontSize: 22 }}>✎</Text>
              </Pressable>
              <Pressable onPress={() => unfavorite(s.id)} accessibilityLabel="Quitar de favoritos" hitSlop={10}>
                <Text style={{ color: colors.danger, fontSize: 24 }}>♥</Text>
              </Pressable>
            </Pressable>
          );
        })}
      </ScrollView>
      <RenameModal visible={!!renamingSpot} initial={renamingSpot?.name ?? ''} onSave={rename} onCancel={() => setRenaming(null)} />
    </View>
  );
}
