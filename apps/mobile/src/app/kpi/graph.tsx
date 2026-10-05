import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import type { IndicatorType } from '@kpi/shared';
import { RelationshipGraph } from '@/components/graph/RelationshipGraph';
import { AppText, Button, Chip, Row } from '@/components/ui/primitives';
import { useKb } from '@/services/knowledgeBase';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

export default function KpiGraphScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const kb = useKb((s) => s.kb);
  const [focus, setFocus] = useState(id);
  const [depth, setDepth] = useState<1 | 2>(1);
  const [filter, setFilter] = useState<IndicatorType | undefined>();
  const kpi = kb.get(focus);
  if (!kpi) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: space.lg, paddingBottom: space.sm, gap: space.sm }}>
        <AppText variant="heading">{kpi.name}</AppText>
        <AppText variant="caption" muted>
          Drivers above, outcomes below. Tap a KPI to refocus · pinch to zoom · drag to pan.
        </AppText>
        <Row wrap>
          <Chip label="All" selected={!filter} onPress={() => setFilter(undefined)} />
          <Chip label="Leading" selected={filter === 'leading'} onPress={() => setFilter('leading')} />
          <Chip label="Lagging" selected={filter === 'lagging'} onPress={() => setFilter('lagging')} />
          <Chip label={depth === 1 ? 'Expand 2 levels' : 'Collapse to 1 level'} icon={depth === 1 ? 'expand-outline' : 'contract-outline'} onPress={() => setDepth(depth === 1 ? 2 : 1)} />
        </Row>
      </View>
      <RelationshipGraph kb={kb} focusId={focus} depth={depth} indicatorFilter={filter} onFocus={setFocus} />
      <View style={{ padding: space.md, paddingBottom: space.xl, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
        <Button title={`Open ${kpi.name}`} icon="open-outline" variant="secondary" onPress={() => router.push(`/kpi/${kpi.id}`)} full />
      </View>
    </View>
  );
}
