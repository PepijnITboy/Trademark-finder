import { DEV_SEED_IDS } from '@merkwacht/database';
import { describe, expect, it } from 'vitest';
import { MOCK_CHECKOUT_URL, MOCK_WEBHOOK_SECRET, MockStripeBillingProvider } from './mock-provider.js';

describe('MockStripeBillingProvider', () => {
  const provider = new MockStripeBillingProvider();

  it('creates a checkout session with card and ideal payment methods', async () => {
    const session = await provider.createCheckoutSession({
      organizationId: DEV_SEED_IDS.organizationId,
      purpose: 'add_payment_method',
      customerEmail: 'factuur@example.nl',
      successUrl: 'http://localhost:5173/app/betalingen?checkout=success',
      cancelUrl: 'http://localhost:5173/app/betalingen?checkout=cancelled',
    });

    expect(session.url).toMatch(new RegExp(`^${MOCK_CHECKOUT_URL.replace('.', '\\.')}/`));
    expect(session.sessionId).toMatch(/^cs_test_/);
    expect(provider.paymentMethodTypes).toEqual(['card', 'ideal']);
  });

  it('accepts webhook payloads with the mock secret', () => {
    const payload = JSON.stringify({
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: {
            organizationId: DEV_SEED_IDS.organizationId,
            invoiceId: '11111111-1111-4111-8111-111111111111',
            purpose: 'pay_invoice',
          },
        },
      },
    });

    const event = provider.constructWebhookEvent(payload, MOCK_WEBHOOK_SECRET);
    expect(event.type).toBe('checkout.session.completed');
    expect(event.organizationId).toBe(DEV_SEED_IDS.organizationId);
    expect(event.purpose).toBe('pay_invoice');
  });

  it('rejects webhook payloads with a bad signature', () => {
    expect(() =>
      provider.constructWebhookEvent('{}', 'bad-signature'),
    ).toThrowError(expect.objectContaining({ code: 'BILLING_WEBHOOK_INVALID' }));
  });
});
