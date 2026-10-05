import { KPIS } from '../data/kpis';
import type { Kpi } from '../types';
import { KpiGraph } from './graph';
import { qualityScore } from './quality';
import { KpiIndex } from './search';
import { normalize } from './text';

/** Facade bundling the KPI library with its search index, relationship graph and cached quality scores. */
export class KnowledgeBase {
  readonly kpis: Kpi[];
  readonly byId: Map<string, Kpi>;
  readonly index: KpiIndex;
  readonly graph: KpiGraph;
  private quality = new Map<string, number>();
  private mentionPhrases: { phrase: string; id: string }[];

  constructor(kpis: Kpi[] = KPIS) {
    this.kpis = kpis;
    this.byId = new Map(kpis.map((k) => [k.id, k]));
    this.index = new KpiIndex(kpis);
    this.graph = new KpiGraph(kpis);
    this.mentionPhrases = kpis
      .flatMap((k) => [k.name, k.name.replace(/\s*\(.*?\)\s*/g, ' '), ...(k.aliases ?? [])].map((p) => ({ phrase: normalize(p), id: k.id })))
      .filter((p) => p.phrase.length >= 3);
  }

  get(id: string): Kpi | undefined {
    return this.byId.get(id);
  }

  require(ids: string[]): Kpi[] {
    return ids.map((id) => this.byId.get(id)).filter((k): k is Kpi => Boolean(k));
  }

  qualityOf(id: string): number {
    if (!this.quality.has(id)) {
      const k = this.byId.get(id);
      this.quality.set(id, k ? qualityScore(k).total : 0);
    }
    return this.quality.get(id)!;
  }

  /**
   * Finds KPIs explicitly mentioned in free text, in order of appearance.
   * Longest phrase wins on overlaps ("customer attrition" → churn, not employee turnover).
   */
  findMentions(text: string): Kpi[] {
    const t = ` ${normalize(text)} `;
    const spans: { start: number; end: number; id: string }[] = [];
    for (const { phrase, id } of this.mentionPhrases) {
      let from = 0;
      for (;;) {
        const at = t.indexOf(` ${phrase}`, from);
        if (at < 0) break;
        const end = at + phrase.length + 1;
        // Accept whole-word matches, allowing a plural "s".
        const next = t[end];
        if (next === ' ' || (next === 's' && t[end + 1] === ' ')) spans.push({ start: at + 1, end, id });
        from = at + 1;
      }
    }
    spans.sort((a, b) => b.end - b.start - (a.end - a.start));
    const taken: typeof spans = [];
    for (const s of spans) {
      if (!taken.some((x) => s.start < x.end && x.start < s.end)) taken.push(s);
    }
    taken.sort((a, b) => a.start - b.start);
    const seen = new Set<string>();
    return taken.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true))).map((s) => this.byId.get(s.id)!);
  }
}
