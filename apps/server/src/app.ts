import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import { KnowledgeBase } from '@kpi/shared';
import { config as defaultConfig, type Config } from './config';
import { AiOrchestrator } from './ai/orchestrator';
import { HttpError, type AppContext } from './lib/context';
import { hashPassword } from './lib/crypto';
import { newId } from './lib/ids';
import { Store } from './store/store';
import { registerAuthRoutes } from './routes/auth';
import { registerKpiRoutes } from './routes/kpis';
import { registerAiRoutes } from './routes/ai';
import { registerProjectRoutes } from './routes/projects';
import { registerAdminRoutes } from './routes/admin';

export interface BuildOptions {
  config?: Partial<Config>;
  store?: Store;
  ai?: AiOrchestrator;
  logger?: boolean;
}

export async function buildApp(opts: BuildOptions = {}) {
  const config = { ...defaultConfig, ...opts.config };
  const app = Fastify({
    logger: opts.logger
      ? {
          level: config.isProd ? 'info' : 'debug',
          // Never log credentials or bodies (may contain confidential strategy content).
          redact: ['req.headers.authorization', 'req.headers.cookie'],
        }
      : false,
    bodyLimit: 1024 * 1024,
    trustProxy: true,
  });

  const store = opts.store ?? new Store(config.dataDir);
  const kb = new KnowledgeBase();
  const ai = opts.ai ?? new AiOrchestrator(kb, { apiKey: config.anthropicApiKey, model: config.anthropicModel, log: (m, e) => app.log.warn({ err: e }, m) });
  const ctx: AppContext = {
    config,
    store,
    kb,
    ai,
    audit: (entry) => {
      store.data.audit.push({ id: newId('aud'), at: new Date().toISOString(), ...entry });
      if (store.data.audit.length > 10_000) store.data.audit.splice(0, store.data.audit.length - 10_000);
      store.save();
    },
  };

  await app.register(helmet);
  await app.register(cors, { origin: config.corsOrigins.length ? config.corsOrigins : false });
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  await app.register(multipart);

  app.setErrorHandler((err: FastifyError | Error, req, reply) => {
    if (err instanceof ZodError) return reply.code(400).send({ error: 'Invalid request', issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
    if (err instanceof HttpError) return reply.code(err.statusCode).send({ error: err.message });
    const status = (err as FastifyError).statusCode;
    if (status && status < 500) return reply.code(status).send({ error: err.message });
    req.log.error({ err }, 'Unhandled error');
    return reply.code(500).send({ error: 'Internal server error' });
  });

  app.get('/health', async () => ({ ok: true, llm: ai.llmEnabled, kpis: kb.kpis.length }));

  await registerAuthRoutes(app, ctx);
  await registerKpiRoutes(app, ctx);
  await registerAiRoutes(app, ctx);
  await registerProjectRoutes(app, ctx);
  await registerAdminRoutes(app, ctx);

  if (config.seedDemoUser && !store.data.users.some((u) => u.email === 'demo@kpi.app')) {
    const now = new Date().toISOString();
    const org = { id: newId('org'), name: 'Demo Consulting', createdAt: now };
    store.data.orgs.push(org);
    store.data.users.push({ id: newId('usr'), email: 'demo@kpi.app', name: 'Alex Morgan', role: 'admin', orgId: org.id, passwordHash: await hashPassword('demo1234'), createdAt: now });
    store.save();
  }

  app.addHook('onClose', async () => store.flush());
  return { app, ctx };
}
