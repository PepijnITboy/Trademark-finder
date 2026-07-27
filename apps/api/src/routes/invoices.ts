import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getOrganizationId } from '../org/demo-request-context.js';

/** `/api/v1/invoices` — billing history and mock checkout/PDF download. */
export async function registerInvoiceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async () => {
    const organizationId = getOrganizationId(app);
    const invoices = app.orgStore.listInvoices(organizationId);
    return { invoices };
  });

  app.post('/:id/checkout', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const organizationId = getOrganizationId(app);
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
    const organizationId = getOrganizationId(app);
    const invoice = app.orgStore.getInvoice(organizationId, request.params.id);
    if (!invoice) {
      return reply.status(404).send({
        code: 'INVOICE_NOT_FOUND',
        messageNl: 'Deze factuur bestaat niet.',
        referenceCode: request.params.id,
      });
    }
    if (!invoice.pdfAvailable) {
      return reply.status(404).send({
        code: 'INVOICE_PDF_UNAVAILABLE',
        messageNl: 'Er is geen PDF beschikbaar voor deze factuur.',
        referenceCode: request.params.id,
      });
    }

    const body = [
      'Merkwacht — factuur (demo PDF)',
      `Nummer: ${invoice.number}`,
      `Status: ${invoice.status}`,
      `Bedrag: EUR ${(invoice.amountCents / 100).toFixed(2)}`,
      `Omschrijving: ${invoice.description}`,
    ].join('\n');

    return reply.type('text/plain').send(body);
  });
}
