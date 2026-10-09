import { Tabs } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Text } from 'react-native';
import { colors } from '../../components/theme';
import { refreshAlerts } from '../../lib/notify';
import { alertsStore, catchesStore, selectionStore, spotsStore } from '../../lib/stores';

export default function TabsLayout() {
  // On launch, reschedule notifications from the latest forecast.
  useEffect(() => {
    (async () => {
      await Promise.all([spotsStore.load(), alertsStore.load(), catchesStore.load(), selectionStore.load()]);
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
      <Tabs.Screen name="conditions" options={{ title: 'Predicción', tabBarIcon: () => <Text style={{ fontSize: 18 }}>🌊</Text> }} />
      <Tabs.Screen name="catches" options={{ title: 'Capturas', tabBarIcon: () => <Text style={{ fontSize: 18 }}>🐟</Text> }} />
      <Tabs.Screen name="alerts" options={{ title: 'Alertas', tabBarIcon: () => <Text style={{ fontSize: 18 }}>🔔</Text> }} />
      <Tabs.Screen name="data" options={{ title: 'Datos', tabBarIcon: () => <Text style={{ fontSize: 18 }}>💾</Text> }} />
    </Tabs>
  );
}
