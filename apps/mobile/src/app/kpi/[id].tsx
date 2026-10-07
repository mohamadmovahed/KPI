import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { FUNCTION_LABEL, INDUSTRY_LABEL, KPI_TYPE_LABEL, LEVEL_LABEL, PERSPECTIVE_LABEL, qualityScore, SOURCE_BY_ID, type Kpi } from '@kpi/shared';
import { KpiBadges, KpiRow, QualityPill } from '@/components/kpi/KpiCard';
import { AddToProjectSheet, SaveToCollectionSheet } from '@/components/kpi/sheets';
import { Accordion, BottomSheet, EmptyState } from '@/components/ui/feedback';
import { AppText, Button, Card, Icon, IconButton, ListRow, Row } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { useKb } from '@/services/knowledgeBase';
import { kpiCardText, share } from '@/services/share';
import { useLibrary } from '@/state/library';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

function Bullets({ items }: { items: string[] }) {
  return (
    <View style={{ gap: 6 }}>
      {items.map((t, i) => (
        <Row key={i} style={{ alignItems: 'flex-start' }}>
          <AppText muted>•</AppText>
          <AppText style={{ flex: 1 }}>{t}</AppText>
        </Row>
      ))}
    </View>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Row style={{ alignItems: 'flex-start' }}>
      <AppText variant="label" muted style={{ width: 110, paddingTop: 2 }}>
        {label.toUpperCase()}
      </AppText>
      <AppText style={{ flex: 1 }}>{value}</AppText>
    </Row>
  );
}

