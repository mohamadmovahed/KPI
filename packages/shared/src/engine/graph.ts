import { PERSPECTIVE_ORDER } from '../taxonomy';
import type { Kpi } from '../types';

export interface KpiEdge {
  /** driver (leading) */
  from: string;
  /** outcome (lagging) */
  to: string;
}

/**
 * Cause-and-effect graph across KPIs (driver → outcome), derived from both sides of the
 * declared relationships so data only needs to be curated once.
 */
export class KpiGraph {
  readonly byId: Map<string, Kpi>;
  private out = new Map<string, Set<string>>(); // driver -> outcomes
  private inc = new Map<string, Set<string>>(); // outcome -> drivers

  constructor(kpis: Kpi[]) {
    this.byId = new Map(kpis.map((k) => [k.id, k]));
    const link = (from: string, to: string) => {
      if (!this.byId.has(from) || !this.byId.has(to) || from === to) return;
      if (!this.out.has(from)) this.out.set(from, new Set());
      if (!this.inc.has(to)) this.inc.set(to, new Set());
      this.out.get(from)!.add(to);
      this.inc.get(to)!.add(from);
    };
    for (const k of kpis) {
      k.leadingIds.forEach((d) => link(d, k.id));
      k.laggingIds.forEach((o) => link(k.id, o));
    }
  }

  drivers(id: string): Kpi[] {
    return [...(this.inc.get(id) ?? [])].map((x) => this.byId.get(x)!).sort(byPerspectiveDesc);
  }

  outcomes(id: string): Kpi[] {
    return [...(this.out.get(id) ?? [])].map((x) => this.byId.get(x)!).sort(byPerspectiveAsc);
  }

  edges(): KpiEdge[] {
    const e: KpiEdge[] = [];
    this.out.forEach((tos, from) => tos.forEach((to) => e.push({ from, to })));
    return e;
  }

  /**
   * Local neighbourhood for mobile rendering: never the whole graph.
   * Returns nodes within `depth` hops in either direction (capped per level).
   */
  neighbourhood(id: string, depth = 1, maxPerLevel = 6): { nodes: Kpi[]; edges: KpiEdge[] } {
    const seen = new Set([id]);
    let frontier = [id];
    for (let d = 0; d < depth; d++) {
      const next: string[] = [];
      for (const n of frontier) {
        const around = [...(this.inc.get(n) ?? []), ...(this.out.get(n) ?? [])].filter((x) => !seen.has(x)).slice(0, maxPerLevel);
        around.forEach((x) => {
          seen.add(x);
          next.push(x);
        });
      }
      frontier = next;
    }
    const nodes = [...seen].map((x) => this.byId.get(x)!).filter(Boolean);
    const edges = this.edges().filter((e) => seen.has(e.from) && seen.has(e.to));
    return { nodes, edges };
  }

  /**
   * Longest causal chain from capabilities up to a financial outcome passing through `id`
   * (e.g. Skills → FCR → NPS → Churn → Revenue → ROIC). Used for "how does this create value?".
   */
  valueChain(id: string): Kpi[] {
    const up = this.longestPath(id, (n) => this.out.get(n), new Set());
    const down = this.longestPath(id, (n) => this.inc.get(n), new Set());
    return [...down.reverse(), ...up.slice(1)].map((x) => this.byId.get(x)!);
  }

  private longestPath(start: string, next: (n: string) => Set<string> | undefined, visiting: Set<string>, limit = 6): string[] {
    if (limit === 0) return [start];
    visiting.add(start);
    let best: string[] = [];
    for (const n of next(start) ?? []) {
      if (visiting.has(n)) continue;
      const p = this.longestPath(n, next, visiting, limit - 1);
      if (p.length > best.length) best = p;
    }
    visiting.delete(start);
    return [start, ...best];
  }
}

const rank = (k: Kpi) => PERSPECTIVE_ORDER.indexOf(k.perspective);
const byPerspectiveAsc = (a: Kpi, b: Kpi) => rank(a) - rank(b) || a.name.localeCompare(b.name);
const byPerspectiveDesc = (a: Kpi, b: Kpi) => rank(b) - rank(a) || a.name.localeCompare(b.name);
