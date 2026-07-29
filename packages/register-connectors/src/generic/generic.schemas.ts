import { z } from 'zod';
import type { RegisterCode } from '../core/register-types.js';
import { ConnectorParseError } from '../core/register-errors.js';

/**
 * Zod schemas shared by every register wired through
 * `createConfiguredHttpConnector`.
 */

export const genericMarkTypeSchema = z.enum(['WORD', 'FIGURATIVE', 'COMBINED', 'OTHER']);

export const genericPublicationRecordSchema = z.object({
  applicationNumber: z.string().min(1),
  markText: z.string().min(1),
  markType: genericMarkTypeSchema.optional(),
  niceClasses: z.array(z.number().int().min(1).max(45)),
  applicantName: z.string().min(1),
  filingDate: z.string().min(1),
  publicationDate: z.string().min(1),
  proceduralStatus: z.string().optional(),
});
export type GenericPublicationRecord = z.infer<typeof genericPublicationRecordSchema>;

export const genericPublicationsResponseSchema = z.object({
  items: z.array(genericPublicationRecordSchema),
  nextCursor: z.union([z.string(), z.number()]).nullable().optional(),
  hasMore: z.boolean().optional(),
});
export type GenericPublicationsResponse = z.infer<typeof genericPublicationsResponseSchema>;

export const genericTrademarkRecordSchema = z.object({
  registrationNumber: z.string().min(1),
  markText: z.string().min(1),
  markType: genericMarkTypeSchema.optional(),
  niceClasses: z.array(z.number().int().min(1).max(45)),
  applicantName: z.string().min(1),
  filingDate: z.string().min(1),
  registrationDate: z.string().nullable().optional(),
  registerStatus: z.string().optional(),
});
export type GenericTrademarkRecord = z.infer<typeof genericTrademarkRecordSchema>;

export function parseGenericPublicationsResponse(
  registryCode: RegisterCode,
  body: unknown,
): GenericPublicationsResponse {
  const parsed = genericPublicationsResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new ConnectorParseError(registryCode, parsed.error.message);
  }
  return parsed.data;
}

export function parseGenericTrademarkRecord(
  registryCode: RegisterCode,
  body: unknown,
): GenericTrademarkRecord {
  const parsed = genericTrademarkRecordSchema.safeParse(body);
  if (!parsed.success) {
    throw new ConnectorParseError(registryCode, parsed.error.message);
  }
  return parsed.data;
}
