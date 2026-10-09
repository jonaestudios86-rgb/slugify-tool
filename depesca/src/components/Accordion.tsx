import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors, ui } from './theme';

export function Accordion({ title, children, defaultOpen = false, onOpen }: { title: string; children: ReactNode; defaultOpen?: boolean; onOpen?: () => void }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 4 }}>
      <Pressable
        onPress={() => {
          if (!open) onOpen?.();
          setOpen(!open);
        }}
        style={[ui.row, { justifyContent: 'space-between', paddingVertical: 10 }]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}>
        <Text style={{ color: colors.muted, fontSize: 15 }}>{title}</Text>
        <Text style={{ color: colors.muted, fontSize: 16 }}>{open ? '⌃' : '⌄'}</Text>
      </Pressable>
      {open && <View style={{ paddingBottom: 10 }}>{children}</View>}
    </View>
  );
}
