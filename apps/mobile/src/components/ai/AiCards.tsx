import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { INDICATOR_LABEL, PERSPECTIVE_LABEL, PERSPECTIVE_ORDER, type AiCard, type BalanceReport, type DriverNode, type Severity, type StrategyMap } from '@kpi/shared';
import { KpiRow } from '@/components/kpi/KpiCard';
import { AppText, Badge, Button, Card, Row } from '@/components/ui/primitives';
import { useKb } from '@/services/knowledgeBase';
import { radius, severityColors, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

export interface AiCardActions {
  onAddToProject: (kpiIds: string[]) => void;
  onApplyMap: (map: StrategyMap) => void;
}

export function AiCardView({ card, actions }: { card: AiCard; actions: AiCardActions }) {
  switch (card.kind) {
    case 'recommendation':
      return <RecommendationCard card={card} actions={actions} />;
    case 'insight':
      return <InsightCard title={card.title} body={card.body} severity={card.severity} />;
    case 'checklist':
      return <ChecklistCard title={card.title} items={card.items} />;
    case 'kpi-list':
      return <KpiListCard title={card.title} kpiIds={card.kpiIds} note={card.note} actions={actions} />;
    case 'comparison':
      return <ComparisonCard card={card} />;
    case 'driver-tree':
      return <DriverTreeCard title={card.title} tree={card.tree} />;
    case 'balance':
      return <BalanceCard report={card.report} actions={actions} />;
    case 'map-proposal':
      return <MapProposalCard map={card.map} actions={actions} />;
  }
}

function CardTitle({ children }: { children: string }) {
  return (
    <AppText variant="label" muted style={{ marginBottom: space.xs }}>
      {children.toUpperCase()}
    </AppText>
  );
}

function RecommendationCard({ card, actions }: { card: Extract<AiCard, { kind: 'recommendation' }>; actions: AiCardActions }) {
  const { colors } = useTheme();
  const kb = useKb((s) => s.kb);
  const ind = colors.indicator[card.indicator];
  return (
    <Card>
      <CardTitle>Recommendation</CardTitle>
      <AppText variant="heading">{kb.get(card.kpiId)?.name ?? card.title}</AppText>
      <AppText variant="label" muted style={{ marginTop: space.md }}>
        WHY?
      </AppText>
      <AppText>{card.why}</AppText>
      <Row style={{ marginTop: space.md }}>
        <AppText variant="label" muted>
          TYPE
        </AppText>
        <Badge label={INDICATOR_LABEL[card.indicator]} fg={ind.fg} bg={ind.bg} />
      </Row>
      {card.complementIds.length > 0 && (
        <View style={{ marginTop: space.md, gap: 6 }}>
          <AppText variant="label" muted>
            COMPLEMENT WITH
          </AppText>
          <Row wrap gap={6}>
            {kb.require(card.complementIds).map((k) => (
              <Pressable key={k.id} onPress={() => router.push(`/kpi/${k.id}`)} accessibilityRole="link">
                <Badge label={k.name} fg={colors.primary} bg={colors.primarySoft} />
              </Pressable>
            ))}
          </Row>
        </View>
      )}
      <Row style={{ marginTop: space.lg }}>
        <Button small title="View KPI" variant="ghost" icon="open-outline" onPress={() => router.push(`/kpi/${card.kpiId}`)} style={{ flex: 1 }} />
        <Button small title="Add to Project" variant="secondary" icon="add" onPress={() => actions.onAddToProject([card.kpiId])} style={{ flex: 1 }} />
      </Row>
    </Card>
  );
}

export function InsightCard({ title, body, severity }: { title: string; body: string; severity?: Severity }) {
  const { colors } = useTheme();
  const s = severity ? severityColors(colors, severity) : undefined;
  return (
    <Card style={s ? { borderLeftWidth: 4, borderLeftColor: s.fg } : undefined}>
      <CardTitle>{title}</CardTitle>
      <AppText>{body}</AppText>
    </Card>
  );
}

function ChecklistCard({ title, items }: { title: string; items: string[] }) {
  const { colors } = useTheme();
  const [done, setDone] = useState<Set<number>>(new Set());
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      {items.map((item, i) => (
        <Pressable
          key={i}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done.has(i) }}
          onPress={() => setDone((d) => new Set(d.has(i) ? [...d].filter((x) => x !== i) : [...d, i]))}
          style={{ flexDirection: 'row', gap: space.sm, paddingVertical: 6 }}
        >
          <Ionicons name={done.has(i) ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={done.has(i) ? colors.success : colors.textMuted} />
          <AppText style={{ flex: 1, textDecorationLine: done.has(i) ? 'line-through' : 'none' }} muted={done.has(i)}>
            {item}
          </AppText>
        </Pressable>
      ))}
    </Card>
  );
}

