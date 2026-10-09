import { Pressable, Text } from 'react-native';
import { ui } from './theme';

export function Btn({ label, onPress, ghost, style }: { label: string; onPress: () => void; ghost?: boolean; style?: object }) {
  return (
    <Pressable onPress={onPress} style={[ghost ? ui.btnGhost : ui.btn, style]}>
      <Text style={ghost ? ui.text : ui.btnText}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[ui.chip, on && ui.chipOn]}>
      <Text style={on ? ui.btnText : ui.text}>{label}</Text>
    </Pressable>
  );
}
