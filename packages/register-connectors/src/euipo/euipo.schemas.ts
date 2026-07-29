import { z } from 'zod';

/**
 * Zod schemas for EUIPO's Trademark Search / Open Data API responses.
 *
 * NOTE: field names/shapes are best-effort placeholders modeled after the
 * publicly documented EUIPO Trademark Search REST API and MUST be
 * validated against real API responses before production use - see
 * `docs/connectors/euipo.md`. Kept as `zod` schemas (rather than ad-hoc
 * type guards) for the same reason as `../boip/boip.schemas.ts`: an
 * upstream shape change fails loudly instead of silently coercing bad
 * data.
 */

export const euipoMarkTypeSchema = z.enum(['WORD', 'FIGURATIVE', 'COMBINED', 'OTHER']);

/** A single EU trademark publication as returned by the Trademark Search publications feed. */
export const euipoPublicationRecordSchema = z.object({
  applicationNumber: z.string().min(1),
  markText: z.string().min(1),
  markFeature: euipoMarkTypeSchema.optional(),
  niceClasses: z.array(z.number().int().min(1).max(45)),
  applicantName: z.string().min(1),
  filingDate: z.string().min(1),
  publicationDate: z.string().min(1),
  status: z.string().optional(),
});
export type EuipoPublicationRecord = z.infer<typeof euipoPublicationRecordSchema>;

/** Envelope returned by `GET /trademark-search/trademarks`. */
export const euipoPublicationsResponseSchema = z.object({
  items: z.array(euipoPublicationRecordSchema),
  nextCursor: z.union([z.string(), z.number()]).nullable().optional(),
  hasMore: z.boolean().optional(),
});
export type EuipoPublicationsResponse = z.infer<typeof euipoPublicationsResponseSchema>;

/** A single EU trademark registration as returned by `GET /trademark-search/trademarks/:applicationNumber`. */
export const euipoTrademarkRecordSchema = z.object({
  registrationNumber: z.string().min(1),
  markText: z.string().min(1),
  markFeature: euipoMarkTypeSchema.optional(),
  niceClasses: z.array(z.number().int().min(1).max(45)),
  applicantName: z.string().min(1),
  filingDate: z.string().min(1),
  registrationDate: z.string().nullable().optional(),
  status: z.string().optional(),
});
export type EuipoTrademarkRecord = z.infer<typeof euipoTrademarkRecordSchema>;

/** OAuth2 client-credentials token response from EUIPO's identity provider. */
export const euipoOAuthTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive().optional(),
  token_type: z.string().optional(),
});
export type EuipoOAuthTokenResponse = z.infer<typeof euipoOAuthTokenResponseSchema>;
