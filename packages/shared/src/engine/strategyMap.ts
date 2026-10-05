import { PERSPECTIVE_LABEL, PERSPECTIVE_ORDER } from '../taxonomy';
import type { BscPerspective, Finding, IndustryId, ObjectiveLink, StrategicObjective, StrategyMap } from '../types';
import type { KnowledgeBase } from './knowledgeBase';

/** Strategy-map canvas geometry in map units (the mobile canvas scales these). */
export const MAP_GEOMETRY = {
  width: 1000,
  rowHeight: 240,
  topPadding: 70,
  nodeWidth: 210,
  nodeHeight: 92,
};

interface ObjectiveTemplate {
  title: string;
  perspective: BscPerspective;
  themes: string[];
  kpiIds: string[];
}

const TEMPLATES: ObjectiveTemplate[] = [
  { title: 'Grow revenue', perspective: 'financial', themes: ['growth'], kpiIds: ['revenue-growth', 'arpu', 'net-revenue-retention'] },
  { title: 'Improve profitability', perspective: 'financial', themes: ['profitability', 'cost'], kpiIds: ['ebitda-margin', 'opex-to-revenue', 'gross-margin'] },
  { title: 'Increase return on capital', perspective: 'financial', themes: ['value-creation'], kpiIds: ['roic', 'roe', 'capex-intensity'] },
  { title: 'Strengthen cash generation', perspective: 'financial', themes: ['cash'], kpiIds: ['free-cash-flow-conversion', 'cash-conversion-cycle'] },
  { title: 'Improve customer loyalty', perspective: 'customer', themes: ['loyalty'], kpiIds: ['churn-rate', 'nps', 'retention-rate', 'customer-engagement'] },
  { title: 'Deliver a superior customer experience', perspective: 'customer', themes: ['satisfaction'], kpiIds: ['nps', 'csat', 'customer-effort-score'] },
  { title: 'Win profitable new customers', perspective: 'customer', themes: ['acquisition', 'growth'], kpiIds: ['conversion-rate', 'market-share', 'customer-acquisition-cost'] },
  { title: 'Deepen customer relationships', perspective: 'customer', themes: ['engagement'], kpiIds: ['products-per-customer', 'customer-engagement'] },
  { title: 'Improve service quality', perspective: 'internal', themes: ['quality', 'satisfaction', 'loyalty'], kpiIds: ['first-contact-resolution', 'complaint-resolution-time', 'billing-accuracy'] },
  { title: 'Ensure network excellence', perspective: 'internal', themes: ['network'], kpiIds: ['network-availability', 'dropped-call-rate', 'mttr'] },
  { title: 'Drive operational efficiency', perspective: 'internal', themes: ['cost', 'productivity'], kpiIds: ['oee', 'average-handle-time', 'first-pass-yield'] },
  { title: 'Deliver reliably', perspective: 'internal', themes: ['delivery', 'speed'], kpiIds: ['on-time-delivery', 'order-cycle-time', 'inventory-turnover'] },
  { title: 'Accelerate digital channels', perspective: 'internal', themes: ['digital'], kpiIds: ['digital-adoption', 'loan-decision-time'] },
  { title: 'Accelerate innovation', perspective: 'internal', themes: ['innovation'], kpiIds: ['time-to-market', 'new-product-revenue'] },
  { title: 'Optimise procurement', perspective: 'internal', themes: ['supplier'], kpiIds: ['procurement-savings', 'spend-under-management', 'supplier-on-time-delivery'] },
  { title: 'Execute strategic initiatives', perspective: 'internal', themes: ['execution'], kpiIds: ['initiative-delivery'] },
  { title: 'Build critical capabilities', perspective: 'learning', themes: ['talent'], kpiIds: ['skills-coverage', 'training-hours', 'time-to-fill'] },
  { title: 'Engage and retain our people', perspective: 'learning', themes: ['engagement', 'talent'], kpiIds: ['employee-engagement', 'voluntary-turnover'] },
  { title: 'Strengthen data & digital foundations', perspective: 'learning', themes: ['digital'], kpiIds: ['data-quality-index'] },
];

const DEFAULT_THEMES = ['growth', 'profitability', 'loyalty', 'quality', 'talent'];

