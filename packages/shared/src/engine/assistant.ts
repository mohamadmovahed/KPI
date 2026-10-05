import { INDICATOR_LABEL, INDUSTRY_LABEL, LEVEL_LABEL, PERSPECTIVE_LABEL } from '../taxonomy';
import type { AiCard, AiContext, AiIntent, AiResponse, Kpi } from '../types';
import { analyzeBalance } from './balance';
import { diagnose } from './diagnose';
import type { KnowledgeBase } from './knowledgeBase';
import { recommendKpis } from './recommend';
import { generateStrategyMap } from './strategyMap';
import { extractNumbers, interpretQuery, normalize } from './text';

const RX = {
  diagnose: /\b(why|declin\w*|drop\w*|decreas\w*|increas\w*|rose|risen|fell|fallen|went (up|down)|investigat\w*|root cause|deteriorat\w*|worse\w*|spik\w*|jump\w*|plung\w*)\b/,
  compare: /\b(difference between|differences between|vs\.?|versus|compare|comparison)\b/,
  balance: /\b(balanced|balance|review (these|my|our) kpis|are (my|our|these) kpis|check (my|our) kpis|audit)\b/,
  map: /\b(strategy map|strategic map|strategic objectives|objectives for|build a map)\b/,
  targets: /\b(target|targets|goal setting|set a goal|ambition level)\b/,
  summary: /\b(executive summary|summari[sz]e (my|the|our) project|board summary)\b/,
  explain: /\b(what is|what s|what are|explain|define|definition|meaning of|how (do|to|is) .*calculat\w*|tell me about)\b/,
  recommend: /\b(kpis? for|recommend\w*|suggest\w*|need (some )?kpis|give me|which kpis|kpi set|build a kpi|indicators (for|of)|measure (of|for)|metrics for)\b/,
  smalltalk: /^(hi|hello|hey|thanks|thank you|help|what can you do)\b/,
};

export function detectIntent(message: string, mentions: Kpi[]): AiIntent {
  const t = normalize(message);
  if (RX.smalltalk.test(t) && t.split(' ').length <= 5) return 'smalltalk';
  if (RX.summary.test(t)) return 'summary';
  if (RX.balance.test(t)) return 'balance';
  if (RX.map.test(t)) return 'strategy-map';
  if (RX.compare.test(t) && mentions.length >= 2) return 'compare';
  if (RX.diagnose.test(t) && mentions.length >= 1 && !RX.recommend.test(t)) return 'diagnose';
  if (RX.targets.test(t) && mentions.length >= 1) return 'targets';
  if (RX.explain.test(t) && mentions.length >= 1) return 'explain';
  if (RX.recommend.test(t)) return 'recommend';
  if (mentions.length === 1 && t.split(' ').length <= 4) return 'explain';
  return 'search';
}

function fromTo(message: string): { from?: number; to?: number } {
  const m = message.match(/from\s+(-?\d+(?:[.,]\d+)?)\s*%?\s*(?:to|→|->)\s*(-?\d+(?:[.,]\d+)?)/i);
  if (m) return { from: Number(m[1].replace(',', '.')), to: Number(m[2].replace(',', '.')) };
  const nums = extractNumbers(message).filter((n) => n < 1900 || n > 2100);
  return nums.length >= 2 ? { from: nums[0], to: nums[1] } : {};
}

const describe = (k: Kpi) => `${INDICATOR_LABEL[k.indicator]} · ${PERSPECTIVE_LABEL[k.perspective]} · ${k.levels.map((l) => LEVEL_LABEL[l]).join('/')}`;

/**
 * Deterministic strategy-consultant engine. Produces the same structured card schema the LLM
 * orchestrator returns, so the mobile UI renders both identically. It also grounds the LLM:
 * the server passes these cards as context and lets the model refine wording and reasoning.
 */
