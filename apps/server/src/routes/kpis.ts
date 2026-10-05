import type { FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  diagnose,
  FUNCTIONS,
  INDICATORS,
  INDUSTRIES,
  KPI_TYPES,
  LEVELS,
  PERSPECTIVES,
  qualityScore,
  recommendKpis,
  SOURCE_BY_ID,
  SOURCES,
  type KpiFilters,
} from '@kpi/shared';
import { HttpError, type AppContext } from '../lib/context';

const csv = z
  .string()
  .max(500)
  .optional()
  .transform((s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : undefined));

const searchQuery = z.object({
  q: z.string().max(300).default(''),
  industries: csv,
  functions: csv,
  levels: csv,
  perspectives: csv,
  indicators: csv,
  kpiTypes: csv,
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function registerKpiRoutes(app: FastifyInstance, ctx: AppContext) {
  const { kb } = ctx;
  // Version of the knowledge base, so clients only re-download when it changes.
  const datasetVersion = createHash('sha256').update(JSON.stringify(kb.kpis)).digest('hex').slice(0, 16);

  app.get('/v1/taxonomy', async () => ({
    industries: INDUSTRIES.map(({ id, label }) => ({ id, label })),
    functions: FUNCTIONS.map(({ id, label }) => ({ id, label })),
    levels: LEVELS.map(({ id, label }) => ({ id, label })),
    perspectives: PERSPECTIVES.map(({ id, label }) => ({ id, label })),
    indicators: INDICATORS.map(({ id, label }) => ({ id, label })),
    kpiTypes: KPI_TYPES.map(({ id, label }) => ({ id, label })),
  }));

  /** Full dataset for offline caching on the device (conditional on version). */
  app.get('/v1/kpis/sync', async (req, reply) => {
    const { version } = z.object({ version: z.string().max(64).optional() }).parse(req.query);
    if (version === datasetVersion) return reply.code(204).send();
    reply.header('cache-control', 'private, max-age=3600');
    return { version: datasetVersion, kpis: kb.kpis, sources: SOURCES };
  });

  app.get('/v1/kpis', async (req) => {
    const q = searchQuery.parse(req.query);
    const filters = { industries: q.industries, functions: q.functions, levels: q.levels, perspectives: q.perspectives, indicators: q.indicators, kpiTypes: q.kpiTypes } as KpiFilters;
    const res = kb.index.search(q.q, { filters, limit: q.limit, offset: q.offset });
    return {
      total: res.total,
      interpretation: res.interpretation,
      hits: res.hits.map((h) => ({ kpi: h.kpi, score: h.score, matched: h.matched, quality: kb.qualityOf(h.kpi.id) })),
    };
  });

  app.get('/v1/kpis/:id', async (req) => {
    const { id } = z.object({ id: z.string().max(80) }).parse(req.params);
    const kpi = kb.get(id);
    if (!kpi) throw new HttpError(404, 'KPI not found');
    return {
      kpi,
      quality: qualityScore(kpi),
      drivers: kb.graph.drivers(id).map((k) => k.id),
      outcomes: kb.graph.outcomes(id).map((k) => k.id),
      valueChain: kb.graph.valueChain(id).map((k) => k.id),
      sources: kpi.sourceIds.map((s) => SOURCE_BY_ID[s]).filter(Boolean),
    };
  });

  app.get('/v1/kpis/:id/graph', async (req) => {
    const { id } = z.object({ id: z.string().max(80) }).parse(req.params);
    const { depth } = z.object({ depth: z.coerce.number().int().min(1).max(3).default(1) }).parse(req.query);
    if (!kb.get(id)) throw new HttpError(404, 'KPI not found');
    const n = kb.graph.neighbourhood(id, depth, 8);
    return { nodes: n.nodes.map((k) => ({ id: k.id, name: k.name, indicator: k.indicator, perspective: k.perspective })), edges: n.edges };
  });

  app.post('/v1/kpis/compare', async (req) => {
    const { ids } = z.object({ ids: z.array(z.string().max(80)).min(2).max(4) }).parse(req.body);
    const kpis = kb.require(ids);
    if (kpis.length < 2) throw new HttpError(404, 'KPIs not found');
    return { kpis: kpis.map((k) => ({ kpi: k, quality: kb.qualityOf(k.id) })) };
  });

  app.get('/v1/sources', async () => ({ sources: SOURCES }));

  app.post('/v1/recommendations', async (req) => {
    const body = z
      .object({ query: z.string().min(2).max(500), industry: z.enum(INDUSTRIES.map((i) => i.id) as [string, ...string[]]).optional(), count: z.number().int().min(3).max(12).optional() })
      .parse(req.body);
    const res = recommendKpis(kb.index, kb.graph, body as Parameters<typeof recommendKpis>[2]);
    return res;
  });

  app.post('/v1/diagnostics', async (req) => {
    const body = z.object({ kpiId: z.string().max(80), from: z.number().finite().optional(), to: z.number().finite().optional() }).parse(req.body);
    const kpi = kb.get(body.kpiId);
    if (!kpi) throw new HttpError(404, 'KPI not found');
    return diagnose(kpi, kb.graph, body);
  });
}
