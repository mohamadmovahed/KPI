import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { buildExecutiveSummary } from '@kpi/shared';
import { Card, AppText, Button, Row } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/feedback';
import { Screen } from '@/components/ui/Screen';
import { useKb } from '@/services/knowledgeBase';
import { shareSummary } from '@/services/share';
import { useProject } from '@/state/projects';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Concise executive summary, generated on device (works offline) and shareable as PDF, text,
 * clipboard or email — the "brief the CEO from the taxi" use case.
 */
export default function ExecutiveSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const kb = useKb((s) => s.kb);
  const project = useProject(id);
  const summary = useMemo(() => (project ? buildExecutiveSummary(project, kb) : undefined), [project, kb]);
  const [busy, setBusy] = useState(false);
  if (!project || !summary) return <EmptyState icon="document-text-outline" title="Project not found" />;

  const run = async (fn: () => Promise<void>, done?: string) => {
    try {
      setBusy(true);
      await fn();
      if (done) Alert.alert(done);
    } catch (e) {
      Alert.alert('Could not share', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        <View style={{ padding: space.md, paddingBottom: space.xl, gap: space.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
          <Row>
            <Button title="Share" icon="share-outline" onPress={() => run(() => shareSummary.text(summary))} style={{ flex: 1 }} loading={busy} />
            <Button title="PDF" icon="document-outline" variant="secondary" onPress={() => run(() => shareSummary.pdf(summary))} style={{ flex: 1 }} />
          </Row>
          <Row>
            <Button small title="Copy summary" icon="copy-outline" variant="ghost" onPress={() => run(() => shareSummary.copy(summary), 'Copied to clipboard')} style={{ flex: 1 }} />
            <Button small title="Email" icon="mail-outline" variant="ghost" onPress={() => run(() => shareSummary.email(summary))} style={{ flex: 1 }} />
          </Row>
        </View>
      }
    >
      <AppText variant="title">{summary.title}</AppText>
      <AppText variant="caption" muted>
        Generated {new Date(summary.generatedAt).toLocaleString()}
      </AppText>
      <View style={{ gap: space.md, marginTop: space.lg }}>
        {summary.sections.map((s) => (
          <Card key={s.heading}>
            <AppText variant="label" color={colors.primary}>
              {s.heading.toUpperCase()}
            </AppText>
            {s.bullets.map((b, i) => (
              <Row key={i} style={{ alignItems: 'flex-start', marginTop: 6 }}>
                <AppText muted>•</AppText>
                <AppText style={{ flex: 1 }}>{b}</AppText>
              </Row>
            ))}
          </Card>
        ))}
      </View>
    </Screen>
  );
}
