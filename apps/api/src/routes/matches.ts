import { MATCH_STATUSES } from '@merkwacht/domain';
import { renderDossierHtml, toCsv, type ExportColumn } from '@merkwacht/exports';
import type { TrademarkMatchRecord } from '../store/types.js';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

const matchStatusUpdateSchema = z.object({
  status: z.enum(MATCH_STATUSES),
});

const addNoteSchema = z.object({
  note: z.string().trim().min(1, 'Notitie mag niet leeg zijn.').max(2000),
});

const listQuerySchema = z.object({
  status: z.enum(MATCH_STATUSES).optional(),
});

const exportQuerySchema = z.object({
  format: z.enum(['csv', 'html']).default('csv'),
});

function getOrganizationId(app: FastifyInstance): string {
  return app.identityProvider.getIdentity().organizationId;
}

function notFound(reply: FastifyReply, referenceCode: string): FastifyReply {
  return reply.status(404).send({
    code: 'MATCH_NOT_FOUND',
    messageNl: 'De opgevraagde match bestaat niet (of niet binnen uw organisatie).',
    referenceCode,
  });
}

const MATCH_EXPORT_COLUMNS: Array<ExportColumn<TrademarkMatchRecord>> = [
  { header: 'Kandidaat merk', value: (m) => m.candidate.markText },
  { header: 'Register', value: (m) => m.candidate.registryCode },
  { header: 'Aanvraagnummer', value: (m) => m.candidate.applicationNumber },
  { header: 'Status', value: (m) => m.status },
  { header: 'Totaalscore', value: (m) => m.totalScore },
  { header: 'Nice-klassen', value: (m) => m.candidate.niceClasses.join(', ') },
  { header: 'Publicatiedatum', value: (m) => m.candidate.publicationDate },
  {
    header: 'Oppositietermijn',
    value: (m) => m.candidate.oppositionDeadline?.deadlineDate ?? '',
  },
];

/**
 * `/api/v1/matches` - review workflow for scored `WatchedTrademark` <->
 * `CandidateApplication` matches: listing/filtering, status transitions,
 * reviewer notes, advisor escalation, and export. See
 * `docs/domain/opposition-workflow.md`.
 */
export async function registerMatchRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (request: FastifyRequest) => {
    const organizationId = getOrganizationId(app);
    const { status } = listQuerySchema.parse(request.query);
    const matches = await app.store.listMatches(organizationId, status ? { status } : {});
    return { matches };
  });

  app.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const organizationId = getOrganizationId(app);
    const match = await app.store.getMatch(organizationId, request.params.id);
    if (!match) return notFound(reply, request.correlationId ?? request.params.id);
    return { match };
  });

  app.patch('/:id/status', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const organizationId = getOrganizationId(app);
    const { status } = matchStatusUpdateSchema.parse(request.body);
    const reviewedBy = app.identityProvider.getIdentity().userId;
    const updated = await app.store.updateMatchStatus(organizationId, request.params.id, status, reviewedBy);
    if (!updated) return notFound(reply, request.correlationId ?? request.params.id);
    return { match: updated };
  });

  app.post('/:id/notes', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const organizationId = getOrganizationId(app);
    const { note } = addNoteSchema.parse(request.body);
    const created = await app.store.addMatchNote(organizationId, request.params.id, note);
    if (!created) return notFound(reply, request.correlationId ?? request.params.id);
    return reply.status(201).send({ note: created });
  });

  app.post(
    '/:id/request-advisor',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const organizationId = getOrganizationId(app);
      const updated = await app.store.requestAdvisorReview(organizationId, request.params.id);
      if (!updated) return notFound(reply, request.correlationId ?? request.params.id);
      return { match: updated };
    },
  );

  app.get('/:id/export', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const organizationId = getOrganizationId(app);
    const { format } = exportQuerySchema.parse(request.query);
    const match = await app.store.getMatch(organizationId, request.params.id);
    if (!match) return notFound(reply, request.correlationId ?? request.params.id);

    if (format === 'html') {
      const html = renderDossierHtml({
        organizationName: 'Merkwacht',
        watchedTrademarkName: match.watchedTrademarkLabel,
        generatedAt: new Date().toISOString(),
        matches: [
          {
            candidateName: match.candidate.markText,
            jurisdiction: match.candidate.registryCode,
            status: match.status,
            niceClasses: [...match.candidate.niceClasses],
          },
        ],
      });
      return reply.header('content-type', 'text/html; charset=utf-8').send(html);
    }

    const csv = toCsv([match], MATCH_EXPORT_COLUMNS);
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="match-${match.id}.csv"`)
      .send(csv);
  });
}
