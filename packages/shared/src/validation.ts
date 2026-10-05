import { z } from 'zod';

// Runtime schemas for untrusted input: client payloads on the API and LLM output on the server.

const perspective = z.enum(['financial', 'customer', 'internal', 'learning']);
const indicator = z.enum(['leading', 'lagging']);
const industry = z.enum(['cross', 'telecom', 'banking', 'insurance', 'manufacturing', 'retail', 'saas', 'healthcare', 'energy', 'logistics', 'public', 'holding']);
const severity = z.enum(['info', 'warning', 'critical', 'positive']);
const id = z.string().min(1).max(80);
const text = (max: number) => z.string().max(max);

export const objectiveSchema = z.object({
  id,
  title: text(160).min(1),
  perspective,
  description: text(1000).optional(),
  kpiIds: z.array(id).max(30),
  x: z.number().finite(),
  y: z.number().finite(),
});

export const strategyMapSchema = z.object({
  objectives: z.array(objectiveSchema).max(80),
  links: z.array(z.object({ id, from: id, to: id })).max(300),
});

export const projectSchema = z.object({
  id,
  name: text(160).min(1),
  client: text(160).optional(),
  industry: industry.optional(),
  horizon: text(60).optional(),
  strategyStatement: text(2000).optional(),
  description: text(4000).optional(),
  kpis: z
    .array(
      z.object({
        kpiId: id,
        baseline: text(60).optional(),
        target: text(60).optional(),
        owner: text(120).optional(),
        note: text(1000).optional(),
        addedAt: z.string(),
      }),
    )
    .max(200),
  map: strategyMapSchema,
  initiatives: z
    .array(z.object({ id, title: text(200).min(1), objectiveId: id.optional(), owner: text(120).optional(), status: z.enum(['planned', 'active', 'done', 'at-risk']) }))
    .max(200),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const collectionSchema = z.object({
  id,
  name: text(120).min(1),
  kpiIds: z.array(id).max(500),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const driverNode: z.ZodType<{ id: string; label: string; kpiId?: string; children: unknown[] }> = z.lazy(() =>
  z.object({ id: z.string(), label: z.string(), kpiId: z.string().optional(), children: z.array(driverNode) }),
);

/** Cards an LLM is allowed to emit. Structural cards (balance, map) are only produced by the engine. */
export const llmCardSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('recommendation'), title: z.string(), kpiId: z.string(), why: z.string(), indicator, complementIds: z.array(z.string()).max(5) }),
  z.object({ kind: z.literal('insight'), title: z.string(), body: z.string(), severity: severity.optional() }),
  z.object({ kind: z.literal('checklist'), title: z.string(), items: z.array(z.string()).max(12) }),
  z.object({ kind: z.literal('kpi-list'), title: z.string(), kpiIds: z.array(z.string()).max(12), note: z.string().optional() }),
  z.object({ kind: z.literal('driver-tree'), title: z.string(), tree: driverNode }),
]);

export const llmResponseSchema = z.object({
  summary: z.string(),
  cards: z.array(llmCardSchema).max(10),
  followUps: z.array(z.string()).max(4),
});

export type ProjectInput = z.infer<typeof projectSchema>;