export default function KpiDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const kb = useKb((s) => s.kb);
  const kpi = kb.get(id);
  const saved = useLibrary((s) => s.savedIds.includes(id));
  const { toggleSaved, addRecent } = useLibrary();
  const [sheet, setSheet] = useState<'project' | 'collection' | 'share' | 'compare' | null>(null);

  useEffect(() => {
    if (kpi) addRecent(kpi.id);
  }, [kpi, addRecent]);

  const quality = useMemo(() => (kpi ? qualityScore(kpi) : undefined), [kpi]);
  if (!kpi || !quality) return <EmptyState icon="help-circle-outline" title="KPI not found" />;

  const drivers = kb.graph.drivers(kpi.id);
  const outcomes = kb.graph.outcomes(kpi.id);
  const chain = kb.graph.valueChain(kpi.id);
  const leadingRel = drivers.filter((d) => d.indicator === 'leading');
  const laggingRel = outcomes.filter((d) => d.indicator === 'lagging');
  const otherRel = [...drivers.filter((d) => d.indicator === 'lagging'), ...outcomes.filter((d) => d.indicator === 'leading')];
  const tradeoffKpis = kpi.tradeoffs.filter((t) => t.kpiId).map((t) => kb.get(t.kpiId!)).filter(Boolean) as Kpi[];

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Row gap={0}>
              <IconButton icon={saved ? 'bookmark' : 'bookmark-outline'} color={colors.primary} label={saved ? 'Remove from saved' : 'Save KPI'} onPress={() => toggleSaved(kpi.id)} />
              <IconButton icon="share-outline" color={colors.primary} label="Share KPI" onPress={() => setSheet('share')} />
            </Row>
          ),
        }}
      />
      <Screen
        footer={
          <View style={{ flexDirection: 'row', gap: space.sm, padding: space.md, paddingBottom: space.xl, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
            <Button title="Add to project" icon="add" onPress={() => setSheet('project')} style={{ flex: 1 }} />
            <Button title="Collection" icon="albums-outline" variant="secondary" onPress={() => setSheet('collection')} />
          </View>
        }
      >
        <View style={{ gap: space.sm }}>
          <AppText variant="title" accessibilityRole="header">
            {kpi.name}
          </AppText>
          <KpiBadges kpi={kpi} />
          {kpi.tier === 'library' && (
            <AppText variant="caption" muted>
              Library entry: definition, formula and relationships. Drivers, risks and data requirements are fully documented for the core KPIs.
            </AppText>
          )}
          <AppText style={{ marginTop: space.xs }}>{kpi.shortDefinition}</AppText>
        </View>

        <Card style={{ marginTop: space.lg }}>
          <AppText variant="label" muted>
            FORMULA
          </AppText>
          <AppText variant="mono" style={{ marginTop: 4 }}>
            {kpi.formula}
          </AppText>
          <Row style={{ marginTop: space.md, justifyContent: 'space-between' }}>
            <AppText variant="caption" muted>
              {kpi.direction === 'higher' ? '▲ Higher is better' : kpi.direction === 'lower' ? '▼ Lower is better' : '◆ Keep within target band'} · {kpi.frequency}
            </AppText>
            <QualityPill score={quality.total} />
          </Row>
        </Card>

        <View style={{ marginTop: space.lg }}>
          <Accordion title="Overview" icon="information-circle-outline" initiallyOpen>
            <AppText>{kpi.purpose}</AppText>
            {kpi.aliases?.length ? <Field label="Also called" value={kpi.aliases.join(', ')} /> : null}
            <Field label="Unit" value={kpi.unit} />
            <Field label="Functions" value={kpi.functions.map((f) => FUNCTION_LABEL[f]).join(', ')} />
            <Field label="Industries" value={kpi.industries.map((i) => INDUSTRY_LABEL[i]).join(', ')} />
          </Accordion>

          <Accordion title="Formula & example" icon="calculator-outline">
            <AppText variant="mono">{kpi.formula}</AppText>
            {kpi.formulaExample && (
              <View style={{ padding: space.md, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt }}>
                <AppText variant="label" muted>
                  EXAMPLE
                </AppText>
                <AppText>{kpi.formulaExample}</AppText>
              </View>
            )}
          </Accordion>

          <Accordion title="Strategic role" icon="flag-outline">
            <Field label="Level" value={kpi.levels.map((l) => LEVEL_LABEL[l]).join(', ')} />
            <Field label="BSC" value={PERSPECTIVE_LABEL[kpi.perspective]} />
            <Field label="Indicator" value={kpi.indicator === 'leading' ? 'Leading — moves before outcomes' : 'Lagging — confirms results after the fact'} />
            <Field label="KPI type" value={KPI_TYPE_LABEL[kpi.kpiType]} />
            {chain.length > 2 && (
              <View style={{ marginTop: space.sm, gap: 2 }}>
                <AppText variant="label" muted>
                  HOW IT CREATES VALUE
                </AppText>
                {chain.map((c, i) => (
                  <View key={c.id} style={{ alignItems: 'flex-start' }}>
                    <AppText variant={c.id === kpi.id ? 'bodyStrong' : 'body'} color={c.id === kpi.id ? colors.primary : undefined} onPress={() => c.id !== kpi.id && router.push(`/kpi/${c.id}`)}>
                      {c.name}
                    </AppText>
                    {i < chain.length - 1 && <Icon name="arrow-down" size={14} color={colors.textMuted} />}
                  </View>
                ))}
              </View>
            )}
          </Accordion>

          <Accordion title="Leading indicators" icon="trending-up-outline" badge={String(leadingRel.length)}>
            {leadingRel.length ? leadingRel.map((k) => <KpiRow key={k.id} kpi={k} />) : <AppText muted>No leading drivers modelled yet.</AppText>}
          </Accordion>

          <Accordion title="Lagging indicators" icon="flag-outline" badge={String(laggingRel.length)}>
            {laggingRel.length ? laggingRel.map((k) => <KpiRow key={k.id} kpi={k} />) : <AppText muted>No outcome KPIs modelled yet.</AppText>}
            {otherRel.length > 0 && (
              <>
                <AppText variant="label" muted style={{ marginTop: space.sm }}>
                  OTHER RELATED
                </AppText>
                {otherRel.map((k) => (
                  <KpiRow key={k.id} kpi={k} />
                ))}
              </>
            )}
            <Button small variant="ghost" icon="git-network-outline" title="Open relationship graph" onPress={() => router.push({ pathname: '/kpi/graph', params: { id: kpi.id } })} />
          </Accordion>

          <Accordion title="Drivers" icon="options-outline" badge={String(kpi.drivers.length)}>
            {kpi.drivers.length ? <Bullets items={kpi.drivers} /> : <AppText muted>Not documented for this library entry yet.</AppText>}
          </Accordion>

          <Accordion title="Trade-offs" icon="swap-horizontal-outline" badge={String(kpi.tradeoffs.length)}>
            {kpi.tradeoffs.length ? <Bullets items={kpi.tradeoffs.map((t) => t.text)} /> : <AppText muted>No trade-offs documented.</AppText>}
            {tradeoffKpis.map((k) => (
              <KpiRow key={k.id} kpi={k} />
            ))}
          </Accordion>

          <Accordion title="Gaming risks" icon="warning-outline" badge={String(kpi.gamingRisks.length)}>
            {kpi.gamingRisks.length ? <Bullets items={kpi.gamingRisks} /> : <AppText muted>No gaming risks documented.</AppText>}
          </Accordion>

          <Accordion title="Data requirements" icon="server-outline">
            <AppText variant="label" muted>
              REQUIRED DATA
            </AppText>
            {kpi.dataRequirements.length ? <Bullets items={kpi.dataRequirements} /> : <AppText muted>The inputs named in the formula: {kpi.formula}</AppText>}
            {kpi.dataSources.length > 0 && (
              <>
                <AppText variant="label" muted style={{ marginTop: space.sm }}>
                  TYPICAL SOURCES
                </AppText>
                <Bullets items={kpi.dataSources} />
              </>
            )}
          </Accordion>

          <Accordion title="Benchmarks" icon="bar-chart-outline" badge={String(kpi.benchmarks.length)}>
            {kpi.benchmarks.length === 0 && <AppText muted>No benchmark available yet. Sourced benchmark datasets arrive in Phase 2.</AppText>}
            {kpi.benchmarks.map((b, i) => (
              <View key={i} style={{ padding: space.md, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, gap: 2 }}>
                <AppText variant="bodyStrong">{b.value}</AppText>
                <AppText variant="caption" muted>
                  {b.industry ? INDUSTRY_LABEL[b.industry] : 'Cross-industry'}
                  {b.illustrative ? ' · Indicative orientation — validate before client use' : ''}
                  {b.sourceId ? ` · ${SOURCE_BY_ID[b.sourceId]?.title}` : ''}
                </AppText>
              </View>
            ))}
          </Accordion>

          <Accordion title="Quality score" icon="shield-checkmark-outline" badge={`${quality.total}/100`}>
            {quality.breakdown.map((b) => (
              <View key={b.criterion} style={{ gap: 4 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <AppText variant="bodyStrong">{b.criterion}</AppText>
                  <AppText variant="label" muted>
                    {b.score}/{b.max}
                  </AppText>
                </Row>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt }}>
                  <View style={{ width: `${(b.score / b.max) * 100}%`, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
                </View>
                <AppText variant="caption" muted>
                  {b.note}
                </AppText>
              </View>
            ))}
          </Accordion>

          <Accordion title="Sources" icon="book-outline" badge={String(kpi.sourceIds.length)}>
            {kpi.sourceIds.map((s) => {
              const src = SOURCE_BY_ID[s];
              return src ? (
                <View key={s} style={{ gap: 2 }}>
                  <AppText variant="bodyStrong">{src.title}</AppText>
                  <AppText variant="caption" muted>
                    {[src.authors, src.publisher, src.year].filter(Boolean).join(' · ')}
                  </AppText>
                </View>
              ) : null;
            })}
          </Accordion>
        </View>

        <Row style={{ marginTop: space.lg }} wrap>
          <Button small variant="ghost" icon="git-compare-outline" title="Compare" onPress={() => setSheet('compare')} />
          <Button small variant="ghost" icon="pulse-outline" title="Diagnose" onPress={() => router.push({ pathname: '/diagnostics', params: { kpiId: kpi.id } })} />
          <Button small variant="ghost" icon="sparkles-outline" title="Ask AI" onPress={() => router.push({ pathname: '/assistant', params: { prompt: `Explain ${kpi.name} and its leading indicators` } })} />
        </Row>
      </Screen>

      <AddToProjectSheet kpiIds={[kpi.id]} visible={sheet === 'project'} onClose={() => setSheet(null)} />
      <SaveToCollectionSheet kpiIds={[kpi.id]} visible={sheet === 'collection'} onClose={() => setSheet(null)} />
      <BottomSheet visible={sheet === 'share'} onClose={() => setSheet(null)} title="Share KPI card">
        <ListRow icon="share-social-outline" title="Share…" subtitle="Messages, mail, Teams, WhatsApp…" onPress={() => (setSheet(null), share.text(kpiCardText(kpi), kpi.name))} />
        <ListRow icon="copy-outline" title="Copy summary" onPress={() => (setSheet(null), share.copy(kpiCardText(kpi)))} />
        <ListRow icon="mail-outline" title="Send by email" onPress={() => (setSheet(null), share.email(kpi.name, kpiCardText(kpi)))} />
      </BottomSheet>
      <BottomSheet visible={sheet === 'compare'} onClose={() => setSheet(null)} title={`Compare ${kpi.name} with…`}>
        {[...drivers, ...outcomes, ...kb.kpis.filter((k) => k.perspective === kpi.perspective && k.id !== kpi.id)]
          .filter((k, i, a) => a.findIndex((x) => x.id === k.id) === i)
          .slice(0, 14)
          .map((k) => (
            <KpiRow key={k.id} kpi={k} onPress={() => (setSheet(null), router.push({ pathname: '/compare', params: { ids: `${kpi.id},${k.id}` } }))} />
          ))}
      </BottomSheet>
    </>
  );
}
