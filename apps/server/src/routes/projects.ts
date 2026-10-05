import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  analyzeBalance,
  buildExecutiveSummary,
  collectionSchema,
  projectSchema,
  type AppNotification,
  type Project,
} from '@kpi/shared';
import { assertProjectAccess, HttpError, makeAuthHooks, type AppContext } from '../lib/context';

const idParam = z.object({ id: z.string().min(1).max(80) });

export async function registerProjectRoutes(app: FastifyInstance, ctx: AppContext) {
  const { authenticate } = makeAuthHooks(ctx);
  const auth = { preHandler: authenticate };
  const { store, kb } = ctx;

  app.get('/v1/projects', auth, async (req) => {
    const mine = new Set(store.data.members.filter((m) => m.userId === req.user!.sub).map((m) => m.projectId));
    return { projects: store.data.projects.filter((p) => mine.has(p.id) && p.orgId === req.user!.org) };
  });

  app.get('/v1/projects/:id', auth, async (req) => {
    const { id } = idParam.parse(req.params);
    return { project: assertProjectAccess(ctx, req.user!.sub, req.user!.org, id, 'viewer') };
  });

  /**
   * Upsert used by the mobile sync engine (offline-first, last-write-wins on updatedAt).
   * Returns the winning version so the client can reconcile.
   */
  app.put('/v1/projects/:id', auth, async (req) => {
    const { id } = idParam.parse(req.params);
    const input = projectSchema.parse(req.body);
    if (input.id !== id) throw new HttpError(400, 'Id mismatch');
    const unknownKpis = input.kpis.filter((k) => !kb.get(k.kpiId)).map((k) => k.kpiId);
    if (unknownKpis.length) throw new HttpError(400, `Unknown KPI ids: ${unknownKpis.slice(0, 5).join(', ')}`);

    const existing = store.data.projects.find((p) => p.id === id);
    if (existing) {
      const current = assertProjectAccess(ctx, req.user!.sub, req.user!.org, id, 'editor');
      if (current.updatedAt > input.updatedAt) return { project: current, conflict: true };
      const next: Project = { ...(input as Project), ownerId: current.ownerId, orgId: current.orgId };
      store.data.projects[store.data.projects.indexOf(current)] = next;
      ctx.audit({ userId: req.user!.sub, orgId: req.user!.org, action: 'project.update', target: id });
      store.save();
      return { project: next, conflict: false };
    }
    const created: Project = { ...(input as Project), ownerId: req.user!.sub, orgId: req.user!.org };
    store.data.projects.push(created);
    store.data.members.push({ projectId: id, userId: req.user!.sub, permission: 'owner' });
    ctx.audit({ userId: req.user!.sub, orgId: req.user!.org, action: 'project.create', target: id });
    store.save();
    return { project: created, conflict: false };
  });

  app.delete('/v1/projects/:id', auth, async (req) => {
    const { id } = idParam.parse(req.params);
    assertProjectAccess(ctx, req.user!.sub, req.user!.org, id, 'owner');
    store.data.projects = store.data.projects.filter((p) => p.id !== id);
    store.data.members = store.data.members.filter((m) => m.projectId !== id);
    ctx.audit({ userId: req.user!.sub, orgId: req.user!.org, action: 'project.delete', target: id });
    store.save();
    return { ok: true };
  });

  app.post('/v1/projects/:id/members', auth, async (req) => {
    const { id } = idParam.parse(req.params);
    const body = z.object({ email: z.string().email(), permission: z.enum(['editor', 'viewer']) }).parse(req.body);
    assertProjectAccess(ctx, req.user!.sub, req.user!.org, id, 'owner');
    const user = store.data.users.find((u) => u.email === body.email.toLowerCase() && u.orgId === req.user!.org);
    if (!user) throw new HttpError(404, 'No user with this email in your organisation');
    store.data.members = store.data.members.filter((m) => !(m.projectId === id && m.userId === user.id));
    store.data.members.push({ projectId: id, userId: user.id, permission: body.permission });
    ctx.audit({ userId: req.user!.sub, orgId: req.user!.org, action: 'project.member_set', target: id, meta: { member: user.id, permission: body.permission } });
    store.save();
    return { ok: true };
  });

  app.get('/v1/projects/:id/balance', auth, async (req) => {
    const { id } = idParam.parse(req.params);
    const p = assertProjectAccess(ctx, req.user!.sub, req.user!.org, id, 'viewer');
    return analyzeBalance(kb.require(p.kpis.map((k) => k.kpiId)), { graph: kb.graph, library: kb.kpis, industry: p.industry, projectKpis: p.kpis });
  });

  app.get('/v1/projects/:id/summary', auth, async (req) => {
    const { id } = idParam.parse(req.params);
    const p = assertProjectAccess(ctx, req.user!.sub, req.user!.org, id, 'viewer');
    return buildExecutiveSummary(p, kb);
  });

  // ---------- KPI collections ----------
  app.get('/v1/collections', auth, async (req) => ({
    collections: store.data.collections.filter((c) => c.ownerId === req.user!.sub).map(({ ownerId: _o, ...c }) => c),
  }));

  app.put('/v1/collections/:id', auth, async (req) => {
    const { id } = idParam.parse(req.params);
    const input = collectionSchema.parse(req.body);
    if (input.id !== id) throw new HttpError(400, 'Id mismatch');
    const existing = store.data.collections.find((c) => c.id === id);
    if (existing && existing.ownerId !== req.user!.sub) throw new HttpError(404, 'Collection not found');
    store.data.collections = store.data.collections.filter((c) => c.id !== id);
    store.data.collections.push({ ...input, ownerId: req.user!.sub });
    store.save();
    return { collection: input };
  });

  app.delete('/v1/collections/:id', auth, async (req) => {
    const { id } = idParam.parse(req.params);
    store.data.collections = store.data.collections.filter((c) => !(c.id === id && c.ownerId === req.user!.sub));
    store.save();
    return { ok: true };
  });

  // ---------- Notifications ----------
  app.post('/v1/notifications/push-token', auth, async (req) => {
    const body = z.object({ token: z.string().min(10).max(300), platform: z.enum(['ios', 'android', 'web']) }).parse(req.body);
    store.data.pushTokens = store.data.pushTokens.filter((t) => t.token !== body.token);
    store.data.pushTokens.push({ userId: req.user!.sub, ...body, updatedAt: new Date().toISOString() });
    store.save();
    return { ok: true };
  });

  /** Non-intrusive, computed project-health nudges (also the payload source for future push delivery). */
  app.get('/v1/notifications', auth, async (req) => {
    const mine = new Set(store.data.members.filter((m) => m.userId === req.user!.sub).map((m) => m.projectId));
    const out: AppNotification[] = [];
    for (const p of store.data.projects.filter((x) => mine.has(x.id))) {
      const noTarget = p.kpis.filter((k) => !k.target).length;
      if (noTarget) out.push({ id: `${p.id}:targets`, kind: 'project-health', title: p.name, body: `Your project has ${noTarget} KPI${noTarget > 1 ? 's' : ''} without targets.`, projectId: p.id, createdAt: p.updatedAt });
      const noKpi = p.map.objectives.filter((o) => !o.kpiIds.length).length;
      if (noKpi) out.push({ id: `${p.id}:map`, kind: 'project-health', title: p.name, body: `Your strategy map contains ${noKpi} objective${noKpi > 1 ? 's' : ''} without KPIs.`, projectId: p.id, createdAt: p.updatedAt });
    }
    return { notifications: out };
  });

}
