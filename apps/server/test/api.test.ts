import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Project } from '@kpi/shared';
import { buildApp } from '../src/app';
import { Store } from '../src/store/store';

let app: FastifyInstance;
let ctx: Awaited<ReturnType<typeof buildApp>>['ctx'];
let token = '';
let refresh = '';

const auth = () => ({ authorization: `Bearer ${token}` });

beforeAll(async () => {
  const built = await buildApp({ store: new Store(), config: { jwtSecret: 'x'.repeat(40), seedDemoUser: true, anthropicApiKey: undefined } });
  app = built.app;
  ctx = built.ctx;
});
afterAll(() => app.close());

describe('auth', () => {
  it('logs in the demo user and rotates refresh tokens', async () => {
    const res = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: 'demo@kpi.app', password: 'demo1234' } });
    expect(res.statusCode).toBe(200);
    token = res.json().tokens.accessToken;
    refresh = res.json().tokens.refreshToken;

    const r2 = await app.inject({ method: 'POST', url: '/v1/auth/refresh', payload: { refreshToken: refresh } });
    expect(r2.statusCode).toBe(200);
    const rotated = r2.json().tokens.refreshToken;
    // Reusing the old token is rejected and revokes the family.
    expect((await app.inject({ method: 'POST', url: '/v1/auth/refresh', payload: { refreshToken: refresh } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/v1/auth/refresh', payload: { refreshToken: rotated } })).statusCode).toBe(401);
  });

  it('rejects bad credentials and missing tokens', async () => {
    expect((await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: 'demo@kpi.app', password: 'wrongpass' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/v1/me' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: 'Bearer nope' } })).statusCode).toBe(401);
  });

  it('stores passwords hashed', () => {
    expect(ctx.store.data.users[0].passwordHash).toMatch(/^scrypt\$/);
  });
});

describe('kpis', () => {
  it('searches with natural language', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/kpis?q=' + encodeURIComponent('KPIs for customer loyalty in telecom') });
    const body = res.json();
    expect(body.interpretation.industries).toContain('telecom');
    expect(body.hits.slice(0, 5).map((h: { kpi: { id: string } }) => h.kpi.id)).toContain('churn-rate');
    expect(body.hits[0].quality).toBeGreaterThan(0);
  });

  it('returns detail with relations and sources', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/kpis/churn-rate' });
    const body = res.json();
    expect(body.drivers).toContain('nps');
    expect(body.sources.length).toBeGreaterThan(0);
    expect(body.quality.total).toBeGreaterThan(70);
    expect((await app.inject({ method: 'GET', url: '/v1/kpis/nope' })).statusCode).toBe(404);
  });

  it('serves a versioned offline sync payload', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/kpis/sync' });
    const { version, kpis } = res.json();
    expect(kpis.length).toBeGreaterThan(50);
    expect((await app.inject({ method: 'GET', url: `/v1/kpis/sync?version=${version}` })).statusCode).toBe(204);
  });

  it('validates input', async () => {
    expect((await app.inject({ method: 'GET', url: '/v1/kpis?limit=9999' })).statusCode).toBe(400);
  });
});

