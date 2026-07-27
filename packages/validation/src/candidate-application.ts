import { z } from 'zod';

/**
 * Mirrors `@merkwacht/domain`'s `MARK_TYPES` (`packages/domain/src/statuses.ts`).
 * Duplicated rather than imported so `@merkwacht/validation` stays a
 * dependency-free Layer 0 package (see
 * `docs/architecture/module-boundaries.md`) - keep in sync manually if the
 * domain vocabulary ever changes.
 */
export const markTypeSchema = z.enum(['word', 'figurative', 'combined', 'other']);

/** Mirrors `@merkwacht/domain`'s `PROCEDURAL_STATUSES`. */
export const proceduralStatusSchema = z.enum([
  'filed',
  'published',
  'opposition_period',
  'registered',
  'opposed',
  'withdrawn',
  'refused',
  'expired',
]);

export const niceClassificationSchema = z.number().int().min(1).max(45);

/**
 * Validates a connector's raw fetch output before it is trusted by
 * `apps/worker`'s ingestion pipelines (`daily-sync-pipeline.ts`) - the
 * defensive input-validation boundary called for in
 * `docs/security/security-model.md`'s "Input validation" section:
 * "connector responses before they're mapped into domain types" must be
 * validated with `packages/validation`. Mirrors
 * `@merkwacht/register-connectors`' `CandidateApplicationInput` shape
 * (`Omit<CandidateApplication, 'id' | 'oppositionDeadline'> & { oppositionDeadline?: ... }`).
 */
export const candidateApplicationInputSchema = z.object({
  registryCode: z.string().trim().min(1, 'registryCode is verplicht.'),
  applicationNumber: z.string().trim().min(1, 'applicationNumber is verplicht.'),
  markText: z.string().trim().min(1, 'markText is verplicht.').max(500),
  markType: markTypeSchema,
  niceClasses: z.array(niceClassificationSchema),
  applicantName: z.string().trim().min(1, 'applicantName is verplicht.'),
  filingDate: z.string().trim().min(1, 'filingDate is verplicht.'),
  publicationDate: z.string().trim().min(1, 'publicationDate is verplicht.'),
  proceduralStatus: proceduralStatusSchema,
  rawPayloadRef: z.string().nullable(),
  fetchedAt: z.string().trim().min(1, 'fetchedAt is verplicht.'),
  // `oppositionDeadline` is intentionally left as `z.unknown().optional()`
  // here: it is a rich, register-specific object computed downstream by
  // `calculate_opposition_deadlines`, not something a connector is
  // expected to supply at fetch time. Validating its full shape belongs to
  // `@merkwacht/opposition-rules`, not this fetch-boundary schema.
  oppositionDeadline: z.unknown().optional(),
});
export type CandidateApplicationInputShape = z.infer<typeof candidateApplicationInputSchema>;
