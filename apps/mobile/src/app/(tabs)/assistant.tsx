import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StrategyMap } from '@kpi/shared';
import { AiCardView, type AiCardActions } from '@/components/ai/AiCards';
import { AddToProjectSheet } from '@/components/kpi/sheets';
import { BottomSheet, EmptyState, OfflineBanner } from '@/components/ui/feedback';
import { AppText, Chip, Icon, IconButton, ListRow, Row } from '@/components/ui/primitives';
import { voiceInput } from '@/services/voice';
import { useAuth } from '@/state/auth';
import { useChat } from '@/state/chat';
import { useProjects } from '@/state/projects';
import { useSettings } from '@/state/settings';
import { radius, space, type as typo } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

const STARTERS = [
  'I need KPIs for a telecom company’s customer strategy.',
  'Give me leading KPIs for profitability.',
  'What’s the difference between customer retention and churn?',
  'Our customer churn increased from 4% to 7%. What should I investigate?',
  'Are my KPIs balanced?',
];

export default function Assistant() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ prompt?: string }>();
  const { messages, pending, send, projectId, setProject, clear } = useChat();
  const projects = useProjects((s) => s.projects);
  const setMap = useProjects((s) => s.setMap);
  const defaultIndustry = useSettings((s) => s.defaultIndustry);
  const status = useAuth((s) => s.status);
  const [text, setText] = useState('');
  const [scopeOpen, setScopeOpen] = useState(false);
  const [addIds, setAddIds] = useState<string[] | null>(null);
  const [mapToApply, setMapToApply] = useState<StrategyMap | null>(null);
  const listRef = useRef<FlatList<(typeof messages)[number]>>(null);
  const project = projects.find((p) => p.id === projectId);

  useEffect(() => {
    if (params.prompt) setText(params.prompt);
  }, [params.prompt]);

  const context = useMemo(
    () => ({ industry: project?.industry ?? defaultIndustry, projectId: project?.id, projectName: project?.name, kpiIds: project?.kpis.map((k) => k.kpiId) }),
    [project, defaultIndustry],
  );

  const submit = (t = text) => {
    if (!t.trim()) return;
    setText('');
    send(t, context);
  };

  const actions: AiCardActions = {
    onAddToProject: (ids) => setAddIds(ids),
    onApplyMap: (map) => setMapToApply(map),
  };

  const startVoice = async () => {
    try {
      const transcript = await voiceInput.listen({ onPartial: setText });
      submit(transcript);
    } catch (e) {
      Alert.alert('Voice input', e instanceof Error ? e.message : 'Voice input is not available.');
    }
  };

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <OfflineBanner />
      <Row style={{ paddingHorizontal: space.lg, paddingVertical: space.sm, justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <AppText variant="title" accessibilityRole="header">
            AI Assistant
          </AppText>
          <Pressable onPress={() => setScopeOpen(true)} accessibilityRole="button" accessibilityLabel="Choose project context">
            <Row gap={4}>
              <Icon name="briefcase-outline" size={14} color={colors.primary} />
              <AppText variant="caption" color={colors.primary} numberOfLines={1}>
                {project ? project.name : 'No project context'}
              </AppText>
              <Icon name="chevron-down" size={12} color={colors.primary} />
            </Row>
          </Pressable>
        </View>
        {messages.length > 0 && <IconButton icon="trash-outline" label="Clear conversation" onPress={() => Alert.alert('Clear conversation?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: clear }])} />}
      </Row>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top + 49}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          contentContainerStyle={{ padding: space.lg, gap: space.md, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={{ gap: space.sm }}>
              <EmptyState icon="sparkles-outline" title="Your strategy copilot" body="Ask for KPI recommendations, explanations, comparisons, diagnostics or a balance check of your project." />
              {STARTERS.map((s) => (
                <Pressable key={s} onPress={() => submit(s)} style={{ padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                  <AppText variant="caption">{s}</AppText>
                </Pressable>
              ))}
            </View>
          }
          renderItem={({ item }) =>
            item.role === 'user' ? (
              <View style={{ alignSelf: 'flex-end', maxWidth: '85%', padding: space.md, borderRadius: radius.lg, borderBottomRightRadius: 4, backgroundColor: colors.primary }}>
                <AppText color={colors.onPrimary}>{item.text}</AppText>
              </View>
            ) : (
              <View style={{ gap: space.sm }}>
                {item.source !== 'ai' && (
                  <Row gap={6}>
                    <Icon name={item.source === 'guest' ? 'person-circle-outline' : 'cloud-offline-outline'} size={14} color={colors.textMuted} />
                    <AppText variant="caption" muted style={{ flex: 1 }}>
                      {item.error ?? (item.source === 'guest' ? 'Offline engine — sign in for AI consultant answers.' : 'You’re offline — AI answers need an internet connection. This answer comes from the on-device engine.')}
                    </AppText>
                  </Row>
                )}
                <AppText variant="body">{item.text}</AppText>
                {item.response?.cards.map((c, i) => <AiCardView key={i} card={c} actions={actions} />)}
                {item.id === lastAssistant?.id && item.response?.followUps.length ? (
                  <Row wrap gap={space.sm}>
                    {item.response.followUps.map((f) => (
                      <Chip key={f} label={f} icon="return-down-forward" onPress={() => submit(f)} />
                    ))}
                  </Row>
                ) : null}
              </View>
            )
          }
          ListFooterComponent={
            pending ? (
              <Row style={{ marginTop: space.md }}>
                <Icon name="sparkles" size={16} color={colors.primary} />
                <AppText muted>Thinking…</AppText>
              </Row>
            ) : null
          }
        />

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.xs, padding: space.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
          <IconButton icon="camera-outline" label="Analyze a photo or document" onPress={() => router.push('/scan')} />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={status === 'signedIn' ? 'What would you like to analyze?' : 'Ask the offline engine…'}
            placeholderTextColor={colors.textMuted}
            multiline
            accessibilityLabel="Message"
            style={[typo.body, { flex: 1, maxHeight: 120, minHeight: 44, paddingHorizontal: space.md, paddingTop: 11, paddingBottom: 11, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt, color: colors.text }]}
          />
          {text.trim() ? (
            <IconButton icon="arrow-up-circle" size={32} label="Send" color={colors.primary} onPress={() => submit()} />
          ) : (
            <IconButton icon="mic-outline" label="Voice input" onPress={startVoice} />
          )}
        </View>
      </KeyboardAvoidingView>

      <BottomSheet visible={scopeOpen} onClose={() => setScopeOpen(false)} title="Project context">
        <AppText variant="caption" muted>
          The assistant uses the project’s industry and KPI set, e.g. for “Are my KPIs balanced?”.
        </AppText>
        <ListRow icon="remove-circle-outline" title="No project" onPress={() => (setProject(undefined), setScopeOpen(false))} right={!project ? <Icon name="checkmark" color={colors.primary} /> : undefined} />
        {projects.map((p) => (
          <ListRow key={p.id} icon="briefcase-outline" title={p.name} subtitle={`${p.kpis.length} KPIs`} onPress={() => (setProject(p.id), setScopeOpen(false))} right={p.id === projectId ? <Icon name="checkmark" color={colors.primary} /> : undefined} />
        ))}
      </BottomSheet>

      <AddToProjectSheet kpiIds={addIds ?? []} visible={Boolean(addIds)} onClose={() => setAddIds(null)} />

      <BottomSheet visible={Boolean(mapToApply)} onClose={() => setMapToApply(null)} title="Apply strategy map to…">
        {projects.length === 0 && <AppText muted>Create a project first.</AppText>}
        {projects.map((p) => (
          <ListRow
            key={p.id}
            icon="git-network-outline"
            title={p.name}
            subtitle={p.map.objectives.length ? `Replaces ${p.map.objectives.length} existing objectives` : 'Empty map'}
            onPress={() => {
              if (mapToApply) setMap(p.id, mapToApply);
              setMapToApply(null);
              router.push(`/project/${p.id}/map`);
            }}
          />
        ))}
        <ListRow icon="add" title="New project" onPress={() => (setMapToApply(null), router.push('/project/new'))} />
      </BottomSheet>
    </View>
  );
}
