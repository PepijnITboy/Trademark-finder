import { AppError, createId } from '@merkwacht/shared';
import { BILLING_PAYMENT_METHOD_TYPES } from './types.js';
import type {
  BillingProvider,
  BillingWebhookEvent,
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResult,
} from './types.js';

export const MOCK_CHECKOUT_URL = 'https://checkout.stripe.test/session';
export const MOCK_WEBHOOK_SECRET = 'whsec_test_mock';

/**
 * Stand-in for Stripe in test/CI when `STRIPE_SECRET_KEY` is absent.
 * Returns a deterministic checkout URL and validates webhooks with a fixed secret.
 */
export class MockStripeBillingProvider implements BillingProvider {
  readonly configured = true;
  readonly paymentMethodTypes = BILLING_PAYMENT_METHOD_TYPES;

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CreateCheckoutSessionResult> {
    const sessionId = `cs_test_${createId().replace(/-/g, '')}`;
    const url = `${MOCK_CHECKOUT_URL}/${sessionId}?purpose=${input.purpose}`;
    return { url, sessionId };
  }

  constructWebhookEvent(payload: Buffer | string, signature: string | undefined): BillingWebhookEvent {
    if (!signature || signature !== MOCK_WEBHOOK_SECRET) {
      throw new AppError({
        code: 'BILLING_WEBHOOK_INVALID',
        messageNl: 'De Stripe-webhookhandtekening is ongeldig.',
        category: 'VALIDATION',
        httpStatus: 400,
      });
    }

    const raw = JSON.parse(typeof payload === 'string' ? payload : payload.toString('utf8')) as Record<
      string,
      unknown
    >;
    const data = (raw.data as Record<string, unknown> | undefined)?.object as Record<string, unknown> | undefined;
    const metadata = (data?.metadata as Record<string, string> | undefined) ?? {};

    return {
      type: String(raw.type ?? 'unknown'),
      provider: 'mock',
      organizationId: metadata.organizationId,
      invoiceId: metadata.invoiceId,
      purpose: metadata.purpose as BillingWebhookEvent['purpose'],
      nameResearchOrderId: metadata.nameResearchOrderId,
      raw,
    };
  }
}

export class UnconfiguredBillingProvider implements BillingProvider {
  readonly configured = false;

  async createCheckoutSession(): Promise<CreateCheckoutSessionResult> {
    throw new AppError({
      code: 'BILLING_NOT_CONFIGURED',
      messageNl: 'Stripe is niet geconfigureerd. Neem contact op met Merkwacht.',
      category: 'CONFIGURATION',
      httpStatus: 503,
    });
  }

  constructWebhookEvent(): BillingWebhookEvent {
    throw new AppError({
      code: 'BILLING_NOT_CONFIGURED',
      messageNl: 'Stripe is niet geconfigureerd.',
      category: 'CONFIGURATION',
      httpStatus: 503,
    });
  }
}
