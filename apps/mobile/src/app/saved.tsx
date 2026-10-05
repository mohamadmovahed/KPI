import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { KpiRow } from '@/components/kpi/KpiCard';
import { AddToProjectSheet } from '@/components/kpi/sheets';
import { EmptyState, Segmented } from '@/components/ui/feedback';
import { AppText, Button, Card, Icon, IconButton, Row, TextField } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { useKb } from '@/services/knowledgeBase';
import { useChat } from '@/state/chat';
import { useLibrary } from '@/state/library';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

type Tab = 'kpis' | 'collections' | 'conversations';

export default function Saved() {
  const { colors } = useTheme();
  const kb = useKb((s) => s.kb);
  const { savedIds, collections, toggleSaved, createCollection } = useLibrary();
  const messages = useChat((s) => s.messages);
  const [tab, setTab] = useState<Tab>('kpis');
  const [name, setName] = useState('');
  const [addAll, setAddAll] = useState(false);
  const saved = kb.require(savedIds);
  const questions = messages.filter((m) => m.role === 'user').slice(-20).reverse();

  return (
    <Screen>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { id: 'kpis', label: `KPIs · ${saved.length}` },
          { id: 'collections', label: `Collections · ${collections.length}` },
          { id: 'conversations', label: 'AI conversations' },
        ]}
      />
      <View style={{ marginTop: space.md, gap: space.md }}>
        {tab === 'kpis' &&
          (saved.length === 0 ? (
            <EmptyState icon="bookmark-outline" title="No saved KPIs" body="Tap the bookmark on any KPI to keep it available offline." action="Browse library" onAction={() => router.push('/library')} />
          ) : (
            <>
              <Card>
                {saved.map((k) => (
                  <KpiRow key={k.id} kpi={k} right={<IconButton icon="bookmark" size={18} color={colors.primary} label={`Unsave ${k.name}`} onPress={() => toggleSaved(k.id)} />} />
                ))}
              </Card>
              <Row>
                <Button title="Add all to project" icon="add" variant="secondary" onPress={() => setAddAll(true)} style={{ flex: 1 }} />
                <Button title="Save as collection" icon="albums-outline" variant="ghost" onPress={() => router.push(`/collection/${createCollection('Saved KPIs', savedIds).id}`)} style={{ flex: 1 }} />
              </Row>
            </>
          ))}

        {tab === 'collections' && (
          <>
            <Row>
              <View style={{ flex: 1 }}>
                <TextField placeholder="New collection name" value={name} onChangeText={setName} />
              </View>
              <Button title="Create" disabled={!name.trim()} onPress={() => (router.push(`/collection/${createCollection(name).id}`), setName(''))} />
            </Row>
            {collections.length === 0 && <EmptyState icon="albums-outline" title="No collections" body="Group KPIs you reuse across clients, e.g. “Telecom corporate KPIs”." />}
            {collections.map((c) => (
              <Card key={c.id} onPress={() => router.push(`/collection/${c.id}`)}>
                <Row>
                  <Icon name="albums-outline" color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyStrong">{c.name}</AppText>
                    <AppText variant="caption" muted>
                      {c.kpiIds.length} KPIs
                    </AppText>
                  </View>
                  <Icon name="chevron-forward" size={16} color={colors.textMuted} />
                </Row>
              </Card>
            ))}
          </>
        )}

        {tab === 'conversations' &&
          (questions.length === 0 ? (
            <EmptyState icon="chatbubbles-outline" title="No conversations yet" body="AI answers are cached here for offline reference." />
          ) : (
            <Card>
              {questions.map((m) => (
                <View key={m.id} style={{ paddingVertical: space.sm }}>
                  <AppText variant="bodyStrong" onPress={() => router.push('/assistant')}>
                    {m.text}
                  </AppText>
                  <AppText variant="caption" muted>
                    {new Date(m.createdAt).toLocaleString()}
                  </AppText>
                </View>
              ))}
            </Card>
          ))}
      </View>
      <AddToProjectSheet kpiIds={savedIds} visible={addAll} onClose={() => setAddAll(false)} />
    </Screen>
  );
}
