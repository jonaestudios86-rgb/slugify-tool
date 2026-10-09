import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Chip } from '../../components/Btn';
import { HourTable } from '../../components/forecast/HourTable';
import {
  DayPicker, Header, HistoryCard, Metrics, PlanCard, ScoreBlock, ShopsSection, SolunarCard, SpeciesCard, TideCard, WhyScore, ZoneInfo,
} from '../../components/forecast/Sections';
import { colors, ui } from '../../components/theme';
import { fetchConditions, type Conditions } from '../../lib/conditions';
import { mapsUrl, shareText } from '../../lib/dialog';
import { buildForecast } from '../../lib/forecast';
import { fetchShops, type Shop } from '../../lib/places';
import { LEVEL_LABEL } from '../../lib/score';
import { catchesStore, previewStore, selectionStore, spotsStore } from '../../lib/stores';

interface Cached {
  cond: Conditions;
  fetchedAt: number;
}

const cacheKey = (id: string) => `dp.forecast.${id}`;

export default function Forecast() {
  const [spots, setSpots] = spotsStore.useValue();
  const [catches] = catchesStore.useValue();
  const [selectedId, setSelected] = selectionStore.useValue();
  const [preview, setPreview] = previewStore.useValue();
  const isPreview = !!preview && preview.id === selectedId && !spots.some((s) => s.id === selectedId);
  const spot = spots.find((s) => s.id === selectedId) ?? (isPreview ? preview : null) ?? spots[0] ?? null;
  /** Saves a beach opened from the map into "mis spots". */
  const saveSpot = (favorite: boolean) => {
    if (!spot) return;
    if (isPreview) {
      setSpots((p) => [...p, { ...spot, favorite }]);
      setPreview(null);
    } else setSpots((p) => p.map((s) => (s.id === spot.id ? { ...s, favorite: favorite && !s.favorite } : s)));
  };

  const [data, setData] = useState<Cached | null>(null);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dayIdx, setDayIdx] = useState(0);
  const [pickedHour, setPickedHour] = useState<number | null>(null);
  const [shops, setShops] = useState<{ id: string; list: Shop[] | null; loading: boolean; error: boolean } | null>(null);

  const load = useCallback(async () => {
    if (!spot) return;
    const id = spot.id;
    setLoading(true);
    setError(null);
    try {
      const cond = await fetchConditions(spot.lat, spot.lon, 7);
      const fresh = { cond, fetchedAt: Date.now() };
      setData(fresh);
      setStale(false);
      AsyncStorage.setItem(cacheKey(id), JSON.stringify(fresh)).catch(() => {});
    } catch {
      try {
        const raw = await AsyncStorage.getItem(cacheKey(id));
        if (raw) {
          setData(JSON.parse(raw) as Cached);
          setStale(true);
          setError('Sin conexión: se muestran los últimos datos guardados.');
        } else {
          setData(null);
          setError('No se pudo cargar la predicción y no hay datos guardados. Revisa la conexión.');
        }
      } catch {
        setError('No se pudo cargar la predicción. Revisa la conexión.');
      }
    } finally {
      setLoading(false);
    }
  }, [spot?.id, spot?.lat, spot?.lon]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setDayIdx(0);
    setPickedHour(null);
    setData(null);
    void load();
  }, [load]);

  const forecast = useMemo(() => (data && spot ? buildForecast(data.cond, spot) : null), [data, spot]);
  const day = forecast?.days[Math.min(dayIdx, (forecast?.days.length ?? 1) - 1)];
  const hour = day ? (day.hours.find((h) => h.hour === pickedHour) ?? day.headline.ref ?? day.hours[0] ?? null) : null;

  if (!spot) {
    return (
      <View style={[ui.screen, { padding: 16 }]}>
        <Text style={ui.text}>Guarda un spot en el mapa para ver su predicción.</Text>
      </View>
    );
  }

  const openMaps = (lat: number, lon: number, name: string) =>
    Linking.openURL(mapsUrl(lat, lon, name)).catch(() => {});

  const loadShops = () => {
    if (shops?.id === spot.id && (shops.list || shops.loading)) return;
    setShops({ id: spot.id, list: null, loading: true, error: false });
    fetchShops(spot.lat, spot.lon)
      .then((list) => setShops({ id: spot.id, list, loading: false, error: false }))
      .catch(() => setShops({ id: spot.id, list: null, loading: false, error: true }));
  };

  const share = () => {
    if (!day) return;
    void shareText(
       `${spot.name}: puntuación ${day.headline.score} (${LEVEL_LABEL[day.headline.level]}). ${day.headline.explanation} Mejor hora: ${day.bestHour ?? '–'}h. https://maps.google.com/?q=${spot.lat},${spot.lon}`,
      spot.name,
    );
  };

  return (
    <View style={ui.screen}>
      <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />} contentContainerStyle={{ paddingBottom: 40 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ padding: 12, paddingBottom: 0 }}>
          {isPreview && preview && <Chip key={preview.id} label={preview.name} on onPress={() => setSelected(preview.id)} />}
          {spots.map((s) => <Chip key={s.id} label={s.name} on={s.id === spot.id} onPress={() => setSelected(s.id)} />)}
        </ScrollView>

        <Header
          spot={spot}
          tz={forecast?.timezone ?? '…'}
          onNavigate={() => openMaps(spot.lat, spot.lon, spot.name)}
          onAlert={() => router.navigate('/alerts')}
          onFavorite={() => saveSpot(true)}
          onShare={share}
          onClose={() => router.navigate('/')}
        />

        {loading && !forecast && <ActivityIndicator color={colors.accent} style={{ marginTop: 30 }} />}
        {error && <Text style={{ color: stale ? colors.warn : colors.danger, paddingHorizontal: 12, marginBottom: 8 }}>{error}</Text>}

        {forecast && day && data && (
          <>
            <ScoreBlock onRefresh={load} day={day} fetchedAt={data.fetchedAt} stale={stale} onFish={() => { if (isPreview) saveSpot(false); router.navigate({ pathname: '/catches', params: { spot: spot.id } }); }} onNavigate={() => openMaps(spot.lat, spot.lon, spot.name)} />
            <DayPicker forecast={forecast} index={dayIdx} onPick={(i) => { setDayIdx(i); setPickedHour(null); }} />
            <Metrics day={day} spot={spot} hour={hour} />
            <View style={{ paddingHorizontal: 12 }}>
              {hour && <WhyScore day={day} hour={hour} utcOffsetSec={forecast.utcOffsetSec} />}
              <ZoneInfo spot={spot} />
              <PlanCard day={day} />
              <ShopsSection
                shops={shops?.id === spot.id ? shops.list : null}
                loading={shops?.id === spot.id && shops.loading}
                error={shops?.id === spot.id && shops.error}
                onOpen={loadShops}
                onShop={(s) => openMaps(s.lat, s.lon, s.name)}
              />
            </View>
            <View style={{ paddingHorizontal: 12, marginTop: 10 }}>
              <HourTable day={day} nowKey={forecast.nowKey} selectedHour={pickedHour ?? undefined} onPickHour={setPickedHour} />
            </View>
            <TideCard day={day} />
            <SolunarCard day={day} utcOffsetSec={forecast.utcOffsetSec} nowKey={forecast.nowKey} />
            <SpeciesCard key={spot.id} spot={spot} day={day} />
            <HistoryCard spot={spot} catches={catches} />
          </>
        )}
      </ScrollView>
    </View>
  );
}
