import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { INDUSTRY_LABEL } from '@kpi/shared';
import { BottomSheet } from '@/components/ui/feedback';
import { Button, Divider, ListRow, TextField } from '@/components/ui/primitives';
import { useLibrary } from '@/state/library';
import { useProjects } from '@/state/projects';
import { syncProjects } from '@/services/sync';

export function AddToProjectSheet({ kpiIds, visible, onClose }: { kpiIds: string[]; visible: boolean; onClose: () => void }) {
  const projects = useProjects((s) => s.projects);
  const addKpis = useProjects((s) => s.addKpis);

  const add = (projectId: string, name: string) => {
    const n = addKpis(projectId, kpiIds);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    syncProjects();
    onClose();
    Alert.alert(n ? 'Added' : 'Already in project', n ? `${n} KPI${n > 1 ? 's' : ''} added to ${name}.` : `These KPIs are already in ${name}.`, [
      { text: 'OK' },
      { text: 'Open project', onPress: () => router.push(`/project/${projectId}`) },
    ]);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`Add ${kpiIds.length > 1 ? `${kpiIds.length} KPIs` : 'KPI'} to project`}>
      {projects.map((p) => (
        <ListRow key={p.id} icon="briefcase-outline" title={p.name} subtitle={`${p.kpis.length} KPIs${p.industry ? ` · ${INDUSTRY_LABEL[p.industry]}` : ''}`} onPress={() => add(p.id, p.name)} />
      ))}
      {projects.length > 0 && <Divider />}
      <ListRow
        icon="add"
        title="New project"
        subtitle="Create a project and add these KPIs"
        onPress={() => {
          onClose();
          router.push({ pathname: '/project/new', params: { kpiIds: kpiIds.join(',') } });
        }}
      />
    </BottomSheet>
  );
}

export function SaveToCollectionSheet({ kpiIds, visible, onClose }: { kpiIds: string[]; visible: boolean; onClose: () => void }) {
  const collections = useLibrary((s) => s.collections);
  const addToCollection = useLibrary((s) => s.addToCollection);
  const createCollection = useLibrary((s) => s.createCollection);
  const [name, setName] = useState('');

  const done = (label: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    onClose();
    Alert.alert('Saved', `Added to “${label}”.`);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Save to collection">
      {collections.map((c) => (
        <ListRow
          key={c.id}
          icon="albums-outline"
          title={c.name}
          subtitle={`${c.kpiIds.length} KPIs`}
          onPress={() => {
            addToCollection(c.id, kpiIds);
            done(c.name);
          }}
        />
      ))}
      <TextField label="New collection" placeholder="e.g. Telecom corporate KPIs" value={name} onChangeText={setName} returnKeyType="done" />
      <Button
        title="Create & save"
        icon="add"
        disabled={!name.trim()}
        onPress={() => {
          const c = createCollection(name, kpiIds);
          setName('');
          done(c.name);
        }}
      />
    </BottomSheet>
  );
}
