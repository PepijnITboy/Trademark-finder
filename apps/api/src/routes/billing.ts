import { SUBSCRIPTION_PLANS } from '@merkwacht/domain';
import { AppError } from '@merkwacht/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { BillingWebhookEvent } from '../billing/types.js';
import { getOrganizationId } from '../org/demo-request-context.js';

const checkoutBodySchema = z.object({
  purpose: z.enum(['add_payment_method', 'pay_invoice']),
  invoiceId: z.string().uuid().optional(),
  plan: z.enum(SUBSCRIPTION_PLANS).optional(),
});

function checkoutOrigin(env: { CORS_ORIGIN: string }): string {
  return env.CORS_ORIGIN.split(',')[0]?.trim() ?? 'http://localhost:5173';
}

function resolveCustomerEmail(app: FastifyInstance, organizationId: string): string {
  const profile = app.orgStore.getProfile(organizationId);
  return profile.contactEmail || profile.billingEmail;
}

function applyWebhookEvent(app: FastifyInstance, event: BillingWebhookEvent): void {
  if (event.organizationId) {
    try {
      app.orgStore.recordBillingEvent(event.organizationId, {
        eventType: event.type,
        payload: event.raw,
        provider: event.provider,
      });
    } catch {
      // Unknown organization — acknowledge webhook without persisting.
    }
  }

  const shouldMarkPaid =
    (event.type === 'checkout.session.completed' && event.purpose === 'pay_invoice') ||
    event.type === 'invoice.paid';

  if (shouldMarkPaid && event.organizationId && event.invoiceId) {
    try {
      app.orgStore.markInvoicePaid(event.organizationId, event.invoiceId);
    } catch {
      // Unknown organization — ignore.
    }
  }

  if (
    event.type === 'checkout.session.completed' &&
    event.purpose === 'name_research_order' &&
    event.nameResearchOrderId
  ) {
    app.nameResearchStore.markPaid(event.nameResearchOrderId, String(event.raw['id'] ?? 'session'));
  }
}

/** `/api/v1/billing` — Stripe Checkout sessions and webhook ingestion. */
export async function registerBillingRoutes(app: FastifyInstance): Promise<void> {
  app.post('/checkout', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!app.billingProvider.configured) {
      return reply.status(503).send({
        code: 'BILLING_NOT_CONFIGURED',
        messageNl: 'Stripe is niet geconfigureerd. Betalingen zijn tijdelijk niet beschikbaar.',
      });
    }

    const organizationId = getOrganizationId(app);
    const body = checkoutBodySchema.parse(request.body);
    const origin = checkoutOrigin(app.appEnv);

    if (body.purpose === 'pay_invoice') {
      if (!body.invoiceId) {
        throw new AppError({
          code: 'BILLING_CHECKOUT_INVALID',
          messageNl: 'Factuur-id is verplicht voor betaling.',
          category: 'VALIDATION',
          httpStatus: 400,
        });
      }
      const invoice = app.orgStore.getInvoice(organizationId, body.invoiceId);
      if (!invoice) {
        return reply.status(404).send({
          code: 'INVOICE_NOT_FOUND',
          messageNl: 'Deze factuur bestaat niet.',
          referenceCode: body.invoiceId,
        });
      }
      if (invoice.status !== 'open') {
        throw new AppError({
          code: 'INVOICE_NOT_PAYABLE',
          messageNl: 'Deze factuur kan niet meer worden betaald.',
          category: 'CONFLICT',
          httpStatus: 409,
        });
      }

      const session = await app.billingProvider.createCheckoutSession({
        organizationId,
        purpose: 'pay_invoice',
        customerEmail: resolveCustomerEmail(app, organizationId),
        successUrl: `${origin}/app/betalingen?checkout=success`,
        cancelUrl: `${origin}/app/betalingen?checkout=cancelled`,
        invoiceId: invoice.id,
        invoiceAmountCents: invoice.amountCents,
        invoiceDescription: invoice.description,
        ...(body.plan !== undefined ? { plan: body.plan } : {}),
      });

      return { url: session.url, configured: true };
    }

    const session = await app.billingProvider.createCheckoutSession({
      organizationId,
      purpose: 'add_payment_method',
      customerEmail: resolveCustomerEmail(app, organizationId),
      successUrl: `${origin}/app/betalingen?checkout=success`,
      cancelUrl: `${origin}/app/betalingen?checkout=cancelled`,
      ...(body.plan !== undefined ? { plan: body.plan } : {}),
    });

    return { url: session.url, configured: true };
  });

  await app.register(async function billingWebhookScope(scope) {
    scope.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_request, body, done) => {
      done(null, body);
    });

    scope.post('/webhook', async (request: FastifyRequest, reply: FastifyReply) => {
      const signatureHeader = request.headers['stripe-signature'];
      const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
      const payload = request.body as Buffer;

      const event = app.billingProvider.constructWebhookEvent(payload, signature);
      applyWebhookEvent(app, event);

      return reply.status(200).send({ received: true });
    });
  });
}
