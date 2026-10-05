import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { INDUSTRY_LABEL } from '@kpi/shared';
import { OfflineBanner } from '@/components/ui/feedback';
import { AppText, Card, Icon, Row, SectionHeader, type IconName } from '@/components/ui/primitives';
import { useKb } from '@/services/knowledgeBase';
import { projectInsights } from '@/services/insights';
import { useAuth } from '@/state/auth';
import { useChat } from '@/state/chat';
import { useLibrary } from '@/state/library';
import { useProjects } from '@/state/projects';
import { radius, space, touch, type as typo } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

const QUICK_ACTIONS: { icon: IconName; label: string; go: () => void }[] = [
  { icon: 'search', label: 'Find a KPI', go: () => router.push('/library') },
  { icon: 'bulb-outline', label: 'Recommend KPIs', go: () => router.push({ pathname: '/assistant', params: { prompt: 'Recommend KPIs for ' } }) },
  { icon: 'pulse-outline', label: 'Analyze a KPI', go: () => router.push('/diagnostics') },
  { icon: 'git-network-outline', label: 'Build a Strategy Map', go: () => router.push('/projects') },
  { icon: 'medkit-outline', label: 'Diagnose a Problem', go: () => router.push({ pathname: '/assistant', params: { prompt: 'Our ' } }) },
  { icon: 'scan-outline', label: 'Scan a Document', go: () => router.push('/scan') },
];

const EXAMPLES = ['KPIs for improving customer retention', 'Why could EBITDA margin decline?', 'Build a KPI set for procurement'];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Home() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuth((s) => s.user);
  const kb = useKb((s) => s.kb);
  const projects = useProjects((s) => s.projects);
  const recentIds = useLibrary((s) => s.recentIds);
  const send = useChat((s) => s.send);
  const [ask, setAsk] = useState('');
  const insights = useMemo(() => projectInsights(projects), [projects]);
  const recent = kb.require(recentIds.slice(0, 6));

  const submit = (text: string) => {
    if (!text.trim()) return;
    setAsk('');
    router.push('/assistant');
    send(text, {});
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ height: insets.top, backgroundColor: colors.bg }} />
      <OfflineBanner />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxxl * 2 }} keyboardShouldPersistTaps="handled">
        <AppText variant="display" accessibilityRole="header">
          {greeting()}
          {user ? `, ${user.name.split(' ')[0]}` : ''}
        </AppText>

        {/* AI entry point */}
        <Card style={{ marginTop: space.lg, backgroundColor: colors.primary }}>
          <AppText variant="heading" color={colors.onPrimary}>
            What would you like to analyze?
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.md, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: space.md, minHeight: touch.min + 4 }}>
            <Icon name="sparkles" size={18} color={colors.primary} />
            <TextInput
              value={ask}
              onChangeText={setAsk}
              placeholder="Ask about KPIs or strategy…"
              placeholderTextColor={colors.textMuted}
              onSubmitEditing={() => submit(ask)}
              returnKeyType="send"
              accessibilityLabel="Ask the AI assistant"
              style={[typo.body, { flex: 1, color: colors.text, marginLeft: space.sm }]}
            />
            {ask ? (
              <Pressable accessibilityLabel="Send" onPress={() => submit(ask)} hitSlop={10}>
                <Icon name="arrow-up-circle" size={28} color={colors.primary} />
              </Pressable>
            ) : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, marginTop: space.md }}>
            {EXAMPLES.map((e) => (
              <Pressable key={e} onPress={() => submit(e)} style={{ paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.16)' }}>
                <AppText variant="caption" color={colors.onPrimary}>
                  “{e}”
                </AppText>
              </Pressable>
            ))}
          </ScrollView>
        </Card>

        <SectionHeader title="Quick actions" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {QUICK_ACTIONS.map((a) => (
            <Pressable
              key={a.label}
              accessibilityRole="button"
              onPress={a.go}
              style={({ pressed }) => ({ width: '31.8%', minHeight: 92, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, justifyContent: 'space-between', opacity: pressed ? 0.8 : 1 })}
            >
              <Icon name={a.icon} size={22} color={colors.primary} />
              <AppText variant="label" numberOfLines={2}>
                {a.label}
              </AppText>
            </Pressable>
          ))}
        </View>

        {insights.length > 0 && (
          <>
            <SectionHeader title="Needs attention" />
            <Card padded={false}>
              {insights.map((n, i) => (
                <Pressable key={n.id} onPress={() => n.projectId && router.push(`/project/${n.projectId}`)} style={{ flexDirection: 'row', gap: space.md, padding: space.lg, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                  <Icon name="alert-circle-outline" size={20} color={colors.warning} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyStrong">{n.title}</AppText>
                    <AppText variant="caption" muted>
                      {n.body}
                    </AppText>
                  </View>
                </Pressable>
              ))}
            </Card>
          </>
        )}

        <SectionHeader title="Recent projects" action={projects.length ? 'All' : 'New'} onAction={() => router.push(projects.length ? '/projects' : '/project/new')} />
        {projects.length === 0 ? (
          <Card onPress={() => router.push('/project/new')}>
            <Row>
              <Icon name="add-circle-outline" color={colors.primary} />
              <AppText style={{ flex: 1 }}>Create your first strategy project</AppText>
            </Row>
          </Card>
        ) : (
          <View style={{ gap: space.sm }}>
            {[...projects]
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .slice(0, 3)
              .map((p) => (
                <Card key={p.id} onPress={() => router.push(`/project/${p.id}`)}>
                  <Row>
                    <Icon name="briefcase-outline" color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <AppText variant="bodyStrong">{p.name}</AppText>
                      <AppText variant="caption" muted>
                        {p.kpis.length} KPIs · {p.map.objectives.length} objectives{p.industry ? ` · ${INDUSTRY_LABEL[p.industry]}` : ''}
                      </AppText>
                    </View>
                    <Icon name="chevron-forward" size={16} color={colors.textMuted} />
                  </Row>
                </Card>
              ))}
          </View>
        )}

        {recent.length > 0 && (
          <>
            <SectionHeader title="Recently viewed" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
              {recent.map((k) => (
                <Pressable
                  key={k.id}
                  onPress={() => router.push(`/kpi/${k.id}`)}
                  style={{ width: 150, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderTopWidth: 4, borderTopColor: colors.perspective[k.perspective].fg }}
                >
                  <AppText variant="bodyStrong" numberOfLines={2}>
                    {k.name.replace(/\s*\(.*\)/, '')}
                  </AppText>
                  <AppText variant="caption" muted>
                    {k.indicator === 'leading' ? 'Leading' : 'Lagging'}
                  </AppText>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}
      </ScrollView>
    </View>
  );
}
