import type { ApiEnv } from '@merkwacht/config';
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from '@merkwacht/domain';
import { AppError } from '@merkwacht/shared';
import Stripe from 'stripe';
import { BILLING_PAYMENT_METHOD_TYPES } from './types.js';
import type {
  BillingProvider,
  BillingWebhookEvent,
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResult,
} from './types.js';

function parsePriceIds(raw: string | undefined): Partial<Record<SubscriptionPlan, string>> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    const result: Partial<Record<SubscriptionPlan, string>> = {};
    for (const plan of SUBSCRIPTION_PLANS) {
      if (parsed[plan]) result[plan] = parsed[plan];
    }
    return result;
  } catch {
    return {};
  }
}

export class StripeBillingProvider implements BillingProvider {
  readonly configured = true;
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;
  private readonly priceIds: Partial<Record<SubscriptionPlan, string>>;

  constructor(env: ApiEnv & { STRIPE_SECRET_KEY: string }) {
    this.stripe = new Stripe(env.STRIPE_SECRET_KEY);
    this.webhookSecret = env.STRIPE_WEBHOOK_SECRET ?? '';
    this.priceIds = parsePriceIds(env.STRIPE_PRICE_IDS);
  }

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CreateCheckoutSessionResult> {
    const metadata = {
      organizationId: input.organizationId,
      purpose: input.purpose,
      ...(input.invoiceId ? { invoiceId: input.invoiceId } : {}),
      ...(input.plan ? { plan: input.plan } : {}),
      ...(input.nameResearchOrderId ? { nameResearchOrderId: input.nameResearchOrderId } : {}),
    };

    if (input.purpose === 'add_payment_method') {
      const session = await this.stripe.checkout.sessions.create({
        mode: 'setup',
        customer_email: input.customerEmail,
        payment_method_types: [...BILLING_PAYMENT_METHOD_TYPES],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata,
      });
      if (!session.url) {
        throw new AppError({
          code: 'BILLING_CHECKOUT_FAILED',
          messageNl: 'Stripe Checkout kon niet worden gestart.',
          category: 'EXTERNAL_SERVICE',
          httpStatus: 502,
        });
      }
      return { url: session.url, sessionId: session.id };
    }

    if (input.invoiceAmountCents === undefined) {
      throw new AppError({
        code: 'BILLING_CHECKOUT_INVALID',
        messageNl: 'Bedrag ontbreekt voor betaling.',
        category: 'VALIDATION',
        httpStatus: 400,
      });
    }

    if (input.purpose === 'pay_invoice' && !input.invoiceId) {
      throw new AppError({
        code: 'BILLING_CHECKOUT_INVALID',
        messageNl: 'Factuurgegevens ontbreken voor betaling.',
        category: 'VALIDATION',
        httpStatus: 400,
      });
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: input.customerEmail,
      payment_method_types: [...BILLING_PAYMENT_METHOD_TYPES],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: input.invoiceAmountCents,
            product_data: {
              name: input.invoiceDescription ?? 'Merkwacht betaling',
            },
          },
        },
      ],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata,
    });

    if (!session.url) {
      throw new AppError({
        code: 'BILLING_CHECKOUT_FAILED',
        messageNl: 'Stripe Checkout kon niet worden gestart.',
        category: 'EXTERNAL_SERVICE',
        httpStatus: 502,
      });
    }

    return { url: session.url, sessionId: session.id };
  }

  constructWebhookEvent(payload: Buffer | string, signature: string | undefined): BillingWebhookEvent {
    if (!this.webhookSecret) {
      throw new AppError({
        code: 'BILLING_NOT_CONFIGURED',
        messageNl: 'Stripe webhook secret ontbreekt.',
        category: 'CONFIGURATION',
        httpStatus: 503,
      });
    }
    if (!signature) {
      throw new AppError({
        code: 'BILLING_WEBHOOK_INVALID',
        messageNl: 'De Stripe-webhookhandtekening ontbreekt.',
        category: 'VALIDATION',
        httpStatus: 400,
      });
    }

    const rawBody = typeof payload === 'string' ? payload : payload.toString('utf8');
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch {
      throw new AppError({
        code: 'BILLING_WEBHOOK_INVALID',
        messageNl: 'De Stripe-webhookhandtekening is ongeldig.',
        category: 'VALIDATION',
        httpStatus: 400,
      });
    }

    const metadata = extractMetadata(event);
    return {
      type: event.type,
      provider: 'stripe',
      organizationId: metadata.organizationId,
      invoiceId: metadata.invoiceId,
      purpose: metadata.purpose as BillingWebhookEvent['purpose'],
      nameResearchOrderId: metadata.nameResearchOrderId,
      raw: event as unknown as Record<string, unknown>,
    };
  }

  getPriceId(plan: SubscriptionPlan): string | undefined {
    return this.priceIds[plan];
  }
}

function extractMetadata(event: Stripe.Event): Record<string, string | undefined> {
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    return {
      organizationId: session.metadata?.organizationId,
      invoiceId: session.metadata?.invoiceId,
      purpose: session.metadata?.purpose,
      nameResearchOrderId: session.metadata?.nameResearchOrderId,
    };
  }
  if (event.type === 'invoice.paid') {
    const invoice = event.data.object as Stripe.Invoice;
    return {
      organizationId: invoice.metadata?.organizationId,
      invoiceId: invoice.metadata?.invoiceId,
    };
  }
  return {};
}
