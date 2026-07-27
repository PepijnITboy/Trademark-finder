import { loadEnv } from '@merkwacht/config';
import { startPoller } from './poller';

const env = loadEnv('worker');
const stopPoller = startPoller({ env });

function shutdown(): void {
  stopPoller();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