function KpiListCard({ title, kpiIds, note, actions }: { title: string; kpiIds: string[]; note?: string; actions: AiCardActions }) {
  const kb = useKb((s) => s.kb);
  const kpis = kb.require(kpiIds);
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      {note && (
        <AppText variant="caption" muted>
          {note}
        </AppText>
      )}
      {kpis.map((k) => (
        <KpiRow key={k.id} kpi={k} />
      ))}
      {kpis.length > 1 && <Button small title={`Add all ${kpis.length} to project`} variant="ghost" icon="add" onPress={() => actions.onAddToProject(kpiIds)} style={{ marginTop: space.sm }} />}
    </Card>
  );
}

function ComparisonCard({ card }: { card: Extract<AiCard, { kind: 'comparison' }> }) {
  const { colors } = useTheme();
  const kb = useKb((s) => s.kb);
  const [a, b] = kb.require(card.kpiIds);
  return (
    <Card>
      <CardTitle>Comparison</CardTitle>
      <Row style={{ marginBottom: space.sm }}>
        <View style={{ width: 82 }} />
        <AppText variant="bodyStrong" style={{ flex: 1 }}>
          {a?.name}
        </AppText>
        <AppText variant="bodyStrong" style={{ flex: 1 }}>
          {b?.name}
        </AppText>
      </Row>
      {card.rows.map((r) => (
        <Row key={r.label} style={{ alignItems: 'flex-start', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
          <AppText variant="label" muted style={{ width: 82 }}>
            {r.label.toUpperCase()}
          </AppText>
          {r.values.map((v, i) => (
            <AppText key={i} variant="caption" style={{ flex: 1 }}>
              {v}
            </AppText>
          ))}
        </Row>
      ))}
      <View style={{ marginTop: space.sm, padding: space.md, borderRadius: radius.sm, backgroundColor: colors.primarySoft }}>
        <AppText variant="caption" color={colors.primary}>
          {card.verdict}
        </AppText>
      </View>
    </Card>
  );
}

/** Driver tree with expand/collapse per branch; only the first level is open initially. */
function DriverTreeCard({ title, tree }: { title: string; tree: DriverNode }) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <TreeNode node={tree} depth={0} />
    </Card>
  );
}

function TreeNode({ node, depth }: { node: DriverNode; depth: number }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(depth === 0);
  const hasChildren = node.children.length > 0;
  return (
    <View style={{ marginLeft: depth === 0 ? 0 : 14, borderLeftWidth: depth === 0 ? 0 : 1, borderLeftColor: colors.border, paddingLeft: depth === 0 ? 0 : 10 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => (hasChildren ? setOpen((o) => !o) : node.kpiId ? router.push(`/kpi/${node.kpiId}`) : undefined)}
        onLongPress={() => node.kpiId && router.push(`/kpi/${node.kpiId}`)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36 }}
      >
        <Ionicons name={hasChildren ? (open ? 'chevron-down' : 'chevron-forward') : node.kpiId ? 'stats-chart-outline' : 'ellipse'} size={hasChildren ? 16 : node.kpiId ? 14 : 6} color={node.kpiId ? colors.primary : colors.textMuted} />
        <AppText variant={depth === 0 ? 'bodyStrong' : 'body'} color={node.kpiId ? colors.text : colors.textMuted} style={{ flex: 1 }}>
          {node.label}
        </AppText>
      </Pressable>
      {open && node.children.map((c) => <TreeNode key={c.id} node={c} depth={depth + 1} />)}
    </View>
  );
}

