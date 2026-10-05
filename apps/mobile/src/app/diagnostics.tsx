import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { diagnose, type Diagnosis } from '@kpi/shared';
import { AiCardView, InsightCard } from '@/components/ai/AiCards';
import { KpiRow } from '@/components/kpi/KpiCard';
import { AddToProjectSheet } from '@/components/kpi/sheets';
import { AppText, Button, Card, Row, TextField } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { useKb } from '@/services/knowledgeBase';
import { share } from '@/services/share';
import { space } from '@/theme/tokens';

const num = (s: string) => {
  const n = Number(s.replace(',', '.').replace('%', '').trim());
  return s.trim() && Number.isFinite(n) ? n : undefined;
};

/** KPI diagnostics: pick a KPI, enter before/after values, get a driver tree and investigation plan (runs on device). */
export default function Diagnostics() {
  const params = useLocalSearchParams<{ kpiId?: string }>();
  const kb = useKb((s) => s.kb);
  const [kpiId, setKpiId] = useState(params.kpiId ?? '');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [result, setResult] = useState<Diagnosis>();
  const [addIds, setAddIds] = useState<string[] | null>(null);
  const kpi = kb.get(kpiId);
  const hits = useMemo(() => kb.index.search(q, { limit: 8 }).hits.map((h) => h.kpi), [kb, q]);

  const text = result
    ? [result.headline, '', 'Rule out first:', ...result.questions.map((x) => `• ${x}`), '', 'Hypotheses:', ...result.hypotheses.map((h) => `• ${h.driver}: ${h.checks[0]}`), '', 'Data to request:', ...result.dataToRequest.map((d) => `• ${d}`)].join('\n')
    : '';

  return (
    <Screen>
      {!kpi ? (
        <>
          <TextField label="Which KPI moved?" placeholder="e.g. churn, EBITDA margin, OEE" value={q} onChangeText={setQ} autoFocus autoCorrect={false} />
          <Card style={{ marginTop: space.md }}>
            {hits.map((k) => (
              <KpiRow key={k.id} kpi={k} onPress={() => setKpiId(k.id)} />
            ))}
          </Card>
        </>
      ) : (
        <View style={{ gap: space.md }}>
          <Card>
            <AppText variant="label" muted>
              KPI
            </AppText>
            <Row>
              <AppText variant="heading" style={{ flex: 1 }}>
                {kpi.name}
              </AppText>
              <Button small variant="ghost" title="Change" onPress={() => (setKpiId(''), setResult(undefined))} />
            </Row>
            <Row style={{ marginTop: space.md, alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <TextField label="From" placeholder={kpi.unit === '%' ? '4%' : 'before'} value={from} onChangeText={setFrom} keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label="To" placeholder={kpi.unit === '%' ? '7%' : 'after'} value={to} onChangeText={setTo} keyboardType="decimal-pad" />
              </View>
            </Row>
            <Button title="Diagnose" icon="pulse-outline" style={{ marginTop: space.md }} onPress={() => setResult(diagnose(kpi, kb.graph, { from: num(from), to: num(to) }))} />
          </Card>
          {result && (
            <>
              <InsightCard title="Assessment" body={result.headline} severity={result.severity} />
              <AiCardView card={{ kind: 'checklist', title: 'Rule these out first', items: result.questions }} actions={{ onAddToProject: setAddIds, onApplyMap: () => undefined }} />
              <AiCardView card={{ kind: 'driver-tree', title: 'Driver tree', tree: result.driverTree }} actions={{ onAddToProject: setAddIds, onApplyMap: () => undefined }} />
              <AiCardView card={{ kind: 'checklist', title: 'Hypotheses to test', items: result.hypotheses.map((h) => `${h.driver}: ${h.checks.join(' ')}`) }} actions={{ onAddToProject: setAddIds, onApplyMap: () => undefined }} />
              <AiCardView card={{ kind: 'checklist', title: 'Data to request', items: result.dataToRequest }} actions={{ onAddToProject: setAddIds, onApplyMap: () => undefined }} />
              {result.gamingWatchouts.length > 0 && <AiCardView card={{ kind: 'checklist', title: 'Check the number isn’t being gamed', items: result.gamingWatchouts }} actions={{ onAddToProject: setAddIds, onApplyMap: () => undefined }} />}
              <Row>
                <Button title="Share" icon="share-outline" variant="secondary" onPress={() => share.text(text, `${kpi.name} diagnosis`)} style={{ flex: 1 }} />
                <Button title="Copy" icon="copy-outline" variant="ghost" onPress={() => share.copy(text)} style={{ flex: 1 }} />
              </Row>
            </>
          )}
        </View>
      )}
      <AddToProjectSheet kpiIds={addIds ?? []} visible={Boolean(addIds)} onClose={() => setAddIds(null)} />
    </Screen>
  );
}
