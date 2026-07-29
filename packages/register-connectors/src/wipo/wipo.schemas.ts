import { z } from 'zod';

/**
 * Shape of a single Madrid transaction record after extraction from ST.66
 * XML by `wipo.st66-parser.ts`. ST.66 (WIPO Standard ST.66, "Recommendation
 * for the Processing of Industrial Property Information Using XML") is the
 * real wire format WIPO's Madrid FTP feed uses; this schema is the
 * flattened subset of ST.66's `TransactionData` element this connector
 * extracts, not a full ST.66 XML schema. Validate against real WIPO daily
 * delta files before production use - see `docs/connectors/wipo.md`.
 */
export const wipoTransactionRecordSchema = z.object({
  applicationNumber: z.string().min(1),
  markText: z.string().min(1),
  niceClasses: z.array(z.number().int().min(1).max(45)).min(1),
  applicantName: z.string().min(1),
  filingDate: z.string().min(1),
  publicationDate: z.string().min(1),
  status: z.string().optional(),
});
export type WipoTransactionRecord = z.infer<typeof wipoTransactionRecordSchema>;
