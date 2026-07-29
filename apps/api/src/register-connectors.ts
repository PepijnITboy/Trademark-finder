import { createBoipConnector, createAllConnectors, type TrademarkRegisterConnector } from '@merkwacht/register-connectors';
import type { ApiEnv } from '@merkwacht/config';

/**
 * Builds the BOIP connector from validated API environment (backward-compatible).
 */
export function createBoipConnectorFromEnv(env: ApiEnv): TrademarkRegisterConnector {
  return createBoipConnector({
    apiBaseUrl: env.BOIP_API_BASE_URL,
    apiKey: env.BOIP_API_KEY,
    useFixtures: env.BOIP_USE_FIXTURES,
  });
}

/** Full connector map for platform probe/sync when ready. */
export function createConnectorsFromEnv(_env: ApiEnv): Map<string, TrademarkRegisterConnector> {
  return createAllConnectors();
}
