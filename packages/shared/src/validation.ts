import { z } from 'zod';

// Runtime schemas for untrusted input, e.g. backup files restored into the app.

const perspective = z.enum(['financial', 'customer', 'internal', 'learning']);
const industry = z.enum(['cross', 'telecom', 'banking', 'insurance', 'manufacturing', 'retail', 'saas', 'healthcare', 'energy', 'logistics', 'public', 'holding']);
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

export type ProjectInput = z.infer<typeof projectSchema>;

/** Local backup file written and read by the mobile app (Settings → Backup). */
export const backupSchema = z.object({
  app: z.literal('kpi-consultant'),
  version: z.literal(1),
  exportedAt: z.string(),
  projects: z.array(projectSchema),
  collections: z.array(collectionSchema).default([]),
  savedIds: z.array(z.string().max(80)).max(1000).default([]),
});
