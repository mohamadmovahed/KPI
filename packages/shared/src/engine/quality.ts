import { SOURCE_BY_ID } from '../data/sources';
import type { Kpi, QualityScore } from '../types';

/**
 * KPI Quality Score (0–100). Transparent, rule-based assessment of how "decision-ready" a KPI
 * definition is — not how good the business performance is.
 *
 * Criteria (max points):
 *  - Definition clarity (20): definition, purpose and an explicit formula with a worked example.
 *  - Measurability (20): defined unit, direction, frequency and concrete data requirements/sources.
 *  - Strategic linkage (20): BSC perspective + links to drivers/outcomes in the relationship model.
 *  - Actionability (15): known drivers that management can influence.
 *  - Robustness (15): gaming risks and trade-offs identified (awareness is a strength).
 *  - Evidence (10): backed by reliable sources and benchmarks.
 */
export function qualityScore(kpi: Kpi): QualityScore {
  const breakdown: QualityScore['breakdown'] = [];
  const add = (criterion: string, score: number, max: number, note: string) =>
    breakdown.push({ criterion, score: Math.max(0, Math.min(max, Math.round(score))), max, note });

  // Definition clarity
  let clarity = 0;
  if (kpi.shortDefinition.length > 25) clarity += 6;
  if (kpi.purpose.length > 25) clarity += 4;
  if (/[/×x*÷−\-+Σ]/.test(kpi.formula)) clarity += 6;
  if (kpi.formulaExample) clarity += 4;
  add('Definition clarity', clarity, 20, kpi.formulaExample ? 'Formula with worked example' : 'Add a worked example');

  // Measurability
  let measurability = 6; // unit, direction, frequency are mandatory fields
  measurability += Math.min(8, kpi.dataRequirements.length * 3);
  measurability += Math.min(6, kpi.dataSources.length * 3);
  add('Measurability', measurability, 20, `${kpi.dataRequirements.length} data requirements, ${kpi.dataSources.length} typical sources`);

  // Strategic linkage
  const links = kpi.leadingIds.length + kpi.laggingIds.length;
  add('Strategic linkage', 8 + Math.min(12, links * 3), 20, `${links} explicit relationships in the KPI model`);

  // Actionability
  add('Actionability', Math.min(15, kpi.drivers.length * 3.5), 15, `${kpi.drivers.length} controllable drivers identified`);

  // Robustness
  const robustness = Math.min(9, kpi.gamingRisks.length * 4) + Math.min(6, kpi.tradeoffs.length * 3);
  add('Robustness', robustness, 15, `${kpi.gamingRisks.length} gaming risks, ${kpi.tradeoffs.length} trade-offs documented`);

  // Evidence
  const reliabilities = kpi.sourceIds.map((id) => SOURCE_BY_ID[id]?.reliability ?? 0);
  const best = reliabilities.length ? Math.max(...reliabilities) : 0;
  const evidence = best * 1.4 + (kpi.benchmarks.length ? 3 : 0);
  add('Evidence', evidence, 10, kpi.benchmarks.length ? 'Sources and benchmark orientation available' : 'No benchmark yet');

  return { total: breakdown.reduce((s, b) => s + b.score, 0), breakdown };
}
