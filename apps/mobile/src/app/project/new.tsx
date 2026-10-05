import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { INDUSTRIES, type IndustryId } from '@kpi/shared';
import { AppText, Button, Chip, Row, TextField } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { useProjects } from '@/state/projects';
import { useSettings } from '@/state/settings';
import { space } from '@/theme/tokens';

export default function NewProject() {
  const { kpiIds } = useLocalSearchParams<{ kpiIds?: string }>();
  const create = useProjects((s) => s.create);
  const addKpis = useProjects((s) => s.addKpis);
  const defaultIndustry = useSettings((s) => s.defaultIndustry);
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [horizon, setHorizon] = useState('');
  const [ambition, setAmbition] = useState('');
  const [industry, setIndustry] = useState<IndustryId | undefined>(defaultIndustry);

  const submit = () => {
    const p = create({ name, client, industry, horizon, strategyStatement: ambition });
    if (kpiIds) addKpis(p.id, kpiIds.split(',').filter(Boolean));
    router.replace(`/project/${p.id}`);
  };

  return (
    <Screen>
      <TextField label="Project name" placeholder="Telecom Strategy 2027–2030" value={name} onChangeText={setName} autoFocus />
      <TextField label="Client (optional)" placeholder="Company name" value={client} onChangeText={setClient} />
      <TextField label="Horizon (optional)" placeholder="2027–2030" value={horizon} onChangeText={setHorizon} />
      <TextField label="Strategic ambition (optional)" placeholder="Become the most trusted operator in the market…" value={ambition} onChangeText={setAmbition} multiline style={{ minHeight: 88 }} />
      <AppText variant="label" muted style={{ marginTop: space.lg, marginBottom: space.sm }}>
        INDUSTRY
      </AppText>
      <Row wrap gap={space.sm}>
        {INDUSTRIES.filter((i) => i.id !== 'cross').map((i) => (
          <Chip key={i.id} label={i.label} selected={industry === i.id} onPress={() => setIndustry(industry === i.id ? undefined : i.id)} />
        ))}
      </Row>
      {kpiIds ? (
        <AppText variant="caption" muted style={{ marginTop: space.lg }}>
          {kpiIds.split(',').length} KPI(s) will be added.
        </AppText>
      ) : null}
      <Button title="Create project" icon="checkmark" onPress={submit} disabled={!name.trim()} full style={{ marginTop: space.xl }} />
    </Screen>
  );
}
