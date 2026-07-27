import type { SubscriptionPlan } from '@merkwacht/domain';

export const BILLING_PAYMENT_METHOD_TYPES = ['card', 'ideal'] as const;

export type CheckoutPurpose = 'add_payment_method' | 'pay_invoice' | 'name_research_order';

export interface CreateCheckoutSessionInput {
  readonly organizationId: string;
  readonly purpose: CheckoutPurpose;
  readonly customerEmail: string;
  readonly successUrl: string;
  readonly cancelUrl: string;
  readonly invoiceId?: string;
  readonly invoiceAmountCents?: number;
  readonly invoiceDescription?: string;
  readonly plan?: SubscriptionPlan;
  readonly nameResearchOrderId?: string;
}

export interface CreateCheckoutSessionResult {
  readonly url: string;
  readonly sessionId: string;
}

export interface BillingWebhookEvent {
  readonly type: string;
  readonly provider: 'mock' | 'stripe';
  readonly organizationId?: string | undefined;
  readonly invoiceId?: string | undefined;
  readonly purpose?: CheckoutPurpose | undefined;
  readonly nameResearchOrderId?: string | undefined;
  readonly raw: Record<string, unknown>;
}

export interface BillingProvider {
  readonly configured: boolean;
  createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CreateCheckoutSessionResult>;
  constructWebhookEvent(payload: Buffer | string, signature: string | undefined): BillingWebhookEvent;
}
