import { Tabs } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Text } from 'react-native';
import { colors } from '../../components/theme';
import { fillPlaces } from '../../lib/beachDb';
import { refreshAlerts } from '../../lib/notify';
import { alertsStore, catchesStore, selectionStore, spotsStore } from '../../lib/stores';

export default function TabsLayout() {
  // On launch, reschedule notifications from the latest forecast.
  useEffect(() => {
    (async () => {
      await Promise.all([spotsStore.load(), alertsStore.load(), catchesStore.load(), selectionStore.load()]);
      // Spots saved before towns existed: add theirs so beaches with the same name can be told apart.
      const updated = await fillPlaces(spotsStore.get());
      if (updated.length) spotsStore.set((prev) => prev.map((s) => updated.find((u) => u.id === s.id)?.place ? { ...s, place: updated.find((u) => u.id === s.id)!.place } : s));
      if (alertsStore.get().some((r) => r.enabled)) await refreshAlerts(alertsStore.get(), spotsStore.get());
    })().catch(() => {});
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
      }}>
      <Tabs.Screen name="index" options={{ title: 'Mapa', tabBarIcon: () => <Text style={{ fontSize: 18 }}>🗺</Text> }} />
      <Tabs.Screen name="favorites" options={{ title: 'Favoritos', tabBarIcon: () => <Text style={{ fontSize: 18 }}>⭐</Text> }} />
      <Tabs.Screen name="conditions" options={{ title: 'Predicción', tabBarIcon: () => <Text style={{ fontSize: 18 }}>🌊</Text> }} />
      <Tabs.Screen name="catches" options={{ title: 'Capturas', tabBarIcon: () => <Text style={{ fontSize: 18 }}>🐟</Text> }} />
      <Tabs.Screen name="alerts" options={{ title: 'Alertas', tabBarIcon: () => <Text style={{ fontSize: 18 }}>🔔</Text> }} />
      <Tabs.Screen name="data" options={{ title: 'Datos', tabBarIcon: () => <Text style={{ fontSize: 18 }}>💾</Text> }} />
    </Tabs>
  );
}
