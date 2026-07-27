import type { ApiEnv } from '@merkwacht/config';
import { createBoipConnector, type TrademarkRegisterConnector } from '@merkwacht/register-connectors';

/**
 * Builds the BOIP connector from validated API environment. Kept as a
 * single factory (rather than each route constructing its own connector)
 * so `BOIP_USE_FIXTURES`/credentials are resolved consistently everywhere -
 * see `docs/connectors/boip.md`.
 */
export function createBoipConnectorFromEnv(env: ApiEnv): TrademarkRegisterConnector {
  return createBoipConnector({
    apiBaseUrl: env.BOIP_API_BASE_URL,
    apiKey: env.BOIP_API_KEY,
    useFixtures: env.BOIP_USE_FIXTURES,
  });
}
