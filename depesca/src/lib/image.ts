import { Platform } from 'react-native';

const MAX_SIDE = 1024;

/**
 * Web only: shrink a picked photo to a small JPEG data URL. Photos are stored in the browser (a few MB in total),
 * and a blob: URL would not survive a reload. On native the original URI is kept.
 */
export async function persistablePhoto(uri: string): Promise<string> {
  if (Platform.OS !== 'web') return uri;
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.onerror = () => resolve(uri);
    img.src = uri;
  });
}
