import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { generateStrategyMap, mapHealth, PERSPECTIVE_LABEL, PERSPECTIVE_ORDER, type BscPerspective } from '@kpi/shared';
import { KpiRow } from '@/components/kpi/KpiCard';
import { StrategyMapCanvas } from '@/components/map/StrategyMapCanvas';
import { BottomSheet, EmptyState } from '@/components/ui/feedback';
import { AppText, Button, Chip, IconButton, ListRow, Row, TextField } from '@/components/ui/primitives';
import { useKb } from '@/services/knowledgeBase';
import { share } from '@/services/share';
import { syncProjects } from '@/services/sync';
import { useProject, useProjects } from '@/state/projects';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

export default function StrategyMapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const kb = useKb((s) => s.kb);
  const project = useProject(id);
  const store = useProjects();
  const [selected, setSelected] = useState<string>();
  const [connectFrom, setConnectFrom] = useState<string>();
  const [sheet, setSheet] = useState<'add' | 'edit' | 'kpi' | null>(null);
  const [title, setTitle] = useState('');
  const [perspective, setPerspective] = useState<BscPerspective>('customer');
  const [kpiQuery, setKpiQuery] = useState('');

  const objective = project?.map.objectives.find((o) => o.id === selected);
  const kpiHits = useMemo(() => kb.index.search(kpiQuery || objective?.title || '', { limit: 12 }).hits.map((h) => h.kpi), [kb, kpiQuery, objective?.title]);
  if (!project) return <EmptyState icon="git-network-outline" title="Project not found" />;
  const changed = () => syncProjects();

  const onTap = (oid: string) => {
    if (connectFrom) {
      if (oid !== connectFrom) {
        store.toggleLink(project.id, connectFrom, oid);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        changed();
      }
      setConnectFrom(undefined);
      return;
    }
    setSelected(oid);
  };

  const linked = objective
    ? project.map.links
        .filter((l) => l.from === objective.id || l.to === objective.id)
        .map((l) => project.map.objectives.find((o) => o.id === (l.from === objective.id ? l.to : l.from)))
        .filter(Boolean)
    : [];
  const objectiveKpis = objective ? kb.require(objective.kpiIds) : [];
  const leading = objective
    ? [...new Map(objectiveKpis.flatMap((k) => kb.graph.drivers(k.id)).filter((k) => k.indicator === 'leading' && !objective.kpiIds.includes(k.id)).map((k) => [k.id, k])).values()].slice(0, 4)
    : [];

  const outline = () =>
    [
      `${project.name} — Strategy map`,
      '',
      ...PERSPECTIVE_ORDER.flatMap((p) => {
        const objs = project.map.objectives.filter((o) => o.perspective === p);
        return objs.length ? [PERSPECTIVE_LABEL[p].toUpperCase(), ...objs.map((o) => `• ${o.title}${o.kpiIds.length ? ` — ${kb.require(o.kpiIds).map((k) => k.name).join(', ')}` : ''}`), ''] : [];
      }),
    ].join('\n');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Row gap={0}>
              <IconButton icon="share-outline" color={colors.primary} label="Share map outline" onPress={() => share.text(outline(), `${project.name} strategy map`)} />
              <IconButton
                icon="medkit-outline"
                color={colors.primary}
                label="Check map health"
                onPress={() => Alert.alert('Strategy map check', mapHealth(project.map).map((f) => `• ${f.message}`).join('\n') || 'Add objectives to begin.')}
              />
            </Row>
          ),
        }}
      />

      {connectFrom && (
        <Row style={{ padding: space.md, backgroundColor: colors.accent }}>
          <AppText variant="bodyStrong" color="#fff" style={{ flex: 1 }}>
            Tap an objective to connect “{project.map.objectives.find((o) => o.id === connectFrom)?.title}”
          </AppText>
          <Button small variant="ghost" title="Cancel" onPress={() => setConnectFrom(undefined)} style={{ borderColor: '#fff' }} />
        </Row>
      )}

      {project.map.objectives.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', padding: space.lg }}>
          <EmptyState icon="git-network-outline" title="Empty strategy map" body="Generate a draft from the project’s themes, or add objectives one by one." />
          <Button
            title="Generate draft map"
            icon="sparkles-outline"
            onPress={() => {
              const themes = kb.index.search(`${project.name} ${project.strategyStatement ?? ''}`).interpretation.themes;
              store.setMap(project.id, generateStrategyMap(kb, { themes, industry: project.industry }));
              changed();
            }}
          />
        </View>
      ) : (
        <StrategyMapCanvas
          map={project.map}
          selectedId={selected}
          connectFromId={connectFrom}
          editable
          onTapObjective={onTap}
          onLongPressObjective={(oid) => {
            setSelected(undefined);
            setConnectFrom(oid);
          }}
          onMoveObjective={(oid, x, y) => {
            store.moveObjective(project.id, oid, x, y);
            changed();
          }}
          onTapBackground={() => setConnectFrom(undefined)}
        />
      )}

      <Row style={{ padding: space.md, paddingBottom: space.xl, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
        <Button title="Objective" icon="add" onPress={() => (setTitle(''), setSheet('add'))} style={{ flex: 1 }} />
        <Button title="Tidy" icon="grid-outline" variant="secondary" onPress={() => (store.autoLayout(project.id), changed())} disabled={!project.map.objectives.length} />
      </Row>

      {/* Objective details */}
      <BottomSheet visible={Boolean(objective) && sheet === null} onClose={() => setSelected(undefined)} title={objective?.title}>
        {objective && (
          <>
            <Chip label={PERSPECTIVE_LABEL[objective.perspective]} selected />
            <AppText variant="label" muted>
              KPIS
            </AppText>
            {objectiveKpis.length === 0 && <AppText muted>No KPI yet — every objective needs at least one.</AppText>}
            {objectiveKpis.map((k) => (
              <KpiRow
                key={k.id}
                kpi={k}
                right={<IconButton icon="close" size={18} label={`Remove ${k.name}`} onPress={() => (store.updateObjective(project.id, objective.id, { kpiIds: objective.kpiIds.filter((x) => x !== k.id) }), changed())} />}
              />
            ))}
            {leading.length > 0 && (
              <>
                <AppText variant="label" muted>
                  LEADING INDICATORS
                </AppText>
                {leading.map((k) => (
                  <KpiRow key={k.id} kpi={k} right={<AppText variant="label" color={colors.primary} onPress={() => (store.updateObjective(project.id, objective.id, { kpiIds: [...objective.kpiIds, k.id] }), changed())}>+ Add</AppText>} />
                ))}
              </>
            )}
            {linked.length > 0 && (
              <>
                <AppText variant="label" muted>
                  RELATED OBJECTIVES
                </AppText>
                {linked.map((o) => (
                  <ListRow key={o!.id} icon="git-commit-outline" title={o!.title} subtitle={PERSPECTIVE_LABEL[o!.perspective]} onPress={() => setSelected(o!.id)} />
                ))}
              </>
            )}
            <Row wrap>
              <Button small icon="add" title="Add KPI" onPress={() => (setKpiQuery(''), setSheet('kpi'))} />
              <Button small icon="link-outline" variant="secondary" title="Connect" onPress={() => (setConnectFrom(objective.id), setSelected(undefined))} />
              <Button small icon="create-outline" variant="ghost" title="Edit" onPress={() => (setTitle(objective.title), setPerspective(objective.perspective), setSheet('edit'))} />
              <Button
                small
                icon="trash-outline"
                variant="danger"
                title="Delete"
                onPress={() =>
                  Alert.alert('Delete objective?', objective.title, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => (store.deleteObjective(project.id, objective.id), setSelected(undefined), changed()) },
                  ])
                }
              />
            </Row>
          </>
        )}
      </BottomSheet>

      {/* Add / edit objective */}
      <BottomSheet
        visible={sheet === 'add' || sheet === 'edit'}
        onClose={() => setSheet(null)}
        title={sheet === 'add' ? 'New objective' : 'Edit objective'}
        footer={
          <Button
            title={sheet === 'add' ? 'Add objective' : 'Save'}
            full
            disabled={!title.trim()}
            onPress={() => {
              if (sheet === 'add') {
                const o = store.addObjective(project.id, title, perspective);
                setSelected(o.id);
              } else if (objective) {
                store.updateObjective(project.id, objective.id, { title: title.trim(), perspective });
              }
              setSheet(null);
              changed();
            }}
          />
        }
      >
        <TextField label="Objective" placeholder="Improve customer loyalty" value={title} onChangeText={setTitle} autoFocus />
        <AppText variant="label" muted>
          PERSPECTIVE
        </AppText>
        <Row wrap>
          {PERSPECTIVE_ORDER.map((p) => (
            <Chip key={p} label={PERSPECTIVE_LABEL[p]} selected={perspective === p} onPress={() => setPerspective(p)} />
          ))}
        </Row>
      </BottomSheet>

      {/* Attach KPI */}
      <BottomSheet visible={sheet === 'kpi'} onClose={() => setSheet(null)} title="Add KPI to objective" maxHeightRatio={0.9}>
        <TextField placeholder="Search KPIs…" value={kpiQuery} onChangeText={setKpiQuery} autoCorrect={false} />
        {!kpiQuery && objective && (
          <AppText variant="caption" muted>
            Suggestions for “{objective.title}”
          </AppText>
        )}
        {kpiHits.map((k) => {
          const added = objective?.kpiIds.includes(k.id);
          return (
            <View key={k.id} style={{ borderRadius: radius.sm }}>
              <KpiRow
                kpi={k}
                onPress={() => {
                  if (objective && !added) {
                    store.updateObjective(project.id, objective.id, { kpiIds: [...objective.kpiIds, k.id] });
                    changed();
                  }
                }}
                right={<AppText variant="label">{added ? '✓ Added' : '+ Add'}</AppText>}
              />
            </View>
          );
        })}
        <Button title="Done" variant="secondary" onPress={() => setSheet(null)} />
      </BottomSheet>
    </View>
  );
}
