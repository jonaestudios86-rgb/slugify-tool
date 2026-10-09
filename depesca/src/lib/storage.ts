import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

/** Tiny persisted store shared across screens. */
export function createStore<T>(key: string, initial: T) {
  let value = initial;
  let loaded = false;
  const listeners = new Set<() => void>();

  const load = async () => {
    if (loaded) return;
    loaded = true;
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        value = JSON.parse(raw) as T;
        listeners.forEach((l) => l());
      }
    } catch {
      // keep initial value on corrupt/unavailable storage
    }
  };

  const set = (next: T | ((prev: T) => T)) => {
    value = typeof next === 'function' ? (next as (p: T) => T)(value) : next;
    listeners.forEach((l) => l());
    AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
  };

  const useValue = (): [T, typeof set] => {
    useEffect(() => {
      void load();
    }, []);
    const v = useSyncExternalStore(
      (cb) => {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
      () => value,
    );
    return [v, set];
  };

  return { useValue, get: () => value, set, load };
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
