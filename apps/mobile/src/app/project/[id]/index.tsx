import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import {
  analyzeBalance,
  generateStrategyMap,
  INDUSTRY_LABEL,
  mapHealth,
  PERSPECTIVE_LABEL,
  PERSPECTIVE_ORDER,
  type InitiativeStatus,
} from '@kpi/shared';
import { BalanceCard } from '@/components/ai/AiCards';
import { KpiRow } from '@/components/kpi/KpiCard';
import { BottomSheet, EmptyState, Segmented } from '@/components/ui/feedback';
import { AppText, Badge, Button, Card, Chip, Divider, IconButton, ListRow, Row, SectionHeader, TextField } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { useKb } from '@/services/knowledgeBase';
import { syncProjects } from '@/services/sync';
import { useChat } from '@/state/chat';
import { useLibrary } from '@/state/library';
import { useProject, useProjects } from '@/state/projects';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

type Tab = 'overview' | 'strategy' | 'kpis' | 'targets' | 'initiatives' | 'diagnostics' | 'reports';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'kpis', label: 'KPIs' },
  { id: 'targets', label: 'Targets' },
  { id: 'initiatives', label: 'Initiatives' },
  { id: 'diagnostics', label: 'Diagnostics' },
  { id: 'reports', label: 'Reports' },
];
const STATUS: InitiativeStatus[] = ['planned', 'active', 'at-risk', 'done'];

