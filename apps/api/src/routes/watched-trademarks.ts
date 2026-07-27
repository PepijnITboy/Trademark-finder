import {
  boipV1WatchEligibilityPolicy,
  type RegisteredTrademarkSnapshot,
  type WatchEligibilityDecision,
} from '@merkwacht/domain';
import {
  BOIP_FIXTURE_TRADEMARK_REGISTRATIONS,
  mapBoipTrademarkToSnapshot,
} from '@merkwacht/register-connectors';
import { AppError } from '@merkwacht/shared';
import { watchedTrademarkLookupSchema } from '@merkwacht/validation';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

const createWatchedTrademarkSchema = z.object({
  label: z.string().trim().min(1, 'Label is verplicht.').max(300),
  notes: z.string().trim().max(2000).optional(),
  registryCode: z.string().trim().min(1, 'Registercode is verplicht.'),
  registrationNumber: z.string().trim().min(1, 'Registratienummer is verplicht.'),
});

const updateSettingsSchema = z.object({
  label: z.string().trim().min(1).max(300).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

interface LookupCandidate {
  readonly registryCode: string;
  readonly registrationNumber: string;
  readonly markText: string;
  readonly markType: string;
  readonly niceClasses: readonly number[];
  readonly applicantName: string;
  readonly filingDate: string;
  readonly registrationDate: string | null;
  readonly registerStatus: string;
  readonly eligibility: WatchEligibilityDecision;
}

function toLookupCandidate(snapshot: RegisteredTrademarkSnapshot): LookupCandidate {
  return {
    registryCode: snapshot.registryCode,
    registrationNumber: snapshot.registrationNumber,
    markText: snapshot.markText,
    markType: snapshot.markType,
    niceClasses: snapshot.niceClasses,
    applicantName: snapshot.applicantName,
    filingDate: snapshot.filingDate,
    registrationDate: snapshot.registrationDate,
    registerStatus: snapshot.registerStatus,
    eligibility: boipV1WatchEligibilityPolicy.evaluate(snapshot),
  };
}

function getOrganizationId(app: FastifyInstance): string {
  return app.identityProvider.getIdentity().organizationId;
}

function notFound(reply: FastifyReply, referenceCode: string): FastifyReply {
  return reply.status(404).send({
    code: 'WATCHED_TRADEMARK_NOT_FOUND',
    messageNl: 'Het opgevraagde watched-merk bestaat niet (of niet binnen uw organisatie).',
    referenceCode,
  });
}

/**
 * `/api/v1/watched-trademarks` - CRUD plus lifecycle (pause/resume/archive)
 * for a customer's watched trademarks, and the `lookup` flow that resolves
 * a BOIP registration and its {@link WatchEligibilityDecision} before it is
 * watched. Scoped to `DevIdentityProvider`'s hardcoded dev organization
 * until real multi-tenant auth lands - see `docs/security/security-model.md`.
 */
export async function registerWatchedTrademarkRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (request: FastifyRequest) => {
    const organizationId = getOrganizationId(app);
    const watchedTrademarks = await app.store.listWatchedTrademarks(organizationId);
    app.appLogger.debug('Watched-merken opgehaald.', { correlationId: request.correlationId, count: watchedTrademarks.length });
    return { watchedTrademarks };
  });

  app.post('/lookup', async (request: FastifyRequest) => {
    const input = watchedTrademarkLookupSchema.parse(request.body);
    const results = await lookupBoipCandidates(app, input.query);

    const niceFiltered = input.niceClasses
      ? results.filter((candidate) => candidate.niceClasses.some((klass) => input.niceClasses?.includes(klass)))
      : results;

    const start = (input.page - 1) * input.pageSize;
    const page = niceFiltered.slice(start, start + input.pageSize);

    return {
      query: input.query,
      page: input.page,
      pageSize: input.pageSize,
      total: niceFiltered.length,
      results: page,
    };
  });

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const organizationId = getOrganizationId(app);
    const input = createWatchedTrademarkSchema.parse(request.body);

    const snapshot = await app.boipConnector.fetchTrademarkByNumber(input.registrationNumber);
    if (!snapshot) {
      throw new AppError({
        code: 'REGISTRATION_NOT_FOUND',
        messageNl: `Geen registratie gevonden bij ${input.registryCode} met nummer ${input.registrationNumber}.`,
        category: 'NOT_FOUND',
      });
    }

    const eligibility = boipV1WatchEligibilityPolicy.evaluate(snapshot);
    const record = await app.store.createWatchedTrademark(organizationId, {
      label: input.label,
      notes: input.notes ?? null,
      registryCode: snapshot.registryCode,
      registrationNumber: snapshot.registrationNumber,
      markText: snapshot.markText,
      niceClasses: snapshot.niceClasses,
      eligibility,
    });

    return reply.status(201).send({ watchedTrademark: record });
  });

  app.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const organizationId = getOrganizationId(app);
    const record = await app.store.getWatchedTrademark(organizationId, request.params.id);
    if (!record) return notFound(reply, request.correlationId ?? request.params.id);
    return { watchedTrademark: record };
  });

  app.patch(
    '/:id/settings',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const organizationId = getOrganizationId(app);
      const patch = updateSettingsSchema.parse(request.body);
      const updated = await app.store.updateWatchedTrademarkSettings(organizationId, request.params.id, patch);
      if (!updated) return notFound(reply, request.correlationId ?? request.params.id);
      return { watchedTrademark: updated };
    },
  );

  registerStatusTransition(app, 'pause', 'paused');
  registerStatusTransition(app, 'resume', 'active');
  registerStatusTransition(app, 'archive', 'archived');
}

