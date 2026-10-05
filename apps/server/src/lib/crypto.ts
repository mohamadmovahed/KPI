import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { jwtVerify, SignJWT } from 'jose';
import type { Role } from '@kpi/shared';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltB64, keyB64] = stored.split('$');
  if (algo !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length);
  return timingSafeEqual(expected, actual);
}

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

/** Refresh tokens are stored hashed so a leaked datastore cannot be replayed. */
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export interface AccessClaims {
  sub: string;
  role: Role;
  org: string;
}

export async function signAccessToken(claims: AccessClaims, secret: string, ttlSec: number): Promise<string> {
  return new SignJWT({ role: claims.role, org: claims.org })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${ttlSec}s`)
    .setIssuer('kpi-api')
    .setAudience('kpi-mobile')
    .sign(new TextEncoder().encode(secret));
}

export async function verifyAccessToken(token: string, secret: string): Promise<AccessClaims> {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { issuer: 'kpi-api', audience: 'kpi-mobile' });
  return { sub: String(payload.sub), role: payload.role as Role, org: String(payload.org) };
}
