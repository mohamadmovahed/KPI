import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { INDICATOR_LABEL, INDUSTRY_LABEL, LEVEL_LABEL, PERSPECTIVE_LABEL, type Kpi } from '@kpi/shared';
import { AppText, Badge, Card, containerRole, Row } from '@/components/ui/primitives';
import { useKb } from '@/services/knowledgeBase';
import { useLibrary } from '@/state/library';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

export function KpiBadges({ kpi, compact }: { kpi: Kpi; compact?: boolean }) {
  const { colors } = useTheme();
  const p = colors.perspective[kpi.perspective];
  const i = colors.indicator[kpi.indicator];
  return (
    <Row wrap gap={6}>
      <Badge label={PERSPECTIVE_LABEL[kpi.perspective]} fg={p.fg} bg={p.bg} />
      <Badge label={INDICATOR_LABEL[kpi.indicator]} fg={i.fg} bg={i.bg} icon={kpi.indicator === 'leading' ? 'trending-up' : 'flag-outline'} />
      {!compact && <Badge label={kpi.levels.map((l) => LEVEL_LABEL[l]).join(' · ')} fg={colors.textMuted} bg={colors.surfaceAlt} />}
    </Row>
  );
}

export function QualityPill({ score }: { score: number }) {
  const { colors } = useTheme();
  const c = score >= 80 ? colors.success : score >= 65 ? colors.warning : colors.danger;
  return (
    <View accessibilityLabel={`Quality score ${score} of 100`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name="shield-checkmark" size={13} color={c} />
      <AppText variant="label" color={c}>
        {score}/100
      </AppText>
    </View>
  );
}

/** Compact search-result card: essentials only (progressive disclosure). */
export const KpiCard = memo(function KpiCard({ kpi, onAdd }: { kpi: Kpi; onAdd?: (kpi: Kpi) => void }) {
  const { colors } = useTheme();
  const saved = useLibrary((s) => s.savedIds.includes(kpi.id));
  const toggleSaved = useLibrary((s) => s.toggleSaved);
  const quality = useKb((s) => s.kb.qualityOf(kpi.id));
  const industries = kpi.industries.filter((i) => i !== 'cross').slice(0, 3).map((i) => INDUSTRY_LABEL[i]);

  return (
    <Card onPress={() => router.push(`/kpi/${kpi.id}`)} accessibilityLabel={`${kpi.name}, open details`}>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 6 }}>
          <AppText variant="heading">{kpi.name}</AppText>
          <KpiBadges kpi={kpi} compact />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Remove from saved' : 'Save KPI'}
          hitSlop={12}
          onPress={() => toggleSaved(kpi.id)}
          style={{ padding: 4 }}
        >
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={22} color={saved ? colors.primary : colors.textMuted} />
        </Pressable>
      </Row>
      <View style={{ marginTop: space.md, padding: space.md, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt }}>
        <AppText variant="label" muted>
          FORMULA
        </AppText>
        <AppText variant="mono" numberOfLines={2}>
          {kpi.formula}
        </AppText>
      </View>
      <Row style={{ justifyContent: 'space-between', marginTop: space.md }}>
        <AppText variant="caption" muted numberOfLines={1} style={{ flex: 1 }}>
          {industries.length ? industries.join(', ') : 'Cross-industry'}
        </AppText>
        <QualityPill score={quality} />
        {onAdd && (
          <Pressable accessibilityRole="button" accessibilityLabel="Add to project" hitSlop={10} onPress={() => onAdd(kpi)} style={{ marginLeft: space.md }}>
            <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
          </Pressable>
        )}
      </Row>
    </Card>
  );
});

/** Single-line KPI row for lists inside cards and sheets. */
export function KpiRow({ kpi, right, onPress }: { kpi: Kpi; right?: React.ReactNode; onPress?: () => void }) {
  const { colors } = useTheme();
  const i = colors.indicator[kpi.indicator];
  return (
    <Pressable
      accessibilityRole={containerRole}
      onPress={onPress ?? (() => router.push(`/kpi/${kpi.id}`))}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.perspective[kpi.perspective].fg }} />
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {kpi.name}
        </AppText>
        <AppText variant="caption" color={i.fg}>
          {INDICATOR_LABEL[kpi.indicator]} · {PERSPECTIVE_LABEL[kpi.perspective]}
        </AppText>
      </View>
      {right ?? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
    </Pressable>
  );
}
