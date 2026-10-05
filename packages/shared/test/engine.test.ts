import { describe, expect, it } from 'vitest';
import {
  analyzeBalance,
  buildExecutiveSummary,
  diagnose,
  generateStrategyMap,
  interpretQuery,
  KnowledgeBase,
  KPIS,
  llmResponseSchema,
  mapHealth,
  projectSchema,
  qualityScore,
  runAssistant,
  SOURCE_BY_ID,
  summaryToHtml,
  summaryToText,
  type Project,
} from '../src';

const kb = new KnowledgeBase();

describe('dataset integrity', () => {
  it('has unique ids and valid references', () => {
    const ids = new Set(KPIS.map((k) => k.id));
    expect(ids.size).toBe(KPIS.length);
    for (const k of KPIS) {
      for (const ref of [...k.leadingIds, ...k.laggingIds, ...(k.inverseOf ? [k.inverseOf] : [])]) {
        expect(ids.has(ref), `${k.id} -> ${ref}`).toBe(true);
      }
      for (const t of k.tradeoffs) if (t.kpiId) expect(ids.has(t.kpiId), `${k.id} tradeoff -> ${t.kpiId}`).toBe(true);
      for (const s of [...k.sourceIds, ...k.benchmarks.flatMap((b) => (b.sourceId ? [b.sourceId] : []))]) {
        expect(SOURCE_BY_ID[s], `${k.id} source ${s}`).toBeDefined();
      }
      expect(k.levels.length).toBeGreaterThan(0);
      expect(k.functions.length).toBeGreaterThan(0);
    }
  });

  it('covers every BSC perspective with leading and lagging KPIs', () => {
    for (const p of ['financial', 'customer', 'internal', 'learning'] as const) {
      expect(KPIS.some((k) => k.perspective === p)).toBe(true);
    }
    expect(KPIS.filter((k) => k.indicator === 'leading').length).toBeGreaterThan(15);
  });
});

describe('query interpretation & search', () => {
  it('extracts industry, theme and level from natural language', () => {
    const i = interpretQuery('Customer loyalty KPIs in banking');
    expect(i.industries).toEqual(['banking']);
    expect(i.themes).toContain('loyalty');
    expect(interpretQuery('Operational KPIs for manufacturing').levels).toContain('operational');
    expect(interpretQuery('Leading indicators of profitability').indicators).toContain('leading');
  });

  it('Use case 1: "KPIs for customer loyalty in telecom" returns loyalty KPIs first', () => {
    const res = kb.index.search('KPIs for customer loyalty in telecom');
    const top = res.hits.slice(0, 5).map((h) => h.kpi.id);
    expect(top).toContain('churn-rate');
    expect(top.some((id) => ['nps', 'retention-rate'].includes(id))).toBe(true);
    expect(res.interpretation.industries).toContain('telecom');
  });

  it('finds KPIs by acronym and exact name', () => {
    expect(kb.index.search('ROIC').hits[0].kpi.id).toBe('roic');
    expect(kb.index.search('ebitda margin').hits[0].kpi.id).toBe('ebitda-margin');
    expect(kb.index.search('OEE').hits[0].kpi.id).toBe('oee');
  });

  it('applies detected structural filters', () => {
    const res = kb.index.search('Leading indicators of profitability');
    expect(res.hits.length).toBeGreaterThan(0);
    expect(res.hits.every((h) => h.kpi.indicator === 'leading')).toBe(true);
    const ops = kb.index.search('Operational KPIs for manufacturing');
    expect(ops.hits.every((h) => h.kpi.levels.includes('operational'))).toBe(true);
    expect(ops.hits[0].kpi.industries).toContain('manufacturing');
  });

  it('HR productivity query returns HR-relevant KPIs', () => {
    const top = kb.index.search('HR KPIs for employee productivity').hits.slice(0, 4).map((h) => h.kpi.id);
    expect(top).toContain('revenue-per-employee');
  });

  it('empty query lists everything respecting filters', () => {
    const res = kb.index.search('', { filters: { perspectives: ['learning'] }, limit: 100 });
    expect(res.total).toBe(KPIS.filter((k) => k.perspective === 'learning').length);
  });
});

describe('quality score', () => {
  it('scores well-documented KPIs between 60 and 100', () => {
    for (const k of KPIS) {
      const q = qualityScore(k);
      expect(q.total).toBeGreaterThanOrEqual(45);
      expect(q.total).toBeLessThanOrEqual(100);
      expect(q.breakdown.reduce((s, b) => s + b.max, 0)).toBe(100);
    }
    expect(qualityScore(kb.get('churn-rate')!).total).toBeGreaterThan(80);
  });
});

describe('relationship graph', () => {
  it('derives inverse edges and a value chain up to financial outcomes', () => {
    expect(kb.graph.outcomes('nps').map((k) => k.id)).toContain('churn-rate');
    expect(kb.graph.drivers('churn-rate').map((k) => k.id)).toContain('nps');
    const chain = kb.graph.valueChain('churn-rate');
    expect(chain[0].perspective).toBe('learning');
    expect(chain.at(-1)!.perspective).toBe('financial');
  });

  it('neighbourhood is bounded for mobile rendering', () => {
    const n = kb.graph.neighbourhood('churn-rate', 1, 6);
    expect(n.nodes.length).toBeLessThanOrEqual(13);
    expect(n.nodes[0].id).toBe('churn-rate');
  });
});

