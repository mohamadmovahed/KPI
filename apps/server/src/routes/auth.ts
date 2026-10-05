import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthTokens, PublicUser } from '@kpi/shared';
import { hashPassword, randomToken, sha256, signAccessToken, verifyPassword } from '../lib/crypto';
import { HttpError, makeAuthHooks, type AppContext } from '../lib/context';
import type { UserRecord } from '../store/store';
import { newId } from '../lib/ids';

const credentials = z.object({ email: z.string().email().max(200), password: z.string().min(8).max(200) });
const registration = credentials.extend({ name: z.string().min(1).max(120), orgName: z.string().min(1).max(160).optional() });

export const toPublicUser = (u: UserRecord): PublicUser => ({ id: u.id, email: u.email, name: u.name, role: u.role, orgId: u.orgId });

export async function issueTokens(ctx: AppContext, user: UserRecord, family = randomToken(12)): Promise<AuthTokens> {
  const refreshToken = randomToken(48);
  ctx.store.data.refreshTokens.push({
    hash: sha256(refreshToken),
    userId: user.id,
    family,
    expiresAt: Date.now() + ctx.config.refreshTokenTtlSec * 1000,
    revoked: false,
  });
  // Drop expired tokens opportunistically.
  ctx.store.data.refreshTokens = ctx.store.data.refreshTokens.filter((t) => t.expiresAt > Date.now());
  ctx.store.save();
  const accessToken = await signAccessToken({ sub: user.id, role: user.role, org: user.orgId }, ctx.config.jwtSecret, ctx.config.accessTokenTtlSec);
  return { accessToken, refreshToken, expiresIn: ctx.config.accessTokenTtlSec };
}

export async function registerAuthRoutes(app: FastifyInstance, ctx: AppContext) {
  const { authenticate } = makeAuthHooks(ctx);
  const strict = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

  app.post('/v1/auth/register', strict, async (req) => {
    const body = registration.parse(req.body);
    const email = body.email.toLowerCase();
    if (ctx.store.data.users.some((u) => u.email === email)) throw new HttpError(409, 'An account with this email already exists');
    const now = new Date().toISOString();
    const org = { id: newId('org'), name: body.orgName ?? `${body.name}'s workspace`, createdAt: now };
    const user: UserRecord = { id: newId('usr'), email, name: body.name, role: 'admin', orgId: org.id, passwordHash: await hashPassword(body.password), createdAt: now };
    ctx.store.data.orgs.push(org);
    ctx.store.data.users.push(user);
    ctx.audit({ userId: user.id, orgId: org.id, action: 'auth.register' });
    return { user: toPublicUser(user), tokens: await issueTokens(ctx, user) };
  });

  app.post('/v1/auth/login', strict, async (req) => {
    const body = credentials.parse(req.body);
    const user = ctx.store.data.users.find((u) => u.email === body.email.toLowerCase());
    // Same error for unknown user and wrong password.
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      ctx.audit({ action: 'auth.login_failed' });
      throw new HttpError(401, 'Invalid email or password');
    }
    ctx.audit({ userId: user.id, orgId: user.orgId, action: 'auth.login' });
    return { user: toPublicUser(user), tokens: await issueTokens(ctx, user) };
  });

  app.post('/v1/auth/refresh', strict, async (req) => {
    const { refreshToken } = z.object({ refreshToken: z.string().min(10).max(200) }).parse(req.body);
    const record = ctx.store.data.refreshTokens.find((t) => t.hash === sha256(refreshToken));
    if (!record || record.expiresAt < Date.now()) throw new HttpError(401, 'Invalid refresh token');
    if (record.revoked) {
      // Reuse of a rotated token: assume theft and revoke the whole family.
      ctx.store.data.refreshTokens.forEach((t) => t.family === record.family && (t.revoked = true));
      ctx.store.save();
      ctx.audit({ userId: record.userId, action: 'auth.refresh_reuse_detected' });
      throw new HttpError(401, 'Invalid refresh token');
    }
    const user = ctx.store.data.users.find((u) => u.id === record.userId);
    if (!user) throw new HttpError(401, 'Invalid refresh token');
    record.revoked = true;
    return { user: toPublicUser(user), tokens: await issueTokens(ctx, user, record.family) };
  });

  app.post('/v1/auth/logout', async (req) => {
    const { refreshToken } = z.object({ refreshToken: z.string().max(200) }).parse(req.body ?? {});
    const record = ctx.store.data.refreshTokens.find((t) => t.hash === sha256(refreshToken));
    if (record) {
      ctx.store.data.refreshTokens.forEach((t) => t.family === record.family && (t.revoked = true));
      ctx.store.save();
    }
    return { ok: true };
  });

  app.get('/v1/me', { preHandler: authenticate }, async (req) => {
    const user = ctx.store.data.users.find((u) => u.id === req.user!.sub);
    if (!user) throw new HttpError(404, 'User not found');
    return { user: toPublicUser(user) };
  });
}