export function runAssistant(kb: KnowledgeBase, message: string, ctx: AiContext = {}, now = new Date()): AiResponse {
  const mentions = kb.findMentions(message);
  const intent = detectIntent(message, mentions);
  const interp = interpretQuery(message);
  const industry = interp.industries[0] ?? ctx.industry;
  const cards: AiCard[] = [];
  let summary = '';
  let followUps: string[] = [];

  switch (intent) {
    case 'smalltalk': {
      summary = 'I’m your KPI and strategy copilot. Ask me to recommend KPIs, explain or compare them, diagnose a performance change, or review whether your KPI set is balanced.';
      cards.push({
        kind: 'checklist',
        title: 'Try asking',
        items: [
          'KPIs for improving customer retention in telecom',
          'Why could EBITDA margin decline?',
          'What’s the difference between retention and churn?',
          'Are my KPIs balanced?',
        ],
      });
      followUps = ['KPIs for customer loyalty in telecom', 'Leading indicators of profitability'];
      break;
    }

    case 'recommend': {
      const { recommendations } = recommendKpis(kb.index, kb.graph, { query: message, industry, count: 6 });
      if (!recommendations.length) return fallbackSearch(kb, message, ctx, now);
      const scope = [industry && INDUSTRY_LABEL[industry], interp.themes[0]].filter(Boolean).join(' · ');
      const leading = recommendations.filter((r) => r.role === 'driver').length;
      summary = `Here is a balanced starter set${scope ? ` for ${scope}` : ''}: ${recommendations.length - leading} outcome KPI${recommendations.length - leading === 1 ? '' : 's'} that define success and ${leading} leading indicator${leading === 1 ? '' : 's'} that give early warning.`;
      for (const r of recommendations) {
        const k = kb.get(r.kpiId)!;
        cards.push({ kind: 'recommendation', title: k.name, kpiId: k.id, why: r.rationale, indicator: k.indicator, complementIds: r.complementIds });
      }
      followUps = ['Are these KPIs balanced?', `What drives ${kb.get(recommendations[0].kpiId)!.name}?`, 'Build a strategy map for this'];
      break;
    }

    case 'explain': {
      const k = mentions[0];
      summary = `${k.name}: ${k.shortDefinition}`;
      cards.push({ kind: 'insight', title: 'Why it matters', body: `${k.purpose}\n\n${describe(k)}` });
      cards.push({ kind: 'insight', title: 'Formula', body: `${k.formula}${k.formulaExample ? `\n\nExample: ${k.formulaExample}` : ''}` });
      const drivers = kb.graph.drivers(k.id).slice(0, 4).map((d) => d.id);
      const outcomes = kb.graph.outcomes(k.id).slice(0, 4).map((d) => d.id);
      if (drivers.length) cards.push({ kind: 'kpi-list', title: 'Leading indicators that drive it', kpiIds: drivers });
      if (outcomes.length) cards.push({ kind: 'kpi-list', title: 'Outcomes it influences', kpiIds: outcomes });
      if (k.gamingRisks.length) cards.push({ kind: 'checklist', title: 'Watch out for gaming', items: k.gamingRisks });
      followUps = [`What drives ${k.name}?`, `Our ${k.name} got worse. What should I investigate?`, 'Show related KPIs'];
      break;
    }

    case 'compare': {
      const [a, b] = mentions;
      const rows = [
        { label: 'Measures', values: [a.shortDefinition, b.shortDefinition] },
        { label: 'Formula', values: [a.formula, b.formula] },
        { label: 'Type', values: [INDICATOR_LABEL[a.indicator], INDICATOR_LABEL[b.indicator]] },
        { label: 'BSC', values: [PERSPECTIVE_LABEL[a.perspective], PERSPECTIVE_LABEL[b.perspective]] },
        { label: 'Better when', values: [a.direction, b.direction].map((d) => (d === 'higher' ? 'Higher' : d === 'lower' ? 'Lower' : 'On target')) },
      ];
      const inverse = a.inverseOf === b.id || b.inverseOf === a.id;
      const linked = kb.graph.drivers(b.id).some((d) => d.id === a.id) ? `${a.name} is a driver of ${b.name}.` : kb.graph.drivers(a.id).some((d) => d.id === b.id) ? `${b.name} is a driver of ${a.name}.` : '';
      const verdict = inverse
        ? `They measure the same phenomenon from opposite sides. ${a.name} and ${b.name} roughly sum to 100% over the same period and base, so use one on the scorecard and keep the other for communication.`
        : `${linked} Use ${a.indicator === 'leading' ? a.name : b.name} for early warning and ${a.indicator === 'lagging' ? a.name : b.name} to confirm results.`.trim();
      summary = verdict;
      cards.push({ kind: 'comparison', title: `${a.name} vs ${b.name}`, kpiIds: [a.id, b.id], rows, verdict });
      followUps = [`Explain ${a.name}`, `Explain ${b.name}`];
      break;
    }

    case 'diagnose': {
      const k = mentions[0];
      const d = diagnose(k, kb.graph, fromTo(message));
      summary =
        d.deterioration === false
          ? `${k.name} improved. Confirm it is real (definition, data, one-offs) and find which drivers moved so you can sustain it.`
          : `Start by ruling out measurement effects and locating where the change is concentrated, then test the drivers below — ${kb.graph.drivers(k.id).length ? 'leading indicators first, since they usually move before ' + k.name : 'starting with the largest controllable ones'}.`;
      cards.push({ kind: 'insight', title: 'Assessment', body: d.headline, severity: d.severity });
      cards.push({ kind: 'checklist', title: 'Rule these out first', items: d.questions.slice(0, 4) });
      cards.push({ kind: 'driver-tree', title: 'Driver tree', tree: d.driverTree });
      cards.push({ kind: 'checklist', title: 'Hypotheses to test', items: d.hypotheses.slice(0, 7).map((h) => `${h.driver}: ${h.checks[0]}`) });
      cards.push({ kind: 'checklist', title: 'Data to request', items: d.dataToRequest.slice(0, 6) });
      followUps = [`Leading indicators for ${k.name}`, `Explain ${k.name}`, 'Are my KPIs balanced?'];
      break;
    }

    case 'balance': {
      const ids = ctx.kpiIds?.length ? ctx.kpiIds : mentions.map((m) => m.id);
      if (!ids.length) {
        summary = 'Open a project (or mention the KPIs) and I’ll check perspective coverage, leading/lagging mix, causal links and redundancy.';
        cards.push({ kind: 'insight', title: 'No KPI set in scope', body: 'Select a project in the assistant header, or ask e.g. “Are churn, NPS and EBITDA margin balanced?”', severity: 'info' });
        followUps = ['KPIs for customer loyalty in telecom'];
        break;
      }
      const report = analyzeBalance(kb.require(ids), { graph: kb.graph, library: kb.kpis, industry });
      summary = `Balance score ${report.score}/100${ctx.projectName ? ` for ${ctx.projectName}` : ''}. ${report.findings.find((f) => f.severity === 'critical' || f.severity === 'warning')?.message ?? 'The set looks well balanced.'}`;
      cards.push({ kind: 'balance', title: 'KPI balance review', report });
      if (report.suggestedKpiIds.length) cards.push({ kind: 'kpi-list', title: 'Suggested additions', kpiIds: report.suggestedKpiIds, note: 'Closes the gaps above' });
      followUps = ['Build a strategy map for this', 'Generate an executive summary'];
      break;
    }

    case 'strategy-map': {
      const map = generateStrategyMap(kb, { themes: interp.themes, industry });
      summary = `Draft strategy map with ${map.objectives.length} objectives across the four perspectives and ${map.links.length} cause-and-effect links. Apply it to a project to edit it by touch.`;
      cards.push({ kind: 'map-proposal', title: 'Draft strategy map', map });
      followUps = ['Are my KPIs balanced?', 'KPIs for improving customer retention'];
      break;
    }

    case 'targets': {
      const k = mentions[0];
      const d = k.direction === 'higher' ? 'increase' : k.direction === 'lower' ? 'reduce' : 'hold within a band';
      summary = `Set the ${k.name} target from a baseline, an external reference and a realistic improvement trajectory.`;
      cards.push({
        kind: 'checklist',
        title: `Target-setting for ${k.name}`,
        items: [
          `Establish a clean baseline (last 12 months, same definition: ${k.formula}).`,
          `Reference point: ${k.benchmarks[0] ? `${k.benchmarks[0].value}${k.benchmarks[0].illustrative ? ' (indicative)' : ''}` : 'peer or best-internal-unit performance'}.`,
          `Direction: ${d}. Set a committed target and a stretch target.`,
          'Phase the target quarterly along the expected impact of initiatives.',
          `Pair it with leading indicators: ${kb.graph.drivers(k.id).slice(0, 3).map((x) => x.name).join(', ') || 'define drivers first'}.`,
        ],
      });
      cards.push({ kind: 'insight', title: 'Coming in Phase 2', body: 'Benchmark-based target ranges and trajectory modelling will be generated automatically.', severity: 'info' });
      followUps = [`Explain ${k.name}`];
      break;
    }

    case 'summary': {
      summary = 'Open the project and tap “Executive summary” to generate a shareable one-pager (PDF, copy or share).';
      cards.push({ kind: 'insight', title: 'Executive summary', body: summary });
      break;
    }

    case 'search':
    default:
      return fallbackSearch(kb, message, ctx, now);
  }

  return { intent, summary, cards, followUps, engine: 'engine', createdAt: now.toISOString() };
}

function fallbackSearch(kb: KnowledgeBase, message: string, ctx: AiContext, now: Date): AiResponse {
  const res = kb.index.search(message, { limit: 8, filters: ctx.industry ? { industries: [ctx.industry] } : undefined });
  const ids = res.hits.map((h) => h.kpi.id);
  return {
    intent: 'search',
    summary: ids.length ? `I found ${res.total} relevant KPI${res.total === 1 ? '' : 's'}. The top matches:` : 'I couldn’t match that to KPIs yet. Try naming an objective, KPI, industry or function.',
    cards: ids.length ? [{ kind: 'kpi-list', title: 'Relevant KPIs', kpiIds: ids }] : [],
    followUps: ['KPIs for customer loyalty in telecom', 'Leading indicators of profitability'],
    engine: 'engine',
    createdAt: now.toISOString(),
  };
}
