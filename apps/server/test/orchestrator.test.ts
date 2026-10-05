import { describe, expect, it } from 'vitest';
import { KnowledgeBase } from '@kpi/shared';
import { AiOrchestrator } from '../src/ai/orchestrator';

const kb = new KnowledgeBase();

function withFakeClient(reply: unknown, stop_reason = 'end_turn') {
  const orch = new AiOrchestrator(kb, { apiKey: 'test-key', model: 'claude-opus-5-5' });
  const calls: Record<string, unknown>[] = [];
  (orch as unknown as { client: unknown }).client = {
    beta: { messages: { create: async (params: Record<string, unknown>) => (calls.push(params), { stop_reason, content: [{ type: 'text', text: JSON.stringify(reply) }] }) } },
  };
  return { orch, calls };
}

describe('AiOrchestrator (LLM path)', () => {
  it('sanitises LLM output and keeps engine structural cards', async () => {
    const { orch, calls } = withFakeClient({
      summary: 'Start with churn drivers.',
      cards: [
        { kind: 'recommendation', title: 'Churn', kpiId: 'churn-rate', why: 'x', indicator: 'lagging', complementIds: ['nps', 'invented-kpi'] },
        { kind: 'recommendation', title: 'Fake', kpiId: 'invented-kpi', why: 'x', indicator: 'leading', complementIds: [] },
        { kind: 'checklist', title: 'Check', items: ['Segment the increase'] },
      ],
      followUps: ['a', 'b', 'c', 'd'],
    });
    const r = await orch.chat('Our customer churn increased from 4% to 7%', {});
    expect(r.engine).toBe('llm');
    expect(r.cards.find((c) => c.kind === 'recommendation' && c.kpiId === 'invented-kpi')).toBeUndefined();
    const churn = r.cards.find((c) => c.kind === 'recommendation');
    expect(churn && churn.kind === 'recommendation' && churn.complementIds).toEqual(['nps']);
    expect(r.cards.some((c) => c.kind === 'driver-tree')).toBe(true);
    expect(r.followUps).toHaveLength(3);
    // Request shape: cached stable system prompt, structured output, default fallbacks.
    const p = calls[0] as { model: string; fallbacks: string; output_config: { format: { type: string } }; system: { cache_control: unknown }[] };
    expect(p.model).toBe('claude-opus-5-5');
    expect(p.fallbacks).toBe('default');
    expect(p.output_config.format.type).toBe('json_schema');
    expect(p.system[0].cache_control).toEqual({ type: 'ephemeral' });
  });

  it('falls back to the engine on refusal or malformed output', async () => {
    const { orch } = withFakeClient({ summary: 'x' }, 'refusal');
    const r = await orch.chat('What is ROIC?', {});
    expect(r.engine).toBe('engine');
    const bad = withFakeClient({ nope: true });
    expect((await bad.orch.chat('What is ROIC?', {})).engine).toBe('engine');
  });
});