export function BalanceCard({ report, actions }: { report: BalanceReport; actions?: AiCardActions }) {
  const { colors } = useTheme();
  const total = Object.values(report.perspectives).reduce((a, b) => a + b, 0) || 1;
  const scoreColor = report.score >= 75 ? colors.success : report.score >= 50 ? colors.warning : colors.danger;
  return (
    <Card>
      <CardTitle>KPI balance</CardTitle>
      <Row gap={space.lg}>
        <View style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 6, borderColor: scoreColor, alignItems: 'center', justifyContent: 'center' }}>
          <AppText variant="title" color={scoreColor}>
            {report.score}
          </AppText>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          {PERSPECTIVE_ORDER.map((p) => (
            <Row key={p} gap={6}>
              <AppText variant="caption" style={{ width: 92 }} muted>
                {PERSPECTIVE_LABEL[p]}
              </AppText>
              <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
                <View style={{ width: `${(report.perspectives[p] / total) * 100}%`, height: 8, backgroundColor: colors.perspective[p].fg }} />
              </View>
              <AppText variant="label" style={{ width: 16, textAlign: 'right' }}>
                {report.perspectives[p]}
              </AppText>
            </Row>
          ))}
        </View>
      </Row>
      <Row style={{ marginTop: space.md }}>
        <Badge label={`${report.indicators.leading} leading`} fg={colors.indicator.leading.fg} bg={colors.indicator.leading.bg} />
        <Badge label={`${report.indicators.lagging} lagging`} fg={colors.indicator.lagging.fg} bg={colors.indicator.lagging.bg} />
      </Row>
      <View style={{ marginTop: space.md, gap: 6 }}>
        {report.findings.map((f, i) => {
          const s = severityColors(colors, f.severity);
          return (
            <Row key={i} style={{ alignItems: 'flex-start' }}>
              <Ionicons name={f.severity === 'positive' ? 'checkmark-circle' : f.severity === 'info' ? 'information-circle' : 'alert-circle'} size={18} color={s.fg} />
              <AppText variant="caption" style={{ flex: 1 }}>
                {f.message}
              </AppText>
            </Row>
          );
        })}
      </View>
      {actions && report.suggestedKpiIds.length > 0 && (
        <Button small variant="secondary" icon="add" title="Add suggested KPIs" onPress={() => actions.onAddToProject(report.suggestedKpiIds)} style={{ marginTop: space.md }} />
      )}
    </Card>
  );
}

function MapProposalCard({ map, actions }: { map: StrategyMap; actions: AiCardActions }) {
  const { colors } = useTheme();
  return (
    <Card>
      <CardTitle>Draft strategy map</CardTitle>
      {PERSPECTIVE_ORDER.map((p) => {
        const objs = map.objectives.filter((o) => o.perspective === p);
        if (!objs.length) return null;
        return (
          <View key={p} style={{ paddingVertical: 6 }}>
            <AppText variant="label" color={colors.perspective[p].fg}>
              {PERSPECTIVE_LABEL[p].toUpperCase()}
            </AppText>
            {objs.map((o) => (
              <AppText key={o.id} variant="body">
                • {o.title}
              </AppText>
            ))}
          </View>
        );
      })}
      <Button title="Apply to a project" icon="git-network-outline" onPress={() => actions.onApplyMap(map)} style={{ marginTop: space.md }} />
    </Card>
  );
}
