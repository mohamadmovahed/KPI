import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { INDUSTRIES, type AiContext } from '@kpi/shared';
import { assertProjectAccess, HttpError, makeAuthHooks, type AppContext } from '../lib/context';
import { AiUnavailableError, type DocumentMediaType } from '../ai/orchestrator';

const ALLOWED_MEDIA: DocumentMediaType[] = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

const chatBody = z.object({
  message: z.string().min(1).max(2000),
  context: z
    .object({
      industry: z.enum(INDUSTRIES.map((i) => i.id) as [string, ...string[]]).optional(),
      projectId: z.string().max(80).optional(),
      kpiIds: z.array(z.string().max(80)).max(100).optional(),
      projectName: z.string().max(160).optional(),
    })
    .default({}),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(4000) })).max(12).default([]),
});

export async function registerAiRoutes(app: FastifyInstance, ctx: AppContext) {
  const { authenticate } = makeAuthHooks(ctx);
  const limited = { preHandler: authenticate, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } };

  app.post('/v1/ai/chat', limited, async (req) => {
    const body = chatBody.parse(req.body);
    const context = { ...body.context } as AiContext;
    // A server-synced project overrides client-provided KPI scope (and enforces permissions).
    if (context.projectId && ctx.store.data.projects.some((p) => p.id === context.projectId)) {
      const project = assertProjectAccess(ctx, req.user!.sub, req.user!.org, context.projectId, 'viewer');
      context.kpiIds = project.kpis.map((k) => k.kpiId);
      context.projectName = project.name;
      context.industry = context.industry ?? project.industry;
    }
    const response = await ctx.ai.chat(body.message, context, body.history);
    // Audit intent only — never the prompt text, which may be confidential.
    ctx.audit({ userId: req.user!.sub, orgId: req.user!.org, action: 'ai.chat', meta: { intent: response.intent, engine: response.engine } });
    return response;
  });

  app.post('/v1/ai/documents', { ...limited, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req) => {
    const file = await req.file({ limits: { fileSize: ctx.config.maxUploadBytes, files: 1 } });
    if (!file) throw new HttpError(400, 'No file uploaded');
    const mediaType = file.mimetype as DocumentMediaType;
    if (!ALLOWED_MEDIA.includes(mediaType)) throw new HttpError(415, 'Unsupported file type. Use JPEG, PNG, WebP, GIF or PDF.');
    const buffer = await file.toBuffer();
    try {
      const result = await ctx.ai.analyzeDocument(buffer, mediaType);
      ctx.audit({ userId: req.user!.sub, orgId: req.user!.org, action: 'ai.document', meta: { found: result.found, mediaType } });
      return result;
    } catch (err) {
      if (err instanceof AiUnavailableError) throw new HttpError(503, err.message);
      throw err;
    }
  });

  app.get('/v1/ai/status', async () => ({ llm: ctx.ai.llmEnabled, voice: 'client', documents: ctx.ai.llmEnabled }));
}
