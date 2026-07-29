import { renderInvoicePdf, renderInvoiceUblXml } from '@merkwacht/exports';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getOrganizationId } from '../org/demo-request-context.js';

/** `/api/v1/invoices` — billing history, PDF and UBL download. */
export async function registerInvoiceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (request) => {
    const organizationId = getOrganizationId(request);
    const invoices = app.orgStore.listCustomerInvoices(organizationId);
    return { invoices };
  });

  app.post('/:id/checkout', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const organizationId = getOrganizationId(request);
    const invoice = app.orgStore.markInvoicePaid(organizationId, request.params.id);
    if (!invoice) {
      return reply.status(404).send({
        code: 'INVOICE_NOT_FOUND',
        messageNl: 'Deze factuur bestaat niet.',
        referenceCode: request.params.id,
      });
    }
    return { invoice, checkoutStatus: 'paid' };
  });

  app.get('/:id/pdf', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const organizationId = getOrganizationId(request);
    const invoice = app.orgStore.getInvoice(organizationId, request.params.id);
    if (!invoice || !invoice.pdfAvailable) {
      return reply.status(404).send({
        code: 'INVOICE_PDF_UNAVAILABLE',
        messageNl: 'Er is geen PDF beschikbaar voor deze factuur.',
        referenceCode: request.params.id,
      });
    }
    const profile = app.orgStore.getProfile(organizationId);
    const pdf = renderInvoicePdf({
      number: invoice.number,
      organizationName: profile.legalName,
      billingEmail: profile.billingEmail || profile.contactEmail,
      description: invoice.description,
      exVatCents: invoice.exVatCents,
      btwCents: invoice.btwCents,
      incVatCents: invoice.amountCents,
      status: invoice.status,
      issuedAt: invoice.createdAt,
      dueAt: invoice.dueAt,
      lineItems: invoice.lineItems ?? [
        {
          description: invoice.description,
          exVatCents: invoice.exVatCents,
          btwCents: invoice.btwCents,
          incVatCents: invoice.amountCents,
        },
      ],
    });
    return reply
      .header('Content-Disposition', `attachment; filename="${invoice.number}.pdf"`)
      .type('application/pdf')
      .send(Buffer.from(pdf));
  });

  app.get('/:id/ubl', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const organizationId = getOrganizationId(request);
    const invoice = app.orgStore.getInvoice(organizationId, request.params.id);
    if (!invoice || !invoice.ublXmlAvailable) {
      return reply.status(404).send({
        code: 'INVOICE_UBL_UNAVAILABLE',
        messageNl: 'Er is geen UBL XML beschikbaar voor deze factuur.',
        referenceCode: request.params.id,
      });
    }
    const profile = app.orgStore.getProfile(organizationId);
    const xml = renderInvoiceUblXml({
      number: invoice.number,
      organizationName: profile.legalName,
      billingEmail: profile.billingEmail || profile.contactEmail,
      description: invoice.description,
      exVatCents: invoice.exVatCents,
      btwCents: invoice.btwCents,
      incVatCents: invoice.amountCents,
      status: invoice.status,
      issuedAt: invoice.createdAt,
      dueAt: invoice.dueAt,
      lineItems: invoice.lineItems ?? [
        {
          description: invoice.description,
          exVatCents: invoice.exVatCents,
          btwCents: invoice.btwCents,
          incVatCents: invoice.amountCents,
        },
      ],
    });
    return reply
      .header('Content-Disposition', `attachment; filename="${invoice.number}.xml"`)
      .type('application/xml')
      .send(xml);
  });
}
