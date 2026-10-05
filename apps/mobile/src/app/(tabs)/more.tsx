import { router } from 'expo-router';
import { Alert } from 'react-native';
import { Card, Divider, ListRow, SectionHeader } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { useLibrary } from '@/state/library';
import { useProjects } from '@/state/projects';

export default function More() {
  const saved = useLibrary((s) => s.savedIds.length);
  const collections = useLibrary((s) => s.collections.length);
  const projects = useProjects((s) => s.projects);

  return (
    <Screen title="More" safeTop>
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
        <ListRow icon="bar-chart-outline" title="Benchmarks" subtitle="Indicative orientation ranges" onPress={() => router.push('/benchmarks')} />
      </Card>

      <SectionHeader title="App" />
      <Card>
        <ListRow icon="settings-outline" title="Settings & backup" subtitle="Appearance, your name, backup and restore" onPress={() => router.push('/settings')} />
      </Card>
    </Screen>
  );
}