export default function ProjectWorkspace() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const kb = useKb((s) => s.kb);
  const project = useProject(id);
  const store = useProjects();
  const setChatProject = useChat((s) => s.setProject);
  const [tab, setTab] = useState<Tab>('overview');
  const [pickKpis, setPickKpis] = useState(false);
  const [editKpi, setEditKpi] = useState<string | null>(null);
  const [draft, setDraft] = useState({ baseline: '', target: '', owner: '' });
  const [initiative, setInitiative] = useState('');
  const [editInfo, setEditInfo] = useState(false);

  const kpis = useMemo(() => (project ? kb.require(project.kpis.map((k) => k.kpiId)) : []), [project, kb]);
  const balance = useMemo(
    () => (project ? analyzeBalance(kpis, { graph: kb.graph, library: kb.kpis, industry: project.industry, projectKpis: project.kpis }) : undefined),
    [project, kpis, kb],
  );
  if (!project || !balance) return <EmptyState icon="briefcase-outline" title="Project not found" />;

  const health = mapHealth(project.map);
  const withTargets = project.kpis.filter((k) => k.target).length;
  const changed = () => syncProjects();

  const openTarget = (kpiId: string) => {
    const pk = project.kpis.find((k) => k.kpiId === kpiId);
    setDraft({ baseline: pk?.baseline ?? '', target: pk?.target ?? '', owner: pk?.owner ?? '' });
    setEditKpi(kpiId);
  };

  const askAi = (prompt: string) => {
    setChatProject(project.id);
    router.push({ pathname: '/assistant', params: { prompt } });
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <IconButton
              icon="ellipsis-horizontal-circle-outline"
              color={colors.primary}
              label="Project actions"
              onPress={() =>
                Alert.alert(project.name, undefined, [
                  { text: 'Edit details', onPress: () => setEditInfo(true) },
                  {
                    text: 'Delete project',
                    style: 'destructive',
                    onPress: () =>
                      Alert.alert('Delete project?', 'This cannot be undone.', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => (store.remove(project.id), changed(), router.back()) },
                      ]),
                  },
                  { text: 'Cancel', style: 'cancel' },
                ])
              }
            />
          ),
        }}
      />
      <Screen>
        <AppText variant="title" accessibilityRole="header">
          {project.name}
        </AppText>
        <AppText muted>{[project.client, project.industry && INDUSTRY_LABEL[project.industry], project.horizon].filter(Boolean).join(' · ') || 'Strategy workspace'}</AppText>
        <View style={{ marginVertical: space.md }}>
          <Segmented value={tab} options={TABS} onChange={setTab} />
        </View>

        {tab === 'overview' && (
          <View style={{ gap: space.md }}>
            {project.strategyStatement && (
              <Card>
                <AppText variant="label" muted>
                  AMBITION
                </AppText>
                <AppText>{project.strategyStatement}</AppText>
              </Card>
            )}
            <Row>
              <Stat label="KPIs" value={String(project.kpis.length)} />
              <Stat label="Objectives" value={String(project.map.objectives.length)} />
              <Stat label="Targets" value={`${withTargets}/${project.kpis.length}`} />
              <Stat label="Balance" value={String(balance.score)} />
            </Row>
            <Card>
              <ListRow icon="git-network-outline" title="Strategy map" subtitle={project.map.objectives.length ? `${project.map.objectives.length} objectives · ${project.map.links.length} links` : 'Not started'} onPress={() => router.push(`/project/${project.id}/map`)} />
              <Divider />
              <ListRow icon="stats-chart-outline" title="KPI scorecard" subtitle={`${project.kpis.length} KPIs`} onPress={() => setTab('kpis')} />
              <Divider />
              <ListRow icon="document-text-outline" title="Executive summary" subtitle="Generate & share from your phone" onPress={() => router.push(`/project/${project.id}/summary`)} />
            </Card>
            <Button title="Ask AI about this project" icon="sparkles-outline" variant="secondary" onPress={() => askAi('Are my KPIs balanced?')} />
          </View>
        )}

        {tab === 'strategy' && (
          <View style={{ gap: space.md }}>
            <Card onPress={() => router.push(`/project/${project.id}/map`)}>
              <Row>
                <AppText variant="heading" style={{ flex: 1 }}>
                  Open strategy map
                </AppText>
                <Badge label="Touch editor" fg={colors.primary} bg={colors.primarySoft} />
              </Row>
              <AppText variant="caption" muted>
                Pinch, pan, tap objectives, long-press to connect, drag to move.
              </AppText>
            </Card>
            {project.map.objectives.length === 0 ? (
              <Card>
                <AppText variant="bodyStrong">Start from a draft</AppText>
                <AppText variant="caption" muted>
                  Generate objectives across the four perspectives with KPIs and cause-and-effect links, then refine by touch.
                </AppText>
                <Button
                  title="Generate draft map"
                  icon="sparkles-outline"
                  style={{ marginTop: space.md }}
                  onPress={() => {
                    const themes = kb.index.search(`${project.name} ${project.strategyStatement ?? ''}`).interpretation.themes;
                    store.setMap(project.id, generateStrategyMap(kb, { themes, industry: project.industry }));
                    changed();
                    router.push(`/project/${project.id}/map`);
                  }}
                />
              </Card>
            ) : (
              PERSPECTIVE_ORDER.map((p) => {
                const objs = project.map.objectives.filter((o) => o.perspective === p);
                if (!objs.length) return null;
                return (
                  <Card key={p}>
                    <AppText variant="label" color={colors.perspective[p].fg}>
                      {PERSPECTIVE_LABEL[p].toUpperCase()}
                    </AppText>
                    {objs.map((o) => (
                      <Row key={o.id} style={{ paddingVertical: 6 }}>
                        <AppText style={{ flex: 1 }}>{o.title}</AppText>
                        <AppText variant="caption" color={o.kpiIds.length ? colors.textMuted : colors.danger}>
                          {o.kpiIds.length} KPI
                        </AppText>
                      </Row>
                    ))}
                  </Card>
                );
              })
            )}
            {health.filter((f) => f.severity !== 'positive').map((f, i) => (
              <AppText key={i} variant="caption" color={colors.warning}>
                ⚠︎ {f.message}
              </AppText>
            ))}
          </View>
        )}

        {tab === 'kpis' && (
          <View style={{ gap: space.md }}>
            <Row>
              <Button title="Add KPIs" icon="add" onPress={() => setPickKpis(true)} style={{ flex: 1 }} />
              <Button title="Recommend" icon="sparkles-outline" variant="secondary" onPress={() => askAi(`Recommend KPIs for ${project.name}${project.industry ? ` in ${INDUSTRY_LABEL[project.industry]}` : ''}`)} style={{ flex: 1 }} />
            </Row>
            {kpis.length === 0 ? (
              <EmptyState icon="stats-chart-outline" title="No KPIs yet" body="Add KPIs from the library, a collection, or the assistant." />
            ) : (
              <Card>
                {kpis.map((k) => (
                  <KpiRow key={k.id} kpi={k} right={<IconButton icon="close" size={18} label={`Remove ${k.name}`} onPress={() => (store.removeKpi(project.id, k.id), changed())} />} />
                ))}
              </Card>
            )}
          </View>
        )}

        {tab === 'targets' && (
          <Card>
            {kpis.length === 0 && <AppText muted>Add KPIs first.</AppText>}
            {kpis.map((k) => {
              const pk = project.kpis.find((x) => x.kpiId === k.id)!;
              return (
                <ListRow
                  key={k.id}
                  title={k.name}
                  subtitle={pk.target ? `Target ${pk.target}${pk.baseline ? ` · baseline ${pk.baseline}` : ''}${pk.owner ? ` · ${pk.owner}` : ''}` : 'No target yet — tap to set'}
                  icon={pk.target ? 'flag' : 'flag-outline'}
                  onPress={() => openTarget(k.id)}
                />
              );
            })}
          </Card>
        )}

        {tab === 'initiatives' && (
          <View style={{ gap: space.md }}>
            <Row>
              <View style={{ flex: 1 }}>
                <TextField placeholder="New initiative, e.g. Network modernisation" value={initiative} onChangeText={setInitiative} onSubmitEditing={() => initiative.trim() && (store.addInitiative(project.id, { title: initiative.trim(), status: 'planned' }), setInitiative(''), changed())} />
              </View>
              <Button title="Add" disabled={!initiative.trim()} onPress={() => (store.addInitiative(project.id, { title: initiative.trim(), status: 'planned' }), setInitiative(''), changed())} />
            </Row>
            {project.initiatives.map((i) => (
              <Card key={i.id}>
                <Row>
                  <AppText variant="bodyStrong" style={{ flex: 1 }}>
                    {i.title}
                  </AppText>
                  <IconButton icon="trash-outline" size={18} label="Delete initiative" onPress={() => (store.removeInitiative(project.id, i.id), changed())} />
                </Row>
                <Row wrap gap={6}>
                  {STATUS.map((s) => (
                    <Chip key={s} label={s} selected={i.status === s} onPress={() => (store.updateInitiative(project.id, i.id, { status: s }), changed())} />
                  ))}
                </Row>
              </Card>
            ))}
          </View>
        )}

        {tab === 'diagnostics' && (
          <View style={{ gap: space.md }}>
            <BalanceCard report={balance} actions={{ onAddToProject: (ids) => (store.addKpis(project.id, ids), changed()), onApplyMap: () => undefined }} />
            <SectionHeader title="Investigate" />
            <Card>
              <ListRow icon="pulse-outline" title="Diagnose a KPI movement" subtitle="Driver tree, hypotheses and data to request" onPress={() => router.push('/diagnostics')} />
              <Divider />
              <ListRow icon="sparkles-outline" title="Ask: Are my KPIs balanced?" onPress={() => askAi('Are my KPIs balanced?')} />
            </Card>
          </View>
        )}

        {tab === 'reports' && (
          <Card>
            <ListRow icon="document-text-outline" title="Executive summary" subtitle="One-pager: context, objectives, scorecard, balance, next steps" onPress={() => router.push(`/project/${project.id}/summary`)} />
            <Divider />
            <ListRow icon="git-network-outline" title="Strategy map snapshot" subtitle="Open the map and share the outline" onPress={() => router.push(`/project/${project.id}/map`)} />
          </Card>
        )}
      </Screen>

      <KpiPicker visible={pickKpis} onClose={() => setPickKpis(false)} projectId={project.id} />

      <BottomSheet
        visible={Boolean(editKpi)}
        onClose={() => setEditKpi(null)}
        title={editKpi ? kb.get(editKpi)?.name : ''}
        footer={
          <Button
            title="Save target"
            full
            onPress={() => {
              if (editKpi) store.updateKpi(project.id, editKpi, { baseline: draft.baseline.trim() || undefined, target: draft.target.trim() || undefined, owner: draft.owner.trim() || undefined });
              setEditKpi(null);
              changed();
            }}
          />
        }
      >
        {editKpi && (
          <AppText variant="caption" muted>
            {kb.get(editKpi)?.direction === 'lower' ? 'Lower is better.' : kb.get(editKpi)?.direction === 'higher' ? 'Higher is better.' : 'Keep within a band.'}{' '}
            {kb.get(editKpi)?.benchmarks[0] ? `Reference: ${kb.get(editKpi)!.benchmarks[0].value}${kb.get(editKpi)!.benchmarks[0].illustrative ? ' (indicative)' : ''}.` : ''}
          </AppText>
        )}
        <TextField label="Baseline" placeholder="e.g. 4.0%" value={draft.baseline} onChangeText={(baseline) => setDraft((d) => ({ ...d, baseline }))} />
        <TextField label="Target" placeholder="e.g. 2.5% by 2028" value={draft.target} onChangeText={(target) => setDraft((d) => ({ ...d, target }))} />
        <TextField label="Owner" placeholder="e.g. Chief Customer Officer" value={draft.owner} onChangeText={(owner) => setDraft((d) => ({ ...d, owner }))} />
      </BottomSheet>

      <EditInfoSheet visible={editInfo} onClose={() => setEditInfo(false)} projectId={project.id} />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ flex: 1, padding: space.md }}>
      <AppText variant="title">{value}</AppText>
      <AppText variant="caption" muted>
        {label}
      </AppText>
    </Card>
  );
}

