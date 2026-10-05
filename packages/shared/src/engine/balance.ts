import { PERSPECTIVE_LABEL, PERSPECTIVE_ORDER } from '../taxonomy';
import type { BalanceReport, BscPerspective, Finding, IndustryId, Kpi, ProjectKpi } from '../types';
import type { KpiGraph } from './graph';

export interface BalanceOptions {
  graph: KpiGraph;
  /** Whole KPI library, used to suggest additions. */
  library: Kpi[];
  industry?: IndustryId;
  /** Project KPI entries, used to check target coverage. */
  projectKpis?: ProjectKpi[];
}

/**
 * "Are my KPIs balanced?" — scores a KPI set (0–100) on:
 *  perspective coverage & evenness (40), leading/lagging mix (25), level mix (10),
 *  causal connectivity (15) and redundancy (10). Returns findings and suggested additions.
 */
export function analyzeBalance(kpis: Kpi[], opts: BalanceOptions): BalanceReport {
  const perspectives: Record<BscPerspective, number> = { financial: 0, customer: 0, internal: 0, learning: 0 };
  const indicators = { leading: 0, lagging: 0 };
  const levels = { corporate: 0, functional: 0, operational: 0 };
  kpis.forEach((k) => {
    perspectives[k.perspective]++;
    indicators[k.indicator]++;
    k.levels.forEach((l) => levels[l]++);
  });

  const n = kpis.length;
  const findings: Finding[] = [];
  const suggested = new Set<string>();
  const ids = new Set(kpis.map((k) => k.id));

  if (n === 0) {
    return {
      score: 0,
      perspectives,
      indicators,
      levels,
      leadingShare: 0,
      findings: [{ severity: 'info', message: 'No KPIs yet. Add KPIs or ask the assistant to recommend a set.' }],
      suggestedKpiIds: [],
    };
  }

  // 1. Perspective coverage (32) + evenness (8)
  const missing = PERSPECTIVE_ORDER.filter((p) => perspectives[p] === 0);
  let score = (4 - missing.length) * 8;
  const maxShare = Math.max(...Object.values(perspectives)) / n;
  score += maxShare <= 0.5 ? 8 : maxShare <= 0.7 ? 4 : 0;
  if (missing.length) {
    findings.push({
      severity: missing.length >= 2 ? 'critical' : 'warning',
      message: `No KPIs in the ${missing.map((p) => PERSPECTIVE_LABEL[p]).join(', ')} perspective${missing.length > 1 ? 's' : ''}.`,
    });
  } else {
    findings.push({ severity: 'positive', message: 'All four Balanced Scorecard perspectives are covered.' });
  }
  if (maxShare > 0.5 && n >= 4) {
    const dominant = PERSPECTIVE_ORDER.find((p) => perspectives[p] / n === maxShare)!;
    findings.push({ severity: 'warning', message: `${Math.round(maxShare * 100)}% of KPIs are ${PERSPECTIVE_LABEL[dominant]} — the set is skewed.` });
  }

  // 2. Leading / lagging mix (25): ideal leading share 35–65%
  const leadingShare = indicators.leading / n;
  const mixScore = leadingShare >= 0.35 && leadingShare <= 0.65 ? 25 : Math.max(0, 25 - Math.abs(leadingShare - 0.5) * 60);
  score += mixScore;
  if (leadingShare < 0.35) {
    findings.push({
      severity: leadingShare < 0.2 ? 'critical' : 'warning',
      message: `Only ${indicators.leading} of ${n} KPIs are leading indicators. You will see problems after they happen.`,
    });
  } else if (leadingShare > 0.65) {
    findings.push({ severity: 'warning', message: `${indicators.lagging} of ${n} KPIs are outcomes — add lagging KPIs that prove the strategy works.` });
  } else {
    findings.push({ severity: 'positive', message: `Healthy mix: ${indicators.leading} leading and ${indicators.lagging} lagging indicators.` });
  }

  // 3. Level mix (10)
  const hasCorporate = levels.corporate > 0;
  const hasExecution = levels.functional + levels.operational > 0;
  score += (hasCorporate ? 5 : 0) + (hasExecution ? 5 : 0);
  if (!hasCorporate) findings.push({ severity: 'info', message: 'No corporate-level KPI — the board view is missing.' });
  if (!hasExecution) findings.push({ severity: 'info', message: 'No functional or operational KPI — teams cannot act on the set directly.' });

  // 4. Causal connectivity (15)
  const connected = kpis.filter((k) => [...opts.graph.drivers(k.id), ...opts.graph.outcomes(k.id)].some((x) => ids.has(x.id))).length;
  const connectivity = n > 1 ? connected / n : 0;
  score += connectivity * 15;
  if (n > 2 && connectivity < 0.5) {
    findings.push({ severity: 'warning', message: `Only ${connected} of ${n} KPIs are causally linked to another KPI in the set — the story from drivers to outcomes is weak.` });
  }

  // 5. Redundancy (10)
  const inversePairs = kpis.filter((k) => k.inverseOf && ids.has(k.inverseOf)).length / 2;
  score += Math.max(0, 10 - inversePairs * 5);
  if (inversePairs > 0) {
    const pair = kpis.find((k) => k.inverseOf && ids.has(k.inverseOf))!;
    findings.push({ severity: 'info', message: `${pair.name} and its inverse are both included — consider keeping one.` });
  }

  // Target coverage (reported, not scored)
  if (opts.projectKpis?.length) {
    const withoutTarget = opts.projectKpis.filter((p) => !p.target?.trim()).length;
    if (withoutTarget) findings.push({ severity: 'info', message: `${withoutTarget} KPI${withoutTarget > 1 ? 's have' : ' has'} no target yet.` });
  }

  // Suggestions
  const fits = (k: Kpi) => !opts.industry || k.industries.includes(opts.industry) || k.industries.includes('cross');
  const neighbours = (k: Kpi) => [...opts.graph.drivers(k.id), ...opts.graph.outcomes(k.id)];
  for (const p of missing) {
    const linked = kpis.flatMap(neighbours).find((c) => c.perspective === p && !ids.has(c.id) && fits(c));
    const fallback = opts.library.find((c) => c.perspective === p && !ids.has(c.id) && fits(c) && c.levels.includes('corporate'));
    const pick = linked ?? fallback;
    if (pick) suggested.add(pick.id);
  }
  if (leadingShare < 0.35) {
    kpis
      .filter((k) => k.indicator === 'lagging')
      .flatMap((k) => opts.graph.drivers(k.id))
      .filter((d) => d.indicator === 'leading' && !ids.has(d.id) && fits(d))
      .slice(0, 3)
      .forEach((d) => suggested.add(d.id));
  }
  if (leadingShare > 0.65) {
    kpis
      .filter((k) => k.indicator === 'leading')
      .flatMap((k) => opts.graph.outcomes(k.id))
      .filter((o) => o.indicator === 'lagging' && !ids.has(o.id) && fits(o))
      .slice(0, 2)
      .forEach((o) => suggested.add(o.id));
  }

  return {
    score: Math.round(Math.min(100, score)),
    perspectives,
    indicators,
    levels,
    leadingShare,
    findings,
    suggestedKpiIds: [...suggested].slice(0, 5),
  };
}
