import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { INDUSTRY_LABEL } from '@kpi/shared';
import { EmptyState, Fab } from '@/components/ui/feedback';
import { AppText, Badge, Card, Icon, Row } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/state/auth';
import { useProjects } from '@/state/projects';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

export default function Projects() {
  const { colors } = useTheme();
  const all = useProjects((s) => s.projects);
  const projects = useMemo(() => [...all].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [all]);
  const dirty = useProjects((s) => s.dirty);
  const signedIn = useAuth((s) => s.status === 'signedIn');

  return (
    <View style={{ flex: 1 }}>
      <Screen title="Projects" subtitle="Consulting projects and strategy workspaces" safeTop>
        {projects.length === 0 ? (
          <EmptyState icon="briefcase-outline" title="No projects yet" body="Create a project such as “Telecom Strategy 2027–2030”, add KPIs, and build its strategy map." action="Create project" onAction={() => router.push('/project/new')} />
        ) : (
          <View style={{ gap: space.md }}>
            {projects.map((p) => {
              const targets = p.kpis.filter((k) => k.target).length;
              return (
                <Card key={p.id} onPress={() => router.push(`/project/${p.id}`)}>
                  <Row style={{ alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <AppText variant="heading">{p.name}</AppText>
                      <AppText variant="caption" muted>
                        {[p.client, p.industry && INDUSTRY_LABEL[p.industry], p.horizon].filter(Boolean).join(' · ') || 'No details yet'}
                      </AppText>
                    </View>
                    {signedIn && dirty.includes(p.id) && <Icon name="cloud-upload-outline" size={18} color={colors.textMuted} />}
                  </Row>
                  <Row style={{ marginTop: space.md }} wrap>
                    <Badge label={`${p.kpis.length} KPIs`} fg={colors.primary} bg={colors.primarySoft} />
                    <Badge label={`${p.map.objectives.length} objectives`} fg={colors.perspective.customer.fg} bg={colors.perspective.customer.bg} />
                    {p.kpis.length > 0 && <Badge label={`${targets}/${p.kpis.length} targets`} fg={targets === p.kpis.length ? colors.success : colors.warning} bg={targets === p.kpis.length ? colors.successSoft : colors.warningSoft} />}
                  </Row>
                </Card>
              );
            })}
          </View>
        )}
      </Screen>
      {projects.length > 0 && <Fab icon="add" label="New project" onPress={() => router.push('/project/new')} />}
    </View>
  );
}