/** Pick KPIs from saved items, collections, or search — without leaving the project. */
function KpiPicker({ visible, onClose, projectId }: { visible: boolean; onClose: () => void; projectId: string }) {
  const kb = useKb((s) => s.kb);
  const [q, setQ] = useState('');
  const [add, setAdd] = useState<string[] | null>(null);
  const hits = useMemo(() => kb.index.search(q, { limit: 20 }).hits.map((h) => h.kpi), [kb, q]);
  const store = useProjects();
  const project = store.projects.find((p) => p.id === projectId);
  const inProject = new Set(project?.kpis.map((k) => k.kpiId));
  return (
    <>
      <BottomSheet visible={visible} onClose={onClose} title="Add KPIs" maxHeightRatio={0.92}>
        <TextField placeholder="Search KPIs…" value={q} onChangeText={setQ} autoCorrect={false} />
        {hits.map((k) => (
          <KpiRow
            key={k.id}
            kpi={k}
            onPress={() => {
              if (!inProject.has(k.id)) {
                store.addKpis(projectId, [k.id]);
                syncProjects();
              }
            }}
            right={<AppText variant="label">{inProject.has(k.id) ? '✓ Added' : '+ Add'}</AppText>}
          />
        ))}
        <Button small variant="ghost" title="Add from a collection" icon="albums-outline" onPress={() => setAdd([])} />
      </BottomSheet>
      <CollectionPicker visible={add !== null} onClose={() => setAdd(null)} projectId={projectId} />
    </>
  );
}

