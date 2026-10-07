import type { BscPerspective, Direction, Frequency, FunctionId, IndustryId, Kpi, KpiLevel, KpiType, Unit } from '../../types';

/**
 * Compact authoring format for library-tier KPIs. Every entry is written in our own words.
 * Relationships (`lead` = KPIs that drive this one, `lag` = outcomes this one drives) may point at
 * core or library KPIs; dataset tests verify every reference.
 */
export interface LibraryEntry {
  id: string;
  /** Name */
  n: string;
  /** Short definition */
  d: string;
  /** Why it matters (purpose) */
  w: string;
  /** Formula */
  f: string;
  /** Worked example */
  ex?: string;
  u: Unit;
  dir: 'h' | 'l' | 't';
  /** BSC perspective: financial, customer, internal, learning */
  p: 'f' | 'c' | 'i' | 'l';
  i: 'lead' | 'lag';
  /** Levels as letters: c = corporate, f = functional, o = operational */
  lv: string;
  /** KPI type: o outcome, x output, p process, i input, q quality, e efficiency, r risk */
  k: 'o' | 'x' | 'p' | 'i' | 'q' | 'e' | 'r';
  fn: FunctionId[];
  ind: IndustryId[];
  t: string[];
  fq?: Frequency;
  lead?: string[];
  lag?: string[];
  a?: string[];
  inv?: string;
  /** Source ids (defaults to editorial). */
  s?: string[];
  /** Optional one-line gaming risk. */
  g?: string;
}

const PERSPECTIVE: Record<LibraryEntry['p'], BscPerspective> = { f: 'financial', c: 'customer', i: 'internal', l: 'learning' };
const DIRECTION: Record<LibraryEntry['dir'], Direction> = { h: 'higher', l: 'lower', t: 'target' };
const LEVEL: Record<string, KpiLevel> = { c: 'corporate', f: 'functional', o: 'operational' };
const TYPE: Record<LibraryEntry['k'], KpiType> = { o: 'outcome', x: 'output', p: 'process', i: 'input', q: 'quality', e: 'efficiency', r: 'risk' };

export function lib(e: LibraryEntry): Kpi {
  return {
    id: e.id,
    tier: 'library',
    name: e.n,
    aliases: e.a ?? [],
    shortDefinition: e.d,
    purpose: e.w,
    formula: e.f,
    formulaExample: e.ex,
    unit: e.u,
    direction: DIRECTION[e.dir],
    frequency: e.fq ?? 'monthly',
    levels: [...e.lv].map((c) => LEVEL[c]),
    perspective: PERSPECTIVE[e.p],
    indicator: e.i === 'lead' ? 'leading' : 'lagging',
    kpiType: TYPE[e.k],
    functions: e.fn,
    industries: e.ind,
    themes: e.t,
    leadingIds: e.lead ?? [],
    laggingIds: e.lag ?? [],
    inverseOf: e.inv,
    drivers: [],
    tradeoffs: [],
    gamingRisks: e.g ? [e.g] : [],
    dataRequirements: [],
    dataSources: [],
    benchmarks: [],
    sourceIds: e.s ?? ['editorial'],
  };
}
