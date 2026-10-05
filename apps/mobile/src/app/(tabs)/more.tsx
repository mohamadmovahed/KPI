import { router } from 'expo-router';
import { Alert } from 'react-native';
import { Card, Divider, ListRow, SectionHeader } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/state/auth';
import { useLibrary } from '@/state/library';
import { useProjects } from '@/state/projects';

export default function More() {
  const { status, user, signOut } = useAuth();
  const saved = useLibrary((s) => s.savedIds.length);
  const collections = useLibrary((s) => s.collections.length);
  const projects = useProjects((s) => s.projects);

  return (
    <Screen title="More" safeTop>
      <Card>
        <ListRow
          icon="person-circle-outline"
          title={user ? user.name : 'Guest'}
          subtitle={user ? `${user.email} · ${user.role}` : 'Sign in to sync projects and use the AI consultant'}
          onPress={status === 'guest' ? () => signOut() : undefined}
        />
      </Card>

      <SectionHeader title="Workspace" />
      <Card>
        <ListRow icon="bookmark-outline" title="Saved KPIs & collections" subtitle={`${saved} saved · ${collections} collections`} onPress={() => router.push('/saved')} />
        <Divider />
        <ListRow icon="document-text-outline" title="Reports" subtitle="Executive summaries per project" onPress={() => (projects.length ? router.push('/projects') : Alert.alert('No projects yet', 'Create a project to generate reports.'))} />
      </Card>

      <SectionHeader title="Analysis" />
      <Card>
        <ListRow icon="pulse-outline" title="Diagnostics" subtitle="Investigate why a KPI moved" onPress={() => router.push('/diagnostics')} />
        <Divider />
        <ListRow icon="scan-outline" title="Analyze a document" subtitle="Photo or PDF of a KPI table, dashboard or strategy map" onPress={() => router.push('/scan')} />
        <Divider />
        <ListRow icon="bar-chart-outline" title="Benchmarking" subtitle="Orientation ranges today · sourced benchmarks in Phase 2" onPress={() => router.push('/benchmarks')} />
      </Card>

      <SectionHeader title="App" />
      <Card>
        <ListRow icon="settings-outline" title="Settings" subtitle="Appearance, server, notifications, privacy" onPress={() => router.push('/settings')} />
        <Divider />
        <ListRow
          icon="log-out-outline"
          danger
          title={status === 'signedIn' ? 'Sign out' : 'Sign in'}
          onPress={() =>
            status === 'signedIn'
              ? Alert.alert('Sign out?', 'Local data stays on this device.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: signOut }])
              : signOut()
          }
        />
      </Card>
    </Screen>
  );
}
