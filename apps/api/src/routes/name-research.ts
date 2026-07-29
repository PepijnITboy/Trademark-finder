import {
  NAME_RESEARCH_MIN_THRESHOLD,
  NAME_RESEARCH_MAX_THRESHOLD,
  registersForNameResearch,
} from '@merkwacht/domain';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getOrganizationId } from '../org/demo-request-context.js';

const scopeSchema = z.object({
  registryCode: z.string().min(1),
  niceClasses: z.array(z.number().int().min(1).max(45)).min(1),
});

const quoteSchema = z.object({
  scopes: z.array(scopeSchema).min(1),
});

const createOrderSchema = z.object({
  markText: z.string().trim().min(2).max(120),
  intendedNicheNl: z.string().trim().max(2000).optional().nullable(),
  scopes: z.array(scopeSchema).min(1),
  minScoreThreshold: z.number().min(NAME_RESEARCH_MIN_THRESHOLD).max(NAME_RESEARCH_MAX_THRESHOLD),
  useCredit: z.boolean().default(false),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export async function registerNameResearchRoutes(app: FastifyInstance): Promise<void> {
  app.get('/registers', async () => {
    const registers = registersForNameResearch(app.nameResearchStore.listCatalog());
    return { registers };
  });

  app.get('/credits', async (request) => {
    const organizationId = getOrganizationId(request);
    return { credits: app.nameResearchStore.getCredits(organizationId) };
  });

  app.post('/quotes', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = quoteSchema.parse(request.body);
    try {
      const quote = app.nameResearchStore.createQuote(body);
      return { quote };
    } catch (error) {
      return reply.status(400).send({
        code: 'INVALID_QUOTE',
        messageNl: error instanceof Error ? error.message : 'Ongeldige offerte.',
      });
    }
  });

  app.get('/orders', async (request) => {
    const organizationId = getOrganizationId(request);
    return { orders: app.nameResearchStore.listOrders(organizationId) };
  });

  app.get('/orders/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const organizationId = getOrganizationId(request);
    const order = app.nameResearchStore.getOrder(organizationId, request.params.id);
    if (!order) {
      return reply.status(404).send({
        code: 'ORDER_NOT_FOUND',
        messageNl: 'Dit merkonderzoek bestaat niet.',
        referenceCode: request.params.id,
      });
    }
    return { order };
  });

  app.post('/orders', async (request: FastifyRequest, reply: FastifyReply) => {
    const organizationId = getOrganizationId(request);
    const body = createOrderSchema.parse(request.body);
    let created;
    try {
      created = app.nameResearchStore.createOrder({
        organizationId,
        markText: body.markText,
        intendedNicheNl: body.intendedNicheNl ?? null,
        scopes: body.scopes,
        minScoreThreshold: body.minScoreThreshold,
        useCredit: body.useCredit,
      });
    } catch (error) {
      return reply.status(400).send({
        code: 'INVALID_ORDER',
        messageNl: error instanceof Error ? error.message : 'Order kon niet worden aangemaakt.',
      });
    }

    if (!created.checkoutRequired) {
      return reply.status(201).send({ order: created.order, checkoutUrl: null });
    }

    // Paid name research always creates a visible invoice row.
    const researchInvoice = app.orgStore.createInvoice(organizationId, {
      amountCents: created.totalCents,
      description: `Merkonderzoek: ${created.order.markText}`,
      status: 'open',
    });

    if (!app.billingProvider.configured) {
      const completed = app.nameResearchStore.markPaid(
        created.order.id,
        `local-demo-${created.order.id}`,
      );
      app.orgStore.markInvoicePaid(organizationId, researchInvoice.id, {
        internalNote: 'Demo: automatisch afgerond zonder Stripe',
      });
      return reply.status(201).send({
        order: completed ?? created.order,
        checkoutUrl: null,
        demoCompletedWithoutStripe: true,
        invoiceId: researchInvoice.id,
      });
    }

    const profile = app.orgStore.getProfile(organizationId);
    const successUrl =
      body.successUrl ??
      `http://localhost:8000/app/merkonderzoek/${created.order.id}?paid=1`;
    const cancelUrl = body.cancelUrl ?? `http://localhost:8000/app/merkonderzoek/nieuw?canceled=1`;

    const session = await app.billingProvider.createCheckoutSession({
      organizationId,
      purpose: 'name_research_order',
      customerEmail: profile.billingEmail || profile.contactEmail || 'facturatie@voorbeeld.nl',
      successUrl,
      cancelUrl,
      invoiceAmountCents: created.totalCents,
      invoiceDescription: `Merkonderzoek: ${created.order.markText}`,
      nameResearchOrderId: created.order.id,
    });

    const completed = app.nameResearchStore.markPaid(created.order.id, session.sessionId);
    app.orgStore.markInvoicePaid(organizationId, researchInvoice.id, {
      internalNote: `Checkout session ${session.sessionId}`,
    });

    return reply.status(201).send({
      order: completed ?? created.order,
      checkoutUrl: null,
      mockCheckoutUrl: session.url,
      invoiceId: researchInvoice.id,
    });
  });
}
