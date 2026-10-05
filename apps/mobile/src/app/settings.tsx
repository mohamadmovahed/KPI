import Constants from 'expo-constants';
import { useState } from 'react';
import { Alert } from 'react-native';
import { INDUSTRIES } from '@kpi/shared';
import { AppText, Card, Chip, Divider, ListRow, Row, SectionHeader, TextField } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { exportBackup, importBackup } from '@/services/backup';
import { useKb } from '@/services/knowledgeBase';
import { useChat } from '@/state/chat';
import { useProjects } from '@/state/projects';
import { useSettings } from '@/state/settings';
import { space } from '@/theme/tokens';

export default function Settings() {
  const settings = useSettings();
  const kbCount = useKb((s) => s.kb.kpis.length);
  const projectCount = useProjects((s) => s.projects.length);
  const [name, setName] = useState(settings.userName ?? '');

  const run = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      Alert.alert('Backup', e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Screen>
      <SectionHeader title="Your name" />
      <TextField placeholder="Shown in the Home greeting" value={name} onChangeText={setName} onEndEditing={() => settings.set({ userName: name.trim() || undefined })} returnKeyType="done" />

      <SectionHeader title="Appearance" />
      <Row>
        {(['system', 'light', 'dark'] as const).map((t) => (
          <Chip key={t} label={t[0].toUpperCase() + t.slice(1)} selected={settings.theme === t} onPress={() => settings.set({ theme: t })} />
        ))}
      </Row>

      <SectionHeader title="Default industry" />
      <Row wrap>
        <Chip label="None" selected={!settings.defaultIndustry} onPress={() => settings.set({ defaultIndustry: undefined })} />
        {INDUSTRIES.filter((i) => i.id !== 'cross').map((i) => (
          <Chip key={i.id} label={i.label} selected={settings.defaultIndustry === i.id} onPress={() => settings.set({ defaultIndustry: i.id })} />
        ))}
      </Row>

      <SectionHeader title="Backup & restore" />
      <Card>
        <AppText variant="caption" muted>
          Everything is stored only on this phone. Save a backup file to keep your {projectCount} project{projectCount === 1 ? '' : 's'}, collections and saved KPIs safe, or to move them to another phone.
        </AppText>
        <ListRow icon="download-outline" title="Export backup" subtitle="Save or send a .json file" onPress={() => run(exportBackup)} />
        <Divider />
        <ListRow
          icon="cloud-upload-outline"
          title="Restore from backup"
          subtitle="Projects with the same id are replaced"
          onPress={() =>
            run(async () => {
              const r = await importBackup();
              if (r) Alert.alert('Restored', `${r.projects} project${r.projects === 1 ? '' : 's'} and ${r.collections} collection${r.collections === 1 ? '' : 's'} restored.`);
            })
          }
        />
      </Card>

      <SectionHeader title="Privacy" />
      <Card>
        <AppText variant="caption" muted>
          The app works fully offline. It has no account, sends no data anywhere and contains no analytics. The KPI knowledge base ({kbCount} KPIs) and the assistant run on the device.
        </AppText>
        <Divider />
        <ListRow
          icon="trash-outline"
          danger
          title="Clear assistant history"
          onPress={() => Alert.alert('Clear history?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: () => useChat.getState().clear() }])}
        />
      </Card>

      <AppText variant="caption" muted style={{ textAlign: 'center', marginTop: space.xl }}>
        KPI Consultant {Constants.expoConfig?.version ?? ''}
      </AppText>
    </Screen>
  );
}
