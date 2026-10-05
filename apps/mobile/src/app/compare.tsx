import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { INDICATOR_LABEL, LEVEL_LABEL, PERSPECTIVE_LABEL, runAssistant, type Kpi } from '@kpi/shared';
import { QualityPill } from '@/components/kpi/KpiCard';
import { AppText, Button, Card, Row } from '@/components/ui/primitives';
import { useKb } from '@/services/knowledgeBase';
import { share } from '@/services/share';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

const ROWS: { label: string; get: (k: Kpi) => string }[] = [
  { label: 'Definition', get: (k) => k.shortDefinition },
  { label: 'Formula', get: (k) => k.formula },
  { label: 'Type', get: (k) => INDICATOR_LABEL[k.indicator] },
  { label: 'BSC', get: (k) => PERSPECTIVE_LABEL[k.perspective] },
  { label: 'Level', get: (k) => k.levels.map((l) => LEVEL_LABEL[l]).join(', ') },
  { label: 'Better when', get: (k) => (k.direction === 'higher' ? 'Higher' : k.direction === 'lower' ? 'Lower' : 'On target') },
  { label: 'Frequency', get: (k) => k.frequency },
  { label: 'Key gaming risk', get: (k) => k.gamingRisks[0] ?? '—' },
];

export default function Compare() {
  const { ids } = useLocalSearchParams<{ ids: string }>();
  const { colors } = useTheme();
  const kb = useKb((s) => s.kb);
  const kpis = kb.require((ids ?? '').split(',')).slice(0, 2);
  if (kpis.length < 2) return null;
  const [a, b] = kpis;
  const verdict = runAssistant(kb, `difference between ${a.name} and ${b.name}`).summary;
  const text = [`${a.name} vs ${b.name}`, '', ...ROWS.map((r) => `${r.label}: ${r.get(a)} | ${r.get(b)}`), '', verdict].join('\n');

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxxl }} style={{ backgroundColor: colors.bg }}>
      <Row style={{ alignItems: 'stretch' }}>
        {kpis.map((k) => (
          <Card key={k.id} style={{ flex: 1, borderTopWidth: 4, borderTopColor: colors.perspective[k.perspective].fg }} onPress={() => router.push(`/kpi/${k.id}`)}>
            <AppText variant="bodyStrong">{k.name}</AppText>
            <View style={{ marginTop: space.sm }}>
              <QualityPill score={kb.qualityOf(k.id)} />
            </View>
          </Card>
        ))}
      </Row>
      <Card>
        {ROWS.map((r, i) => (
          <View key={r.label} style={{ paddingVertical: space.sm, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
            <AppText variant="label" muted>
              {r.label.toUpperCase()}
            </AppText>
            <Row style={{ alignItems: 'flex-start', marginTop: 4 }} gap={space.md}>
              <AppText variant="caption" style={{ flex: 1 }}>
                {r.get(a)}
              </AppText>
              <AppText variant="caption" style={{ flex: 1 }}>
                {r.get(b)}
              </AppText>
            </Row>
          </View>
        ))}
      </Card>
      <Card style={{ backgroundColor: colors.primarySoft }}>
        <AppText variant="label" color={colors.primary}>
          VERDICT
        </AppText>
        <AppText color={colors.primary}>{verdict}</AppText>
      </Card>
      <Row>
        <Button title="Share" icon="share-outline" variant="secondary" onPress={() => share.text(text, `${a.name} vs ${b.name}`)} style={{ flex: 1 }} />
        <Button title="Copy" icon="copy-outline" variant="ghost" onPress={() => share.copy(text)} style={{ flex: 1 }} />
      </Row>
    </ScrollView>
  );
}
