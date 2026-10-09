import { StyleSheet } from 'react-native';

export const colors = {
  bg: '#0b1d2a',
  card: '#13293a',
  border: '#1f3b50',
  text: '#e8f1f7',
  muted: '#8fa8ba',
  accent: '#2ec4b6',
  danger: '#ef6461',
  warn: '#f4b942',
};

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  h1: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 8 },
  h2: { color: colors.text, fontSize: 16, fontWeight: '600' },
  text: { color: colors.text, fontSize: 14 },
  muted: { color: colors.muted, fontSize: 13 },
  input: { backgroundColor: colors.bg, color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, marginBottom: 8 },
  btn: { backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center' },
  btnText: { color: '#04222a', fontWeight: '700' },
  btnGhost: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center' },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, marginRight: 6 },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  row: { flexDirection: 'row', alignItems: 'center' },
});
