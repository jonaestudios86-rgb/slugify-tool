import * as Notifications from 'expo-notifications';
import { alertWindows } from './alerts';
import { fetchConditions, nowHourKey } from './conditions';
import type { AlertRule, Spot } from './types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  const { granted } = await Notifications.requestPermissionsAsync();
  return granted;
}

export interface AlertHit {
  rule: AlertRule;
  spot: Spot;
  start: string;
  end: string;
}

/**
 * Re-evaluates every enabled rule against the forecast and replaces all scheduled
 * notifications with one per upcoming window (max 20). Returns the windows found.
 */
export async function refreshAlerts(rules: AlertRule[], spots: Spot[]): Promise<AlertHit[]> {
  const hits: AlertHit[] = [];
  const now = nowHourKey();
  for (const rule of rules.filter((r) => r.enabled)) {
    const spot = spots.find((s) => s.id === rule.spotId);
    if (!spot) continue;
    const points = await fetchConditions(spot.lat, spot.lon, 5);
    for (const w of alertWindows(points, rule, now)) hits.push({ rule, spot, ...w });
  }
  hits.sort((a, b) => a.start.localeCompare(b.start));

  await Notifications.cancelAllScheduledNotificationsAsync();
  if (await ensureNotificationPermission()) {
    for (const h of hits.slice(0, 20)) {
      const date = new Date(h.start);
      if (date.getTime() <= Date.now()) continue;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Buenas condiciones en ${h.spot.name}`,
          body: `${h.rule.name}: de ${h.start.slice(11, 16)} a ${h.end.slice(11, 16)} h`,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
      });
    }
  }
  return hits;
}
