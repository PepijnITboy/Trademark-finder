import type { ApiEnv } from '@merkwacht/config';
import type { IdentityProvider } from '@merkwacht/database';
import type { Logger } from '@merkwacht/logging';
import type { TrademarkRegisterConnector } from '@merkwacht/register-connectors';
import type { OrgBillingChatStore } from '../org/org-store.js';
import type { PlatformStore } from '../platform/platform-store.js';
import type { AppStore } from '../store/types.js';
import type { NameResearchStore } from '../research/name-research-store.js';
import type { BillingProvider } from '../billing/types.js';

declare module 'fastify' {
  interface FastifyInstance {
    appLogger: Logger;
    appEnv: ApiEnv;
    store: AppStore;
    identityProvider: IdentityProvider;
    boipConnector: TrademarkRegisterConnector;
    platformStore: PlatformStore;
    orgStore: OrgBillingChatStore;
    billingProvider: BillingProvider;
    nameResearchStore: NameResearchStore;
  }

  interface FastifyRequest {
    correlationId?: string;
  }
}
