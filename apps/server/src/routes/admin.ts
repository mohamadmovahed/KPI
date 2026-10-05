import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { KPIS, qualityScore } from '@kpi/shared';
import { makeAuthHooks, type AppContext } from '../lib/context';
import { toPublicUser } from './auth';

/**
 * Admin API — backend for the optional web admin interface (KPI database, sources, users, audit).
 * Organisation-scoped and restricted to the `admin` role.
 */
export async function registerAdminRoutes(app: FastifyInstance, ctx: AppContext) {
  const { requireRole } = makeAuthHooks(ctx);
  const admin = { preHandler: requireRole('admin') };

  app.get('/v1/admin/users', admin, async (req) => ({
    users: ctx.store.data.users.filter((u) => u.orgId === req.user!.org).map(toPublicUser),
  }));

  app.patch('/v1/admin/users/:id', admin, async (req, reply) => {
    const { id } = z.object({ id: z.string().max(80) }).parse(req.params);
    const { role } = z.object({ role: z.enum(['admin', 'consultant', 'viewer']) }).parse(req.body);
    const user = ctx.store.data.users.find((u) => u.id === id && u.orgId === req.user!.org);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    user.role = role;
    ctx.audit({ userId: req.user!.sub, orgId: req.user!.org, action: 'admin.user_role', target: id, meta: { role } });
    ctx.store.save();
    return { user: toPublicUser(user) };
  });

  app.get('/v1/admin/audit', admin, async (req) => {
    const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) }).parse(req.query);
    return { entries: ctx.store.data.audit.filter((a) => a.orgId === req.user!.org).slice(-limit).reverse() };
  });

  /** Knowledge-base quality report: lowest-quality KPI definitions first (editorial work queue). */
  app.get('/v1/admin/kpis/quality', admin, async () => ({
    kpis: KPIS.map((k) => ({ id: k.id, name: k.name, quality: qualityScore(k).total })).sort((a, b) => a.quality - b.quality),
  }));
}
