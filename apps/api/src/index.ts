import { loadEnv } from '@merkwacht/config';
import { buildApp } from './app';
import { startServer } from './server';

async function main(): Promise<void> {
  const env = loadEnv('api');
  const app = await buildApp({ env });
  await startServer(app, env);
}

main().catch((error: unknown) => {
  console.error('Onverwachte opstartfout in de API.', error);
  process.exit(1);
});