function registerStatusTransition(
  app: FastifyInstance,
  action: 'pause' | 'resume' | 'archive',
  status: 'paused' | 'active' | 'archived',
): void {
  app.post(`/:id/${action}`, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const organizationId = getOrganizationId(app);
    const updated = await app.store.setWatchedTrademarkStatus(organizationId, request.params.id, status);
    if (!updated) return notFound(reply, request.correlationId ?? request.params.id);
    return { watchedTrademark: updated };
  });
}

/**
 * Resolves lookup candidates from BOIP.
 *
 * - Fixture mode (`BOIP_USE_FIXTURES=true`): free-text, case-insensitive
 *   substring search over the fictitious fixture registrations, so local
 *   development/demos can exercise the full lookup -> eligibility flow.
 * - Live mode: BOIP's `TrademarkRegisterConnector` contract only supports
 *   exact lookup by registration number (`fetchTrademarkByNumber`), not a
 *   name search endpoint (unconfirmed against the live Datolite API - see
 *   `docs/connectors/boip.md`). `query` is therefore treated as an exact
 *   registration number in live mode.
 * - Unconfigured (no credentials, fixtures disabled): throws a clear
 *   `CONFIGURATION` error rather than returning an empty/fake result.
 */
async function lookupBoipCandidates(app: FastifyInstance, query: string): Promise<LookupCandidate[]> {
  if (app.appEnv.BOIP_USE_FIXTURES) {
    const normalizedQuery = query.trim().toLowerCase();
    return BOIP_FIXTURE_TRADEMARK_REGISTRATIONS.filter((record) =>
      record.markText.toLowerCase().includes(normalizedQuery),
    ).map((record) => toLookupCandidate(mapBoipTrademarkToSnapshot(record)));
  }

  const health = await app.boipConnector.healthCheck();
  if (health.status === 'configuration_required') {
    throw new AppError({
      code: 'BOIP_NOT_CONFIGURED',
      messageNl:
        'De BOIP-registerkoppeling is niet geconfigureerd. Stel BOIP_API_BASE_URL en BOIP_API_KEY in, of gebruik BOIP_USE_FIXTURES=true voor lokale ontwikkeling.',
      category: 'CONFIGURATION',
    });
  }

  const snapshot = await app.boipConnector.fetchTrademarkByNumber(query.trim());
  return snapshot ? [toLookupCandidate(snapshot)] : [];
}
