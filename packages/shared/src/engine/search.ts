import { FUNCTION_LABEL, INDUSTRY_LABEL } from '../taxonomy';
import type { Kpi, KpiFilters, QueryInterpretation, SearchHit, SearchResult } from '../types';
import { interpretQuery, normalize, stem, stems } from './text';

interface IndexedKpi {
  kpi: Kpi;
  nameNorm: string;
  aliasNorms: string[];
  nameStems: Set<string>;
  aliasStems: Set<string>;
  bodyStems: Set<string>;
  themeSet: Set<string>;
  /** Themes of outcomes this KPI drives directly — lets "leading indicators of profitability" find drivers. */
  themes1: Set<string>;
  /** Themes of outcomes two hops away. */
  themes2: Set<string>;
  /** Number of relationships; used as a tie-breaker (well-connected KPIs first). */
  centrality: number;
}

export interface SearchOptions {
  filters?: KpiFilters;
  limit?: number;
  offset?: number;
}

const inAny = <T>(values: T[], wanted?: T[]) => !wanted || wanted.length === 0 || values.some((v) => wanted.includes(v));

export function matchesFilters(kpi: Kpi, f: KpiFilters = {}): boolean {
  return (
    // Cross-industry KPIs remain visible under any industry filter.
    (!f.industries?.length || kpi.industries.includes('cross') || inAny(kpi.industries, f.industries)) &&
    inAny(kpi.functions, f.functions) &&
    inAny(kpi.levels, f.levels) &&
    inAny([kpi.perspective], f.perspectives) &&
    inAny([kpi.indicator], f.indicators) &&
    inAny([kpi.kpiType], f.kpiTypes)
  );
}

/**
 * In-memory KPI index with IDF-weighted term matching, theme matching (direct and inherited
 * through the cause-and-effect model) and entity boosts. A single linear pass over precomputed
 * sets keeps it fast on device into the tens of thousands of KPIs. The API can swap in Postgres
 * full-text + pgvector semantic search behind the same `SearchResult` contract.
 */
export class KpiIndex {
  private docs: IndexedKpi[];
  private idf = new Map<string, number>();

  constructor(kpis: Kpi[]) {
    const byId = new Map(kpis.map((k) => [k.id, k]));
    const outcomes = new Map<string, Set<string>>();
    const degree = new Map<string, number>();
    const link = (from: string, to: string) => {
      if (!byId.has(from) || !byId.has(to) || from === to) return;
      if (!outcomes.has(from)) outcomes.set(from, new Set());
      if (outcomes.get(from)!.has(to)) return;
      outcomes.get(from)!.add(to);
      degree.set(from, (degree.get(from) ?? 0) + 1);
      degree.set(to, (degree.get(to) ?? 0) + 1);
    };
    kpis.forEach((k) => {
      k.leadingIds.forEach((d) => link(d, k.id));
      k.laggingIds.forEach((o) => link(k.id, o));
    });
    const themesAt = (id: string) => {
      const t1 = new Set<string>();
      const t2 = new Set<string>();
      for (const o1 of outcomes.get(id) ?? []) {
        byId.get(o1)!.themes.forEach((t) => t1.add(t));
        for (const o2 of outcomes.get(o1) ?? []) byId.get(o2)!.themes.forEach((t) => t2.add(t));
      }
      return { t1, t2 };
    };

    this.docs = kpis.map((kpi) => {
      const { t1, t2 } = themesAt(kpi.id);
      return {
        kpi,
        nameNorm: normalize(kpi.name),
        aliasNorms: (kpi.aliases ?? []).map(normalize),
        nameStems: new Set(stems(kpi.name)),
        aliasStems: new Set((kpi.aliases ?? []).flatMap(stems)),
        bodyStems: new Set(
          stems(
            [
              kpi.shortDefinition,
              kpi.purpose,
              kpi.formula,
              kpi.drivers.join(' '),
              kpi.functions.map((f) => FUNCTION_LABEL[f]).join(' '),
              kpi.industries.map((i) => INDUSTRY_LABEL[i]).join(' '),
            ].join(' '),
          ),
        ),
        themeSet: new Set(kpi.themes),
        themes1: t1,
        themes2: t2,
        centrality: degree.get(kpi.id) ?? 0,
      };
    });

    // Inverse document frequency: generic words ("customer", "rate") weigh less than specific ones ("churn").
    const df = new Map<string, number>();
    for (const d of this.docs) {
      for (const s of new Set([...d.nameStems, ...d.aliasStems, ...d.bodyStems])) df.set(s, (df.get(s) ?? 0) + 1);
    }
    const n = this.docs.length;
    df.forEach((count, s) => this.idf.set(s, Math.log(1 + n / count)));
  }

