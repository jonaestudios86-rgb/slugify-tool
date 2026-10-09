import { useState } from 'react';
import { Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { Btn } from '../../components/Btn';
import { colors, ui } from '../../components/theme';
import { applyBackup, backupFileName, buildBackup, parseBackup } from '../../lib/backup';
import { confirmAction, notice, shareText } from '../../lib/dialog';
import { alertsStore, catchesStore, spotsStore } from '../../lib/stores';

const isWeb = Platform.OS === 'web';

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function pickFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      file.text().then(resolve, () => resolve(null));
    };
    input.click();
  });
}

export default function Data() {
  const [spots, setSpots] = spotsStore.useValue();
  const [catches, setCatches] = catchesStore.useValue();
  const [alerts, setAlerts] = alertsStore.useValue();
  const [text, setText] = useState('');

  const current = { spots, catches, alerts };

  const exportCopy = async () => {
    const json = JSON.stringify(buildBackup(current), null, 2);
    if (isWeb) download(backupFileName(), json);
    else await shareText(json, backupFileName());
  };

  const run = (source: string, mode: 'merge' | 'replace') => {
    const r = parseBackup(source);
    if (!r.ok) return notice('No se pudo importar', r.error);
    const apply = () => {
      const next = applyBackup(current, r.backup, mode);
      setSpots(next.spots);
      setCatches(next.catches);
      setAlerts(next.alerts);
      setText('');
      notice('Copia importada', `${r.backup.spots.length} spots, ${r.backup.catches.length} capturas y ${r.backup.alerts.length} alertas.${r.skipped ? ` Se omitieron ${r.skipped} registros no válidos.` : ''}`);
    };
    if (mode === 'replace') confirmAction('Reemplazar todo', 'Se borrarán tus spots, capturas y alertas actuales y se sustituirán por los de la copia.', 'Reemplazar', apply);
    else apply();
  };

  const fromFile = async () => {
    const t = await pickFile();
    if (t == null) return notice('No se pudo leer el archivo');
    setText(t);
  };

  return (
    <ScrollView style={ui.screen} contentContainerStyle={{ padding: 12, gap: 10 }} keyboardShouldPersistTaps="handled">
      <View style={ui.card}>
        <Text style={ui.h2}>Tus datos</Text>
        <Text style={ui.text}>{spots.length} spots · {catches.length} capturas · {alerts.length} alertas</Text>
        <Text style={[ui.muted, { marginTop: 6 }]}>
          {isWeb
            ? 'En la web, los datos se guardan solo en este navegador. Si borras los datos del sitio o cambias de dispositivo, se pierden: haz copias de seguridad.'
            : 'Los datos se guardan solo en este dispositivo. Haz copias de seguridad por si cambias de móvil o reinstalas la app.'}
        </Text>
      </View>

      <View style={ui.card}>
        <Text style={ui.h2}>Exportar copia</Text>
        <Text style={[ui.muted, { marginVertical: 6 }]}>
          {isWeb ? 'Descarga un archivo .json con tus spots, capturas y alertas.' : 'Abre el menú de compartir: guárdala en Archivos, en Notas o envíatela por correo.'} Las fotos solo se incluyen si se hicieron en la versión web.
        </Text>
        <Btn label={isWeb ? 'Descargar copia' : 'Exportar copia'} onPress={exportCopy} />
      </View>

      <View style={ui.card}>
        <Text style={ui.h2}>Importar copia</Text>
        <Text style={[ui.muted, { marginVertical: 6 }]}>
          {isWeb ? 'Elige el archivo o pega su contenido.' : 'Pega aquí el contenido de la copia.'} “Combinar” conserva lo que tienes y añade lo de la copia; “Reemplazar” lo sustituye todo.
        </Text>
        {isWeb && <Btn ghost label="Elegir archivo…" onPress={fromFile} style={{ marginBottom: 8 }} />}
        <TextInput
          style={[ui.input, { height: 120, textAlignVertical: 'top' }]}
          multiline
          placeholder='{"app":"depesca", …}'
          placeholderTextColor={colors.muted}
          value={text}
          onChangeText={setText}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={[ui.row, { gap: 8 }]}>
          <Btn label="Combinar" onPress={() => run(text, 'merge')} style={{ flex: 1 }} />
          <Btn ghost label="Reemplazar" onPress={() => run(text, 'replace')} style={{ flex: 1 }} />
        </View>
      </View>
    </ScrollView>
  );
}
