import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Text, TextInput, View } from 'react-native';
import { Btn } from './Btn';
import { colors, ui } from './theme';

/** Small dialog to type a new name for a spot (works on web and phones, unlike Alert.prompt). */
export function RenameModal({ visible, initial, onSave, onCancel }: { visible: boolean; initial: string; onSave: (name: string) => void; onCancel: () => void }) {
  const [text, setText] = useState(initial);
  useEffect(() => {
    if (visible) setText(initial);
  }, [visible, initial]);
  const save = () => {
    const name = text.trim();
    if (name) onSave(name);
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }}>
        <View style={[ui.card, { padding: 16 }]}>
          <Text style={ui.h1}>Nombre de la playa</Text>
          <TextInput
            style={ui.input}
            value={text}
            onChangeText={setText}
            autoFocus
            placeholder="Escribe el nombre"
            placeholderTextColor={colors.muted}
            onSubmitEditing={save}
            returnKeyType="done"
            maxLength={80}
          />
          <View style={[ui.row, { gap: 8 }]}>
            <Btn ghost label="Cancelar" onPress={onCancel} style={{ flex: 1 }} />
            <Btn label="Guardar" onPress={save} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
