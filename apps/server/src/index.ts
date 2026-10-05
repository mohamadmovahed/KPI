import { buildApp } from './app';
import { config } from './config';

const { app } = await buildApp({ logger: true });

const shutdown = async () => {
  await app.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: config.port, host: config.host });
app.log.info(`KPI API listening on :${config.port} (LLM ${config.anthropicApiKey ? 'enabled' : 'disabled — deterministic engine'})`);
