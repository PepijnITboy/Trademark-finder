import { z } from 'zod';

/**
 * Zod schemas for USPTO data. USPTO exposes two, functionally distinct
 * data sources this connector uses (see `docs/connectors/uspto.md`):
 *
 * 1. **TSDR** (Trademark Status & Document Retrieval) - single-mark case
 *    status lookups by serial/registration number, requires
 *    `USPTO_API_KEY`. The real TSDR JSON response is a deeply nested case
 *    file structure; `usptoCaseStatusRecordSchema` below is the flattened
 *    subset this connector extracts and MUST be validated against a real
 *    TSDR response before production use.
 * 2. **Trademark Official Gazette** weekly publication feed - newly
 *    published applications, used for opposition-window tracking.
 *    USPTO does not expose this as a simple incremental JSON API out of
 *    the box; `usptoGazettePublicationRecordSchema` models the shape a
 *    configured `USPTO_GAZETTE_FEED_URL` (an operator-provided JSON proxy
 *    in front of the weekly XML/bulk data) is expected to return.
 */

export const usptoCaseStatusRecordSchema = z.object({
  registrationNumber: z.string().min(1),
  markText: z.string().min(1),
  niceClasses: z.array(z.number().int().min(1).max(45)),
  applicantName: z.string().min(1),
  filingDate: z.string().min(1),
  registrationDate: z.string().nullable().optional(),
  status: z.string().optional(),
});
export type UsptoCaseStatusRecord = z.infer<typeof usptoCaseStatusRecordSchema>;

export const usptoGazettePublicationRecordSchema = z.object({
  applicationNumber: z.string().min(1),
  markText: z.string().min(1),
  niceClasses: z.array(z.number().int().min(1).max(45)),
  applicantName: z.string().min(1),
  filingDate: z.string().min(1),
  publicationDate: z.string().min(1),
  status: z.string().optional(),
});
export type UsptoGazettePublicationRecord = z.infer<typeof usptoGazettePublicationRecordSchema>;

export const usptoGazetteResponseSchema = z.object({
  items: z.array(usptoGazettePublicationRecordSchema),
  nextCursor: z.union([z.string(), z.number()]).nullable().optional(),
  hasMore: z.boolean().optional(),
});
export type UsptoGazetteResponse = z.infer<typeof usptoGazetteResponseSchema>;
