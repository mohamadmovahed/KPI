import { router } from 'expo-router';
import { useState } from 'react';
import { Image, View } from 'react-native';
import { KpiRow } from '@/components/kpi/KpiCard';
import { AddToProjectSheet } from '@/components/kpi/sheets';
import { ErrorState } from '@/components/ui/feedback';
import { AppText, Button, Card, ListRow, Row, Divider } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { api } from '@/services/api';
import { documents, type PickedFile } from '@/services/documents';
import { useKb } from '@/services/knowledgeBase';
import { useAuth } from '@/state/auth';
import { useNetwork } from '@/state/network';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

type Result = Awaited<ReturnType<typeof api.analyzeDocument>>;

/**
 * Camera / document input: photograph a strategy map, KPI table, dashboard or slide, or pick a
 * PDF. The server's vision model extracts the KPIs; the knowledge base classifies them.
 */
export default function Scan() {
  const { colors } = useTheme();
  const kb = useKb((s) => s.kb);
  const signedIn = useAuth((s) => s.status === 'signedIn');
  const online = useNetwork((s) => s.online);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<Result>();
  const [addIds, setAddIds] = useState<string[] | null>(null);

  const pick = async (fn: () => Promise<PickedFile | null>) => {
    setError(undefined);
    try {
      const f = await fn();
      if (!f) return;
      setFile(f);
      setResult(undefined);
      setBusy(true);
      setResult(await api.analyzeDocument(f));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setBusy(false);
    }
  };

  const blocked = !signedIn ? 'Sign in to analyze documents — the image is processed by the AI service.' : !online ? 'Document analysis needs an internet connection.' : undefined;
  const matched = result?.items.flatMap((i) => (i.kpiId ? [i.kpiId] : [])) ?? [];

  return (
    <Screen>
      <AppText muted>Take a photo of an existing strategy map, KPI table, management dashboard, Excel sheet or slide, and get an instant read on its KPIs.</AppText>
      {blocked ? (
        <View style={{ marginTop: space.lg }}>
          <ErrorState message={blocked} />
          {!signedIn && <Button title="Sign in" style={{ marginTop: space.md }} onPress={() => useAuth.getState().signOut()} />}
        </View>
      ) : (
        <Card style={{ marginTop: space.lg }}>
          <ListRow icon="camera-outline" title="Take a photo" onPress={() => pick(documents.fromCamera)} />
          <Divider />
          <ListRow icon="images-outline" title="Choose from photos" onPress={() => pick(documents.fromLibrary)} />
          <Divider />
          <ListRow icon="document-outline" title="Pick a PDF or image file" onPress={() => pick(documents.fromFiles)} />
        </Card>
      )}

      {file && file.mimeType.startsWith('image/') && <Image source={{ uri: file.uri }} style={{ marginTop: space.lg, height: 180, borderRadius: radius.md }} resizeMode="cover" accessibilityLabel="Selected image" />}
      {busy && (
        <AppText muted style={{ marginTop: space.md }}>
          Analyzing…
        </AppText>
      )}
      {error && (
        <View style={{ marginTop: space.md }}>
          <ErrorState message={error} />
        </View>
      )}

      {result && (
        <View style={{ marginTop: space.lg, gap: space.md }}>
          <Card style={{ borderLeftWidth: 4, borderLeftColor: colors.primary }}>
            <AppText variant="heading">{result.summary}</AppText>
          </Card>
          <Card>
            {result.items.map((i, idx) => {
              const k = i.kpiId ? kb.get(i.kpiId) : undefined;
              return k ? (
                <KpiRow key={idx} kpi={k} />
              ) : (
                <Row key={idx} style={{ minHeight: 44 }}>
                  <AppText style={{ flex: 1 }}>{i.name}</AppText>
                  <AppText variant="caption" muted>
                    not in library
                  </AppText>
                </Row>
              );
            })}
          </Card>
          <Row>
            <Button title="Add matched to project" icon="add" disabled={!matched.length} onPress={() => setAddIds(matched)} style={{ flex: 1 }} />
            <Button title="Check balance" variant="secondary" disabled={!matched.length} onPress={() => router.push({ pathname: '/assistant', params: { prompt: `Are these KPIs balanced: ${kb.require(matched).map((k) => k.name).join(', ')}?` } })} style={{ flex: 1 }} />
          </Row>
        </View>
      )}
      <AddToProjectSheet kpiIds={addIds ?? []} visible={Boolean(addIds)} onClose={() => setAddIds(null)} />
    </Screen>
  );
}
