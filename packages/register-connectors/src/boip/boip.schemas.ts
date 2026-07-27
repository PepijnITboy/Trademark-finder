import { z } from 'zod';

/**
 * Zod schemas for BOIP's Datolite API responses.
 *
 * NOTE: field names/shapes are best-effort placeholders modeled after the
 * publicly documented Datolite trademark search/publication feed and MUST
 * be validated against a real Datolite response before production use -
 * see `docs/connectors/boip.md`. Keeping them as `zod` schemas (rather than
 * ad-hoc type guards) means an upstream shape change fails loudly with a
 * precise validation error instead of silently coercing bad data.
 */

export const boipMarkTypeSchema = z.enum(['WORD', 'FIGURATIVE', 'COMBINED', 'OTHER']);

/** A single trademark publication as returned by the Datolite publications feed. */
export const boipPublicationRecordSchema = z.object({
  applicationNumber: z.string().min(1),
  markText: z.string().min(1),
  markType: boipMarkTypeSchema.optional(),
  niceClasses: z.array(z.number().int().min(1).max(45)),
  applicantName: z.string().min(1),
  filingDate: z.string().min(1),
  publicationDate: z.string().min(1),
  proceduralStatus: z.string().optional(),
});
export type BoipPublicationRecord = z.infer<typeof boipPublicationRecordSchema>;

/** Envelope returned by `GET /v1/publications`. */
export const boipPublicationsResponseSchema = z.object({
  items: z.array(boipPublicationRecordSchema),
  nextCursor: z.union([z.string(), z.number()]).nullable().optional(),
  hasMore: z.boolean().optional(),
});
export type BoipPublicationsResponse = z.infer<typeof boipPublicationsResponseSchema>;

/** A single trademark registration as returned by `GET /v1/trademarks/:registrationNumber`. */
export const boipTrademarkRecordSchema = z.object({
  registrationNumber: z.string().min(1),
  markText: z.string().min(1),
  markType: boipMarkTypeSchema.optional(),
  niceClasses: z.array(z.number().int().min(1).max(45)),
  applicantName: z.string().min(1),
  filingDate: z.string().min(1),
  registrationDate: z.string().nullable().optional(),
  registerStatus: z.string().optional(),
});
export type BoipTrademarkRecord = z.infer<typeof boipTrademarkRecordSchema>;

/**
 * Shape accepted by {@link BoipFileImportAdapter} - a JSON export/dump
 * containing zero or more publications and/or trademark registrations.
 * TEMPORARY, see `boip.file-import.adapter.ts`.
 */
export const boipFileImportSchema = z.object({
  publications: z.array(boipPublicationRecordSchema).default([]),
  trademarks: z.array(boipTrademarkRecordSchema).default([]),
});
export type BoipFileImport = z.infer<typeof boipFileImportSchema>;