let idCounter = 0;
export const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${(idCounter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Positions objectives in perspective rows (financial on top), evenly spaced. */
export function layoutObjectives(objectives: StrategicObjective[]): StrategicObjective[] {
  const { width, rowHeight, topPadding, nodeWidth } = MAP_GEOMETRY;
  return PERSPECTIVE_ORDER.flatMap((p, row) => {
    const inRow = objectives.filter((o) => o.perspective === p);
    const gap = width / (inRow.length + 1);
    return inRow.map((o, i) => ({ ...o, x: Math.round(gap * (i + 1) - nodeWidth / 2), y: topPadding + row * rowHeight }));
  });
}

export function perspectiveRowY(p: BscPerspective): number {
  return MAP_GEOMETRY.topPadding + PERSPECTIVE_ORDER.indexOf(p) * MAP_GEOMETRY.rowHeight;
}

/** Generates a draft strategy map (objectives, KPIs, cause-effect links) from strategic themes. */
export function generateStrategyMap(kb: KnowledgeBase, opts: { themes?: string[]; industry?: IndustryId; perPerspective?: number } = {}): StrategyMap {
  const themes = opts.themes?.length ? opts.themes : DEFAULT_THEMES;
  const per = opts.perPerspective ?? 2;
  const fits = (id: string) => {
    const k = kb.get(id);
    return Boolean(k && (!opts.industry || k.industries.includes(opts.industry) || k.industries.includes('cross')));
  };

  const objectives: StrategicObjective[] = [];
  for (const p of PERSPECTIVE_ORDER) {
    const ranked = TEMPLATES.filter((t) => t.perspective === p)
      .map((t, i) => ({ t, score: t.themes.filter((x) => themes.includes(x)).length * 10 + t.kpiIds.filter(fits).length - i * 0.1 }))
      .filter((r) => r.t.kpiIds.some(fits))
      .sort((a, b) => b.score - a.score)
      .slice(0, per);
    for (const { t } of ranked) {
      // Never put a KPI and its inverse (e.g. churn and retention) on the same objective.
      const kpiIds: string[] = [];
      for (const id of t.kpiIds.filter(fits)) {
        const k = kb.get(id)!;
        if (kpiIds.length < 3 && !kpiIds.some((x) => x === k.inverseOf || kb.get(x)?.inverseOf === id)) kpiIds.push(id);
      }
      objectives.push({ id: newId('obj'), title: t.title, perspective: p, kpiIds, x: 0, y: 0 });
    }
  }
  return { objectives: layoutObjectives(objectives), links: inferLinks(kb, objectives) };
}

/** Links objectives bottom-up where their KPIs are causally related; otherwise to the first objective one row up. */
export function inferLinks(kb: KnowledgeBase, objectives: StrategicObjective[]): ObjectiveLink[] {
  const links: ObjectiveLink[] = [];
  for (let row = PERSPECTIVE_ORDER.length - 1; row > 0; row--) {
    const lower = objectives.filter((o) => o.perspective === PERSPECTIVE_ORDER[row]);
    const upper = objectives.filter((o) => o.perspective === PERSPECTIVE_ORDER[row - 1]);
    if (!upper.length) continue;
    for (const lo of lower) {
      const driven = new Set(lo.kpiIds.flatMap((id) => kb.graph.outcomes(id).map((k) => k.id)));
      const targets = upper.filter((up) => up.kpiIds.some((id) => driven.has(id)));
      (targets.length ? targets : [upper[0]]).forEach((up) => links.push({ id: newId('lnk'), from: lo.id, to: up.id }));
    }
    // Every upper objective needs at least one cause beneath it.
    if (!lower.length) continue;
    for (const up of upper) {
      if (links.some((l) => l.to === up.id)) continue;
      const source = lower.find((lo) => lo.kpiIds.some((id) => kb.graph.outcomes(id).some((k) => up.kpiIds.includes(k.id)))) ?? lower[0];
      links.push({ id: newId('lnk'), from: source.id, to: up.id });
    }
  }
  return links;
}

/** Quality checks for a strategy map (used for notifications and the strategy audit). */
export function mapHealth(map: StrategyMap): Finding[] {
  const findings: Finding[] = [];
  const noKpi = map.objectives.filter((o) => o.kpiIds.length === 0);
  if (noKpi.length) findings.push({ severity: 'warning', message: `${noKpi.length} objective${noKpi.length > 1 ? 's have' : ' has'} no KPI.` });
  const linked = new Set(map.links.flatMap((l) => [l.from, l.to]));
  const orphans = map.objectives.filter((o) => !linked.has(o.id));
  if (orphans.length && map.objectives.length > 1) findings.push({ severity: 'info', message: `${orphans.length} objective${orphans.length > 1 ? 's are' : ' is'} not connected to the cause-and-effect chain.` });
  const missing = PERSPECTIVE_ORDER.filter((p) => !map.objectives.some((o) => o.perspective === p));
  if (missing.length && map.objectives.length) findings.push({ severity: 'warning', message: `Missing perspective${missing.length > 1 ? 's' : ''}: ${missing.map((p) => PERSPECTIVE_LABEL[p]).join(', ')}.` });
  const byId = new Map(map.objectives.map((o) => [o.id, o]));
  const backwards = map.links.filter((l) => {
    const a = byId.get(l.from);
    const b = byId.get(l.to);
    return a && b && PERSPECTIVE_ORDER.indexOf(a.perspective) < PERSPECTIVE_ORDER.indexOf(b.perspective);
  });
  if (backwards.length) findings.push({ severity: 'info', message: `${backwards.length} link${backwards.length > 1 ? 's point' : ' points'} downward — cause-and-effect usually flows from Learning up to Financial.` });
  if (!findings.length && map.objectives.length) findings.push({ severity: 'positive', message: 'Map is complete: every objective has KPIs and is connected.' });
  return findings;
}
