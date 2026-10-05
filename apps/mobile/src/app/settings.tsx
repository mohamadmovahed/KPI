import Constants from 'expo-constants';
import { useState } from 'react';
import { Alert, Switch } from 'react-native';
import { INDUSTRIES } from '@kpi/shared';
import { AppText, Button, Card, Chip, Divider, ListRow, Row, SectionHeader, TextField } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { apiBaseUrl } from '@/services/api';
import { syncKnowledgeBase, useKb } from '@/services/knowledgeBase';
import { useChat } from '@/state/chat';
import { useSettings } from '@/state/settings';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

export default function Settings() {
  const { colors } = useTheme();
  const settings = useSettings();
  const kbCount = useKb((s) => s.kb.kpis.length);
  const version = useKb((s) => s.version);
  const [url, setUrl] = useState(settings.apiUrl ?? '');

  return (
    <Screen>
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

      <SectionHeader title="Notifications" />
      <Card>
        <ListRow
          icon="notifications-outline"
          title="Project & benchmark updates"
          subtitle="Quiet nudges such as KPIs without targets. Push delivery arrives with Phase 2."
          right={<Switch value={settings.notifications} onValueChange={(v) => settings.set({ notifications: v })} trackColor={{ true: colors.primary }} />}
        />
      </Card>

      <SectionHeader title="Knowledge base" />
      <Card>
        <AppText>
          {kbCount} KPIs available offline{version ? ` · dataset ${version}` : ' · bundled dataset'}
        </AppText>
        <Button small variant="ghost" title="Check for updates" icon="refresh" style={{ marginTop: space.sm }} onPress={async () => (await syncKnowledgeBase(), Alert.alert('Knowledge base', 'Up to date.'))} />
      </Card>

      <SectionHeader title="Server" />
      <Card>
        <TextField label="API URL" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder={apiBaseUrl()} />
        <Button small title="Save" style={{ marginTop: space.sm }} onPress={() => (settings.set({ apiUrl: url.trim() || undefined }), Alert.alert('Saved', `Using ${apiBaseUrl()}`))} />
      </Card>

      <SectionHeader title="Privacy & security" />
      <Card>
        <AppText variant="caption" muted>
          Sign-in tokens are stored in the device keychain/keystore. Projects are stored on this device and, when signed in, synced over HTTPS to your organisation’s workspace with project-level permissions. Prompts are not written to logs.
        </AppText>
        <Divider />
        <ListRow icon="trash-outline" danger title="Clear AI conversation history" onPress={() => Alert.alert('Clear history?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: () => useChat.getState().clear() }])} />
      </Card>

      <AppText variant="caption" muted style={{ textAlign: 'center', marginTop: space.xl }}>
        KPI Consultant {Constants.expoConfig?.version ?? ''}
      </AppText>
    </Screen>
  );
}
