import { randomBytes } from 'node:crypto';

const env = process.env;
const isProd = env.NODE_ENV === 'production';

if (isProd && (!env.JWT_SECRET || env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be set to at least 32 characters in production');
}

export const config = {
  isProd,
  port: Number(env.PORT ?? 4000),
  host: env.HOST ?? '0.0.0.0',
  // Dev fallback is random per process, so tokens never survive a restart with a guessable key.
  jwtSecret: env.JWT_SECRET ?? randomBytes(48).toString('base64'),
  accessTokenTtlSec: 15 * 60,
  refreshTokenTtlSec: 30 * 24 * 60 * 60,
  anthropicApiKey: env.ANTHROPIC_API_KEY || undefined,
  anthropicModel: env.ANTHROPIC_MODEL || 'claude-opus-5-5',
  corsOrigins: (env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  dataDir: env.DATA_DIR ?? './data',
  seedDemoUser: !isProd && env.SEED_DEMO_USER !== 'false',
  maxUploadBytes: 8 * 1024 * 1024,
};

export type Config = typeof config;
