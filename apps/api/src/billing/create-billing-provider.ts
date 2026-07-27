import type { ApiEnv } from '@merkwacht/config';
import { MockStripeBillingProvider, UnconfiguredBillingProvider } from './mock-provider.js';
import { StripeBillingProvider } from './stripe-provider.js';
import type { BillingProvider } from './types.js';

export function createBillingProvider(env: ApiEnv): BillingProvider {
  if (env.STRIPE_SECRET_KEY) {
    return new StripeBillingProvider(env as ApiEnv & { STRIPE_SECRET_KEY: string });
  }
  if (env.NODE_ENV === 'test') {
    return new MockStripeBillingProvider();
  }
  return new UnconfiguredBillingProvider();
}
