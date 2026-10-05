import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { INDUSTRIES, INDUSTRY_LABEL, type IndustryId } from '@kpi/shared';
import { AppText, Card, Chip, Row } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { useKb } from '@/services/knowledgeBase';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

/** Phase 1: orientation ranges from the knowledge base, clearly labelled. Phase 2: sourced benchmark datasets. */
export default function Benchmarks() {
  const { colors } = useTheme();
  const kb = useKb((s) => s.kb);
  const [industry, setIndustry] = useState<IndustryId | undefined>();
  const rows = useMemo(
    () => kb.kpis.flatMap((k) => k.benchmarks.filter((b) => !industry || !b.industry || b.industry === industry).map((b) => ({ k, b }))),
    [kb, industry],
  );
  return (
    <Screen>
      <Card style={{ backgroundColor: colors.warningSoft }}>
        <AppText variant="caption" color={colors.warning}>
          Most values below are indicative orientation ranges for discussion, not citable statistics. Sourced, dated benchmark datasets (with update notifications) are part of Phase 2.
        </AppText>
      </Card>
      <Row wrap style={{ marginVertical: space.md }}>
        <Chip label="All" selected={!industry} onPress={() => setIndustry(undefined)} />
        {INDUSTRIES.filter((i) => i.id !== 'cross').map((i) => (
          <Chip key={i.id} label={i.label} selected={industry === i.id} onPress={() => setIndustry(i.id)} />
        ))}
      </Row>
      <View style={{ gap: space.sm }}>
        {rows.map(({ k, b }, i) => (
          <Card key={`${k.id}-${i}`} onPress={() => router.push(`/kpi/${k.id}`)}>
            <AppText variant="bodyStrong">{k.name}</AppText>
            <AppText>{b.value}</AppText>
            <AppText variant="caption" muted>
              {b.industry ? INDUSTRY_LABEL[b.industry] : 'Cross-industry'} · {b.illustrative ? 'Indicative' : 'Reference'}
            </AppText>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
