import { createStore } from './storage';
import type { AlertRule, Catch, Spot } from './types';

export const spotsStore = createStore<Spot[]>('dp.spots', []);
export const catchesStore = createStore<Catch[]>('dp.catches', []);
export const alertsStore = createStore<AlertRule[]>('dp.alerts', []);
/** Spot currently chosen on the map; the conditions tab follows it. */
export const selectionStore = createStore<string | null>('dp.selected', null);