function CollectionPicker({ visible, onClose, projectId }: { visible: boolean; onClose: () => void; projectId: string }) {
  const collections = useLibrary((s) => s.collections);
  const addKpis = useProjects((s) => s.addKpis);
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add from collection">
      {collections.length === 0 && <AppText muted>No collections yet. Save KPIs into collections from any KPI page.</AppText>}
      {collections.map((c) => (
        <ListRow key={c.id} icon="albums-outline" title={c.name} subtitle={`${c.kpiIds.length} KPIs`} onPress={() => (addKpis(projectId, c.kpiIds), syncProjects(), onClose())} />
      ))}
    </BottomSheet>
  );
}


function EditInfoSheet({ visible, onClose, projectId }: { visible: boolean; onClose: () => void; projectId: string }) {
  const project = useProject(projectId);
  const update = useProjects((s) => s.update);
  const [form, setForm] = useState({ name: project?.name ?? '', client: project?.client ?? '', horizon: project?.horizon ?? '', strategyStatement: project?.strategyStatement ?? '' });
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Project details"
      footer={
        <Button
          title="Save"
          full
          disabled={!form.name.trim()}
          onPress={() => {
            update(projectId, { name: form.name.trim(), client: form.client.trim() || undefined, horizon: form.horizon.trim() || undefined, strategyStatement: form.strategyStatement.trim() || undefined });
            syncProjects();
            onClose();
          }}
        />
      }
    >
      <TextField label="Name" value={form.name} onChangeText={(name) => setForm((f) => ({ ...f, name }))} />
      <TextField label="Client" value={form.client} onChangeText={(client) => setForm((f) => ({ ...f, client }))} />
      <TextField label="Horizon" value={form.horizon} onChangeText={(horizon) => setForm((f) => ({ ...f, horizon }))} />
      <TextField label="Ambition" value={form.strategyStatement} onChangeText={(strategyStatement) => setForm((f) => ({ ...f, strategyStatement }))} multiline style={{ minHeight: 80 }} />
    </BottomSheet>
  );
}