describe('ai', () => {
  it('requires auth and answers with the engine when no LLM is configured', async () => {
    expect((await app.inject({ method: 'POST', url: '/v1/ai/chat', payload: { message: 'hi' } })).statusCode).toBe(401);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/ai/chat',
      headers: auth(),
      payload: { message: 'Our customer churn increased from 4% to 7%. What should I investigate?' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().intent).toBe('diagnose');
    expect(res.json().engine).toBe('engine');
  });

  it('document analysis degrades gracefully without the AI service', async () => {
    const boundary = '----x';
    const payload = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\nContent-Type: image/png\r\n\r\nabc\r\n--${boundary}--\r\n`;
    const res = await app.inject({ method: 'POST', url: '/v1/ai/documents', headers: { ...auth(), 'content-type': `multipart/form-data; boundary=${boundary}` }, payload });
    expect(res.statusCode).toBe(503);
  });

  it('classifies KPI names read from a document', () => {
    const r = ctx.ai.classifyNames(['EBITDA margin', 'Customer churn', 'NPS', 'ROIC', 'Widget Index']);
    expect(r.found).toBe(5);
    expect(r.items.filter((i) => i.kpiId).length).toBe(4);
    expect(r.summary).toMatch(/I found 5 KPIs/);
  });
});

describe('projects', () => {
  const now = new Date().toISOString();
  const project: Project = {
    id: 'prj_test1',
    name: 'Telecom Strategy 2027–2030',
    industry: 'telecom',
    kpis: [{ kpiId: 'churn-rate', addedAt: now }, { kpiId: 'nps', addedAt: now, target: '+35' }],
    map: { objectives: [{ id: 'o1', title: 'Improve customer loyalty', perspective: 'customer', kpiIds: [], x: 0, y: 0 }], links: [] },
    initiatives: [],
    createdAt: now,
    updatedAt: now,
  };

  it('creates, lists and analyses a project', async () => {
    const put = await app.inject({ method: 'PUT', url: `/v1/projects/${project.id}`, headers: auth(), payload: project });
    expect(put.statusCode).toBe(200);
    const list = await app.inject({ method: 'GET', url: '/v1/projects', headers: auth() });
    expect(list.json().projects).toHaveLength(1);
    const bal = await app.inject({ method: 'GET', url: `/v1/projects/${project.id}/balance`, headers: auth() });
    expect(bal.json().score).toBeGreaterThan(0);
    const sum = await app.inject({ method: 'GET', url: `/v1/projects/${project.id}/summary`, headers: auth() });
    expect(sum.json().title).toContain('Executive Summary');
    const notes = await app.inject({ method: 'GET', url: '/v1/notifications', headers: auth() });
    expect(notes.json().notifications.map((n: { body: string }) => n.body).join(' ')).toMatch(/1 KPI without targets.*1 objective without KPIs/);
  });

  it('applies last-write-wins and rejects unknown KPIs', async () => {
    const stale = await app.inject({ method: 'PUT', url: `/v1/projects/${project.id}`, headers: auth(), payload: { ...project, name: 'old', updatedAt: '2000-01-01T00:00:00.000Z' } });
    expect(stale.json().conflict).toBe(true);
    const bad = await app.inject({ method: 'PUT', url: `/v1/projects/${project.id}`, headers: auth(), payload: { ...project, kpis: [{ kpiId: 'made-up', addedAt: now }] } });
    expect(bad.statusCode).toBe(400);
  });

  it('isolates projects between organisations', async () => {
    const reg = await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { email: 'other@corp.com', password: 'password123', name: 'Other' } });
    const other = reg.json().tokens.accessToken;
    const res = await app.inject({ method: 'GET', url: `/v1/projects/${project.id}`, headers: { authorization: `Bearer ${other}` } });
    expect(res.statusCode).toBe(404);
    const overwrite = await app.inject({ method: 'PUT', url: `/v1/projects/${project.id}`, headers: { authorization: `Bearer ${other}` }, payload: { ...project, updatedAt: new Date(Date.now() + 1e6).toISOString() } });
    expect(overwrite.statusCode).toBe(404);
  });

  it('AI chat uses the server project as balance scope', async () => {
    const res = await app.inject({ method: 'POST', url: '/v1/ai/chat', headers: auth(), payload: { message: 'Are my KPIs balanced?', context: { projectId: project.id } } });
    expect(res.json().intent).toBe('balance');
    expect(res.json().summary).toContain('Telecom Strategy');
  });

  it('audit log never stores prompt text', () => {
    expect(JSON.stringify(ctx.store.data.audit)).not.toMatch(/churn increased/);
  });
});

describe('admin', () => {
  it('is restricted to admins of the org', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/admin/users', headers: auth() });
    expect(res.statusCode).toBe(200);
    expect(res.json().users.every((u: { email: string }) => u.email !== 'other@corp.com')).toBe(true);
  });
});
