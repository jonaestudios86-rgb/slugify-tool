import { createStore } from './storage';
import type { AlertRule, Catch, Spot } from './types';

export const spotsStore = createStore<Spot[]>('rf.spots', []);
export const catchesStore = createStore<Catch[]>('rf.catches', []);
export const alertsStore = createStore<AlertRule[]>('rf.alerts', []);
/** Spot currently chosen on the map; the conditions tab follows it. */
export const selectionStore = createStore<string | null>('rf.selected', null);
