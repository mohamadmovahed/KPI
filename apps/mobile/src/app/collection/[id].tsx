import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { analyzeBalance } from '@kpi/shared';
import { BalanceCard } from '@/components/ai/AiCards';
import { KpiRow } from '@/components/kpi/KpiCard';
import { AddToProjectSheet } from '@/components/kpi/sheets';
import { BottomSheet, EmptyState } from '@/components/ui/feedback';
import { Button, Card, IconButton, Row, TextField } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { useKb } from '@/services/knowledgeBase';
import { share } from '@/services/share';
import { useLibrary } from '@/state/library';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

export default function CollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const kb = useKb((s) => s.kb);
  const collection = useLibrary((s) => s.collections.find((c) => c.id === id));
  const { addToCollection, removeFromCollection, renameCollection, deleteCollection } = useLibrary();
  const [adding, setAdding] = useState(false);
  const [toProject, setToProject] = useState(false);
  const [q, setQ] = useState('');
  const hits = useMemo(() => kb.index.search(q, { limit: 15 }).hits.map((h) => h.kpi), [kb, q]);
  const kpis = collection ? kb.require(collection.kpiIds) : [];
  const balance = useMemo(() => analyzeBalance(kpis, { graph: kb.graph, library: kb.kpis }), [kpis, kb]);
  if (!collection) return <EmptyState icon="albums-outline" title="Collection not found" />;

  return (
    <>
      <Stack.Screen
        options={{
          title: collection.name,
          headerRight: () => (
            <IconButton
              icon="ellipsis-horizontal-circle-outline"
              color={colors.primary}
              label="Collection actions"
              onPress={() =>
                Alert.alert(collection.name, undefined, [
                  {
                    text: 'Rename',
                    onPress: () => Alert.prompt?.('Rename collection', undefined, (t) => t && renameCollection(collection.id, t), 'plain-text', collection.name),
                  },
                  { text: 'Share list', onPress: () => share.text([collection.name, '', ...kpis.map((k) => `• ${k.name} — ${k.formula}`)].join('\n'), collection.name) },
                  { text: 'Delete', style: 'destructive', onPress: () => (deleteCollection(collection.id), router.back()) },
                  { text: 'Cancel', style: 'cancel' },
                ])
              }
            />
          ),
        }}
      />
      <Screen>
        <Row>
          <Button title="Add KPIs" icon="add" onPress={() => setAdding(true)} style={{ flex: 1 }} />
          <Button title="Use in project" icon="briefcase-outline" variant="secondary" disabled={!kpis.length} onPress={() => setToProject(true)} style={{ flex: 1 }} />
        </Row>
        {kpis.length === 0 ? (
          <EmptyState icon="albums-outline" title="Empty collection" body="Add KPIs you reuse across similar clients." />
        ) : (
          <>
            <Card style={{ marginTop: space.md }}>
              {kpis.map((k) => (
                <KpiRow key={k.id} kpi={k} right={<IconButton icon="close" size={18} label={`Remove ${k.name}`} onPress={() => removeFromCollection(collection.id, k.id)} />} />
              ))}
            </Card>
            <Card style={{ marginTop: space.md, padding: 0 }} padded={false}>
              <BalanceCard report={balance} />
            </Card>
          </>
        )}
      </Screen>
      <BottomSheet visible={adding} onClose={() => setAdding(false)} title="Add KPIs" maxHeightRatio={0.9}>
        <TextField placeholder="Search KPIs…" value={q} onChangeText={setQ} autoCorrect={false} />
        {hits.map((k) => (
          <KpiRow key={k.id} kpi={k} onPress={() => addToCollection(collection.id, [k.id])} right={<Button small variant="ghost" title={collection.kpiIds.includes(k.id) ? 'Added' : 'Add'} onPress={() => addToCollection(collection.id, [k.id])} />} />
        ))}
      </BottomSheet>
      <AddToProjectSheet kpiIds={collection.kpiIds} visible={toProject} onClose={() => setToProject(false)} />
    </>
  );
}