describe('diagnosis', () => {
  it('Use case 3: churn from 4% to 7% is a critical deterioration with a driver tree', () => {
    const d = diagnose(kb.get('churn-rate')!, kb.graph, { from: 4, to: 7 });
    expect(d.deterioration).toBe(true);
    expect(d.severity).toBe('critical');
    expect(d.absoluteChange).toBe(3);
    expect(d.headline).toContain('+3 pp');
    expect(d.driverTree.children.length).toBeGreaterThan(3);
    expect(d.questions.some((q) => /voluntary/.test(q))).toBe(true);
  });

  it('treats a falling higher-is-better KPI as deterioration', () => {
    const d = diagnose(kb.get('ebitda-margin')!, kb.graph, { from: 32, to: 28 });
    expect(d.deterioration).toBe(true);
    expect(d.severity).toBe('warning');
  });
});

describe('balance', () => {
  it('flags a lagging-only financial set', () => {
    const r = analyzeBalance(kb.require(['roic', 'ebitda-margin', 'revenue-growth']), { graph: kb.graph, library: kb.kpis });
    expect(r.score).toBeLessThan(50);
    expect(r.findings.some((f) => f.severity === 'critical')).toBe(true);
    expect(r.suggestedKpiIds.length).toBeGreaterThan(0);
  });

  it('rewards a balanced, connected set', () => {
    const r = analyzeBalance(kb.require(['revenue-growth', 'churn-rate', 'nps', 'first-contact-resolution', 'skills-coverage', 'employee-engagement']), {
      graph: kb.graph,
      library: kb.kpis,
    });
    expect(r.score).toBeGreaterThanOrEqual(80);
  });
});

describe('assistant engine', () => {
  it('recommends a balanced set with leading and lagging KPIs', () => {
    const r = runAssistant(kb, 'I need KPIs for a telecom company’s customer strategy.');
    expect(r.intent).toBe('recommend');
    const recs = r.cards.filter((c) => c.kind === 'recommendation');
    expect(recs.length).toBeGreaterThanOrEqual(4);
    expect(recs.some((c) => c.kind === 'recommendation' && c.indicator === 'leading')).toBe(true);
    expect(recs.some((c) => c.kind === 'recommendation' && c.indicator === 'lagging')).toBe(true);
  });

  it('diagnoses "Our customer churn increased from 4% to 7%"', () => {
    const r = runAssistant(kb, 'Our customer churn increased from 4% to 7%. What should I investigate?');
    expect(r.intent).toBe('diagnose');
    expect(r.summary).toMatch(/4% to 7%/);
    expect(r.cards.some((c) => c.kind === 'driver-tree')).toBe(true);
  });

  it('compares retention and churn', () => {
    const r = runAssistant(kb, "What's the difference between customer retention and churn?");
    expect(r.intent).toBe('compare');
    expect(r.summary).toMatch(/opposite sides/);
  });

  it('explains a KPI', () => {
    const r = runAssistant(kb, 'What is ROIC?');
    expect(r.intent).toBe('explain');
    expect(r.cards.some((c) => c.kind === 'insight' && c.title === 'Formula')).toBe(true);
  });

  it('Use case 7: reviews balance of the project KPI set', () => {
    const r = runAssistant(kb, 'Are my KPIs balanced?', { kpiIds: ['churn-rate', 'nps', 'arpu'], projectName: 'Telecom' });
    expect(r.intent).toBe('balance');
    expect(r.cards[0].kind).toBe('balance');
  });

  it('handles EBITDA decline question as a diagnosis', () => {
    const r = runAssistant(kb, 'Why could EBITDA margin decline?');
    expect(r.intent).toBe('diagnose');
  });

  it('generates a strategy map proposal', () => {
    const r = runAssistant(kb, 'Build a strategy map for a telecom focused on loyalty');
    expect(r.intent).toBe('strategy-map');
  });

  it('prefers longest mention (customer attrition → churn)', () => {
    expect(kb.findMentions('customer attrition went up')[0].id).toBe('churn-rate');
  });
});

describe('strategy map & summary', () => {
  const map = generateStrategyMap(kb, { themes: ['loyalty', 'growth'], industry: 'telecom' });

  it('generates objectives in all perspectives, linked bottom-up', () => {
    expect(new Set(map.objectives.map((o) => o.perspective)).size).toBe(4);
    expect(map.links.length).toBeGreaterThanOrEqual(3);
    expect(map.objectives.find((o) => o.perspective === 'customer')!.title).toMatch(/loyalty/i);
    expect(mapHealth(map)[0].severity).toBe('positive');
  });

  it('Use case 8: builds a shareable executive summary', () => {
    const now = new Date().toISOString();
    const project: Project = {
      id: 'p1',
      name: 'Telecom Strategy 2027–2030',
      industry: 'telecom',
      horizon: '2027–2030',
      kpis: ['churn-rate', 'nps', 'arpu'].map((kpiId) => ({ kpiId, addedAt: now, target: kpiId === 'churn-rate' ? '1.2%' : undefined })),
      map,
      initiatives: [{ id: 'i1', title: 'Network modernisation', status: 'active' }],
      createdAt: now,
      updatedAt: now,
    };
    expect(projectSchema.safeParse(project).success).toBe(true);
    const s = buildExecutiveSummary(project, kb);
    const text = summaryToText(s);
    expect(text).toMatch(/TELECOM STRATEGY|KPI SCORECARD/i);
    expect(text).toMatch(/target 1.2%/);
    expect(summaryToHtml(s)).toContain('<h1>Telecom Strategy 2027–2030 — Executive Summary</h1>');
  });
});

describe('validation', () => {
  it('accepts engine-shaped LLM responses and rejects unknown cards', () => {
    expect(llmResponseSchema.safeParse({ summary: 'x', cards: [{ kind: 'insight', title: 't', body: 'b' }], followUps: [] }).success).toBe(true);
    expect(llmResponseSchema.safeParse({ summary: 'x', cards: [{ kind: 'html', body: '<script>' }], followUps: [] }).success).toBe(false);
  });
});
