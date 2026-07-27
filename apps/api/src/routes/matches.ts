import {
  MATCH_QUEUES,
  MATCH_STATUSES,
  acceptMatchStatus,
  archiveMatchStatus,
  rejectMatchStatus,
  statusesForQueue,
  type MatchQueue,
} from '@merkwacht/domain';
import { AppError } from '@merkwacht/shared';
import { renderDossierHtml, renderDossierPdf, toCsv, type ExportColumn } from '@merkwacht/exports';
import type { TrademarkMatchRecord } from '../store/types.js';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

const matchStatusUpdateSchema = z.object({
  status: z.enum(MATCH_STATUSES),
});

const addNoteSchema = z.object({
  note: z.string().trim().min(1, 'Notitie mag niet leeg zijn.').max(2000),
});

const rejectSchema = z.object({
  reason: z.string().trim().min(1, 'Geef een reden op.').max(2000),
});

const listQuerySchema = z.object({
  status: z.enum(MATCH_STATUSES).optional(),
  queue: z.enum(MATCH_QUEUES).optional(),
});

const exportQuerySchema = z.object({
  format: z.enum(['csv', 'html', 'pdf']).default('csv'),
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

function badTransition(reply: FastifyReply, referenceCode: string, messageNl: string): FastifyReply {
  return reply.status(409).send({
    code: 'MATCH_INVALID_TRANSITION',
    messageNl,
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
 * `/api/v1/matches` - review workflow for scored matches with triage queues.
 */
export async function registerMatchRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (request: FastifyRequest) => {
    const organizationId = getOrganizationId(app);
    const { status, queue } = listQuerySchema.parse(request.query);
    let matches = await app.store.listMatches(organizationId, status ? { status } : {});
    if (queue) {
      const allowed = new Set(statusesForQueue(queue as MatchQueue));
      matches = matches.filter((m) => allowed.has(m.status));
    }
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
    const existing = await app.store.getMatch(organizationId, request.params.id);
    if (!existing) return notFound(reply, request.correlationId ?? request.params.id);

    // Product rule: accepting a possible match already marks it active/relevant.
    // Flipping under_review → confirmed_conflict ("Relevant") is forbidden.
    if (status === 'confirmed_conflict' && existing.status !== 'new') {
      return badTransition(
        reply,
        request.correlationId ?? request.params.id,
        'Een actieve match kan niet opnieuw als “relevant” worden gemarkeerd. Gebruik archief of adviseur.',
      );
    }

    const reviewedBy = app.identityProvider.getIdentity().userId;
    const updated = await app.store.updateMatchStatus(organizationId, request.params.id, status, reviewedBy);
    if (!updated) return notFound(reply, request.correlationId ?? request.params.id);
    return { match: updated };
  });

  app.post('/:id/accept', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const organizationId = getOrganizationId(app);
    const existing = await app.store.getMatch(organizationId, request.params.id);
    if (!existing) return notFound(reply, request.correlationId ?? request.params.id);
    const next = acceptMatchStatus(existing.status);
    if (!next) {
      return badTransition(
        reply,
        request.correlationId ?? request.params.id,
        'Alleen mogelijke matches (nieuw) kunnen worden geaccepteerd.',
      );
    }
    const reviewedBy = app.identityProvider.getIdentity().userId;
    const updated = await app.store.updateMatchStatus(organizationId, request.params.id, next, reviewedBy);
    if (!updated) return notFound(reply, request.correlationId ?? request.params.id);
    return { match: updated };
  });

  app.post('/:id/reject', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const organizationId = getOrganizationId(app);
    const { reason } = rejectSchema.parse(request.body);
    const existing = await app.store.getMatch(organizationId, request.params.id);
    if (!existing) return notFound(reply, request.correlationId ?? request.params.id);
    const next = rejectMatchStatus(existing.status);
    if (!next) {
      return badTransition(
        reply,
        request.correlationId ?? request.params.id,
        'Alleen mogelijke matches (nieuw) kunnen worden afgewezen.',
      );
    }
    await app.store.addMatchNote(organizationId, request.params.id, `Niet relevant: ${reason}`);
    const reviewedBy = app.identityProvider.getIdentity().userId;
    const updated = await app.store.updateMatchStatus(organizationId, request.params.id, next, reviewedBy);
    if (!updated) return notFound(reply, request.correlationId ?? request.params.id);
    return { match: updated };
  });

  app.post('/:id/archive', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const organizationId = getOrganizationId(app);
    const existing = await app.store.getMatch(organizationId, request.params.id);
    if (!existing) return notFound(reply, request.correlationId ?? request.params.id);
    const next = archiveMatchStatus(existing.status);
    if (!next) {
      return badTransition(
        reply,
        request.correlationId ?? request.params.id,
        'Alleen actieve matches kunnen naar het archief.',
      );
    }
    const reviewedBy = app.identityProvider.getIdentity().userId;
    const updated = await app.store.updateMatchStatus(organizationId, request.params.id, next, reviewedBy);
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

    if (format === 'pdf') {
      const deadline = match.candidate.oppositionDeadline?.deadlineDate;
      const daysRemaining = deadline
        ? Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null;
      const pdf = renderDossierPdf({
        organizationName: 'Merkwacht',
        watchedTrademarkName: match.watchedTrademarkLabel,
        generatedAt: new Date().toISOString(),
        totalScore: match.totalScore,
        daysRemaining,
        matches: [
          {
            candidateName: match.candidate.markText,
            jurisdiction: match.candidate.registryCode,
            status: match.status,
            niceClasses: [...match.candidate.niceClasses],
          },
        ],
      });
      return reply
        .header('content-type', 'application/pdf')
        .header('content-disposition', `attachment; filename="match-${match.id}.pdf"`)
        .send(Buffer.from(pdf));
    }

    const csv = toCsv([match], MATCH_EXPORT_COLUMNS);
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="match-${match.id}.csv"`)
      .send(csv);
  });
}