  get size() {
    return this.docs.length;
  }

  private termWeight(s: string): number {
    const idf = this.idf.get(s) ?? Math.log(1 + this.docs.length);
    // Superlinear so very common words contribute little while rare, specific words dominate.
    return Math.min(1.5, (idf / 2.2) ** 1.5);
  }

  search(query: string, opts: SearchOptions = {}): SearchResult {
    const interpretation = interpretQuery(query);
    const q = normalize(query);
    const { filters = {}, limit = 50, offset = 0 } = opts;

    // Entities detected in the query act as hard filters for structural attributes
    // (level, indicator, perspective) and as boosts for industry/function.
    const effective: KpiFilters = {
      ...filters,
      levels: filters.levels?.length ? filters.levels : interpretation.levels,
      indicators: filters.indicators?.length ? filters.indicators : interpretation.indicators,
      perspectives: filters.perspectives?.length ? filters.perspectives : interpretation.perspectives,
    };

    const terms = interpretation.terms.map((t) => {
      const s = stem(t);
      return { s, w: this.termWeight(s) };
    });
    const hasContent = terms.length > 0 || interpretation.themes.length > 0;
    const hasEntities = interpretation.industries.length > 0 || interpretation.functions.length > 0;

    const hits: (SearchHit & { c: number })[] = [];
    for (const d of this.docs) {
      if (!matchesFilters(d.kpi, effective)) continue;
      const { score, matched } = scoreDoc(d, q, terms, interpretation);
      if (q && (hasContent || hasEntities) && score <= 0) continue;
      hits.push({ kpi: d.kpi, score: q ? Math.round(score * 10) / 10 : 0, matched, c: d.centrality });
    }

    hits.sort((a, b) => b.score - a.score || b.c - a.c || a.kpi.name.localeCompare(b.kpi.name));
    return {
      hits: hits.slice(offset, offset + limit).map(({ c: _c, ...h }) => h),
      total: hits.length,
      interpretation,
    };
  }
}

function scoreDoc(d: IndexedKpi, q: string, terms: { s: string; w: number }[], it: QueryInterpretation) {
  let score = 0;
  const matched: string[] = [];

  if (q.length > 2) {
    if (d.nameNorm === q || d.aliasNorms.includes(q)) {
      score += 60;
      matched.push('exact name');
    } else if (d.nameNorm.includes(q) || d.aliasNorms.some((a) => a.length >= 3 && q.includes(a))) {
      score += 30;
      matched.push('name');
    }
  }

  let termHits = 0;
  for (const { s, w } of terms) {
    if (d.nameStems.has(s)) score += 9 * w;
    else if (d.aliasStems.has(s)) score += 7 * w;
    else if (d.bodyStems.has(s)) score += 2.5 * w;
    else continue;
    termHits++;
  }
  if (termHits) matched.push(`${termHits} term${termHits > 1 ? 's' : ''}`);

  for (const theme of it.themes) {
    if (d.themeSet.has(theme)) {
      score += 8;
      matched.push(theme);
    } else if (d.themes1.has(theme)) {
      score += 5;
      matched.push(`drives ${theme}`);
    } else if (d.themes2.has(theme)) {
      score += 2;
    }
  }

  if (it.industries.length) {
    if (it.industries.some((i) => d.kpi.industries.includes(i))) {
      score += 6;
      matched.push('industry');
    } else if (d.kpi.industries.includes('cross')) score += 4;
    else score -= 6;
  }
  if (it.functions.length) {
    if (it.functions.some((f) => d.kpi.functions.includes(f))) {
      score += 5;
      matched.push('function');
    } else score -= 1;
  }
  return { score, matched };
}

let defaultIndex: KpiIndex | undefined;
let defaultIndexSource: Kpi[] | undefined;

/** Convenience wrapper with a memoised index per KPI array. */
export function searchKpis(kpis: Kpi[], query: string, opts: SearchOptions = {}): SearchResult {
  if (!defaultIndex || defaultIndexSource !== kpis) {
    defaultIndex = new KpiIndex(kpis);
    defaultIndexSource = kpis;
  }
  return defaultIndex.search(query, opts);
}
