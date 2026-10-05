import { useLocalSearchParams } from 'expo-router';
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FUNCTION_LABEL,
  FUNCTIONS,
  INDICATOR_LABEL,
  INDICATORS,
  INDUSTRIES,
  INDUSTRY_LABEL,
  KPI_TYPES,
  LEVELS,
  PERSPECTIVE_LABEL,
  PERSPECTIVES,
  THEMES,
  type Kpi,
  type KpiFilters,
} from '@kpi/shared';
import { KpiCard } from '@/components/kpi/KpiCard';
import { AddToProjectSheet } from '@/components/kpi/sheets';
import { BottomSheet, EmptyState } from '@/components/ui/feedback';
import { AppText, Button, Chip, Icon, Row, SearchBar } from '@/components/ui/primitives';
import { useKb } from '@/services/knowledgeBase';
import { useLibrary } from '@/state/library';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

type FilterKey = keyof KpiFilters;
const FILTERS: { key: FilterKey; label: string; options: { id: string; label: string }[] }[] = [
  { key: 'industries', label: 'Industry', options: INDUSTRIES.filter((i) => i.id !== 'cross') },
  { key: 'functions', label: 'Function', options: FUNCTIONS },
  { key: 'levels', label: 'Level', options: LEVELS },
  { key: 'perspectives', label: 'BSC', options: PERSPECTIVES },
  { key: 'indicators', label: 'Leading/Lagging', options: INDICATORS },
  { key: 'kpiTypes', label: 'KPI Type', options: KPI_TYPES },
];

const PAGE = 25;
const SUGGESTIONS = ['Customer loyalty KPIs in banking', 'Operational KPIs for manufacturing', 'Leading indicators of profitability', 'HR KPIs for employee productivity'];

export default function Library() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ q?: string }>();
  const kb = useKb((s) => s.kb);
  const { recentSearches, addRecentSearch } = useLibrary();
  const [query, setQuery] = useState(params.q ?? '');
  const deferred = useDeferredValue(query);
  const [filters, setFilters] = useState<KpiFilters>({});
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [addKpi, setAddKpi] = useState<Kpi | null>(null);

  useEffect(() => {
    if (params.q) setQuery(params.q);
  }, [params.q]);
  useEffect(() => setLimit(PAGE), [deferred, filters]);

  // Search runs over the knowledge base bundled in the app.
  const result = useMemo(() => kb.index.search(deferred, { filters, limit }), [kb, deferred, filters, limit]);
  const activeCount = Object.values(filters).reduce((n, v) => n + (v?.length ?? 0), 0);
  const interp = result.interpretation;
  const interpreted = [
    ...interp.industries.map((i) => INDUSTRY_LABEL[i]),
    ...interp.functions.map((f) => FUNCTION_LABEL[f]),
    ...interp.perspectives.map((p) => PERSPECTIVE_LABEL[p]),
    ...interp.indicators.map((i) => INDICATOR_LABEL[i]),
    ...interp.levels.map((l) => l[0].toUpperCase() + l.slice(1)),
    ...interp.themes.filter((t) => t in THEMES).map((t) => t.replace('-', ' ')),
  ];

  const toggle = (key: FilterKey, id: string) =>
    setFilters((f) => {
      const cur = (f[key] as string[] | undefined) ?? [];
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      return { ...f, [key]: next.length ? next : undefined };
    });

  const renderItem = useCallback(({ item }: { item: { kpi: Kpi } }) => <KpiCard kpi={item.kpi} onAdd={setAddKpi} />, []);
  const sheet = FILTERS.find((f) => f.key === openFilter);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm }}>
        <AppText variant="title" accessibilityRole="header">
          KPI Library
        </AppText>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search by KPI, objective, industry or function…" onSubmit={() => addRecentSearch(query)} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingVertical: space.xs }}>
          {FILTERS.map((f) => (
            <Chip key={f.key} dropdown label={f.label} count={(filters[f.key] as string[] | undefined)?.length} selected={Boolean((filters[f.key] as string[] | undefined)?.length)} onPress={() => setOpenFilter(f.key)} />
          ))}
          {activeCount > 0 && <Chip label="Clear" icon="close" onPress={() => setFilters({})} />}
        </ScrollView>
        {deferred.trim() !== '' && (
          <Row style={{ justifyContent: 'space-between' }}>
            <AppText variant="caption" muted style={{ flex: 1 }} numberOfLines={1}>
              {result.total} KPI{result.total === 1 ? '' : 's'}
              {interpreted.length ? ` · understood: ${interpreted.join(', ')}` : ''}
            </AppText>
          </Row>
        )}
      </View>

      <FlatList
        data={result.hits}
        keyExtractor={(h) => h.kpi.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxxl * 2 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onEndReachedThreshold={0.6}
        onEndReached={() => result.total > limit && setLimit((l) => l + PAGE)}
        initialNumToRender={6}
        windowSize={7}
        removeClippedSubviews
        ListHeaderComponent={
          deferred.trim() === '' && activeCount === 0 ? (
            <View style={{ gap: space.sm, marginBottom: space.sm }}>
              <AppText variant="label" muted>
                {recentSearches.length ? 'RECENT SEARCHES' : 'TRY'}
              </AppText>
              <Row wrap gap={space.sm}>
                {(recentSearches.length ? recentSearches : SUGGESTIONS).map((s) => (
                  <Pressable key={s} onPress={() => setQuery(s)} style={{ paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                    <Row gap={6}>
                      <Icon name={recentSearches.length ? 'time-outline' : 'sparkles-outline'} size={14} color={colors.textMuted} />
                      <AppText variant="caption">{s}</AppText>
                    </Row>
                  </Pressable>
                ))}
              </Row>
              <AppText variant="label" muted style={{ marginTop: space.md }}>
                ALL KPIS · {result.total}
              </AppText>
            </View>
          ) : null
        }
        ListEmptyComponent={<EmptyState icon="search-outline" title="No KPIs found" body="Try different words, or remove some filters." action={activeCount ? 'Clear filters' : undefined} onAction={() => setFilters({})} />}
      />

      <BottomSheet
        visible={Boolean(sheet)}
        onClose={() => setOpenFilter(null)}
        title={sheet?.label}
        footer={<Button title={`Show ${result.total} KPIs`} onPress={() => setOpenFilter(null)} full />}
      >
        <Row wrap gap={space.sm}>
          {sheet?.options.map((o) => (
            <Chip key={o.id} label={o.label} selected={((filters[sheet.key] as string[] | undefined) ?? []).includes(o.id)} onPress={() => toggle(sheet.key, o.id)} icon={((filters[sheet.key] as string[] | undefined) ?? []).includes(o.id) ? 'checkmark' : undefined} />
          ))}
        </Row>
      </BottomSheet>

      <AddToProjectSheet kpiIds={addKpi ? [addKpi.id] : []} visible={Boolean(addKpi)} onClose={() => setAddKpi(null)} />
    </View>
  );
}
