import { Alert, Platform, Share } from 'react-native';

const isWeb = Platform.OS === 'web';

/** Alert.alert is a no-op on web, so go through the browser's own dialogs there. */
export function notice(title: string, message?: string): void {
  if (isWeb) globalThis.alert?.(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}

export function confirmAction(title: string, message: string, confirmLabel: string, onConfirm: () => void): void {
  if (isWeb) {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

/** Native share sheet; on web, the Web Share API when present, otherwise copy to the clipboard. */
export async function shareText(message: string, title?: string): Promise<void> {
  if (!isWeb) {
    await Share.share({ message, title });
    return;
  }
  const nav = globalThis.navigator as Navigator | undefined;
  try {
    if (nav?.share) {
      await nav.share({ text: message, title });
      return;
    }
    await nav?.clipboard?.writeText(message);
    notice('Copiado', 'El texto está en el portapapeles.');
  } catch {
    // user dismissed the share sheet or the browser refused: nothing to recover
  }
}

/** Opens a driving/walking route to a point in the platform's maps app (or Google Maps on web). */
export function mapsUrl(lat: number, lon: number, name: string): string {
  const label = encodeURIComponent(name);
  if (Platform.OS === 'ios') return `http://maps.apple.com/?daddr=${lat},${lon}&q=${label}`;
  if (Platform.OS === 'android') return `geo:${lat},${lon}?q=${lat},${lon}(${label})`;
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}
