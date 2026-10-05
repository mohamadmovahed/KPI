import { INDICATOR_LABEL, PERSPECTIVE_LABEL } from '../taxonomy';
import type { IndustryId, Kpi, QueryInterpretation, Recommendation } from '../types';
import type { KpiGraph } from './graph';
import { KpiIndex } from './search';

export interface RecommendInput {
  query: string;
  industry?: IndustryId;
  count?: number;
}

export interface RecommendOutput {
  recommendations: Recommendation[];
  interpretation: QueryInterpretation;
}

/**
 * Builds a balanced KPI set for an objective: outcome (lagging) KPIs that define success plus
 * the leading indicators that drive them, connected through the relationship graph.
 */
export function recommendKpis(index: KpiIndex, graph: KpiGraph, input: RecommendInput): RecommendOutput {
  const count = Math.max(3, Math.min(input.count ?? 6, 12));
  const result = index.search(input.query, {
    filters: input.industry ? { industries: [input.industry] } : undefined,
    limit: 40,
  });
  const candidates = result.hits.map((h) => h.kpi);
  const industry = input.industry ?? result.interpretation.industries[0];

  const outcomeTarget = Math.max(1, Math.round(count * 0.4));
  const chosen = new Map<string, Kpi>();
  for (const k of candidates) {
    if (chosen.size >= outcomeTarget) break;
    if (k.indicator === 'lagging' && !isInverseOfChosen(k, chosen)) chosen.set(k.id, k);
  }
  const outcomes = [...chosen.values()];

  // Leading indicators: prefer graph drivers of the chosen outcomes that also matched the query,
  // then other matching leading KPIs, then any graph driver (industry-appropriate).
  const driverPool = outcomes.flatMap((o) => graph.drivers(o.id)).filter((d) => d.indicator === 'leading' && fitsIndustry(d, industry));
  // Drivers that move several of the chosen outcomes rank higher than single-link drivers.
  const driverStrength = new Map<string, number>();
  driverPool.forEach((d) => driverStrength.set(d.id, (driverStrength.get(d.id) ?? 0) + 1));
  const scoreOf = new Map(result.hits.map((h) => [h.kpi.id, h.score]));
  const strongDrivers = candidates
    .filter((k) => k.indicator === 'leading' && driverStrength.has(k.id))
    .sort((a, b) => scoreOf.get(b.id)! + 6 * driverStrength.get(b.id)! - (scoreOf.get(a.id)! + 6 * driverStrength.get(a.id)!));
  const ranked = [
    ...strongDrivers,
    ...candidates.filter((k) => k.indicator === 'leading'),
    ...driverPool,
  ];
  for (const k of ranked) {
    if (chosen.size >= count) break;
    if (!chosen.has(k.id) && !isInverseOfChosen(k, chosen)) chosen.set(k.id, k);
  }
  // Top up with remaining candidates if still short.
  for (const k of candidates) {
    if (chosen.size >= count) break;
    if (!chosen.has(k.id) && !isInverseOfChosen(k, chosen)) chosen.set(k.id, k);
  }

  const chosenIds = new Set(chosen.keys());
  const recommendations: Recommendation[] = [...chosen.values()].map((k) => {
    const role = k.indicator === 'lagging' ? 'outcome' : 'driver';
    const related = role === 'outcome' ? graph.drivers(k.id) : graph.outcomes(k.id);
    const complementIds = [
      ...related.filter((r) => chosenIds.has(r.id)),
      ...related.filter((r) => !chosenIds.has(r.id) && fitsIndustry(r, industry)),
    ]
      .slice(0, 3)
      .map((r) => r.id);
    return { kpiId: k.id, role, rationale: rationale(k, role, related), complementIds };
  });

  return { recommendations, interpretation: result.interpretation };
}

const fitsIndustry = (k: Kpi, industry?: IndustryId) => !industry || k.industries.includes(industry) || k.industries.includes('cross');

const isInverseOfChosen = (k: Kpi, chosen: Map<string, Kpi>) =>
  (k.inverseOf && chosen.has(k.inverseOf)) || [...chosen.values()].some((c) => c.inverseOf === k.id);

function rationale(k: Kpi, role: 'outcome' | 'driver', related: Kpi[]): string {
  const base = k.purpose.replace(/\.$/, '');
  if (role === 'outcome') {
    return `${base}. ${INDICATOR_LABEL[k.indicator]} ${PERSPECTIVE_LABEL[k.perspective].toLowerCase()} outcome — defines what success looks like.`;
  }
  const moves = related.slice(0, 2).map((r) => r.name);
  return `${base}.${moves.length ? ` Moves before ${moves.join(' and ')}, so it gives early warning.` : ''}`;
}
