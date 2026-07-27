import type { MarkType, ProceduralStatus } from './statuses.js';
import type { OppositionDeadline } from './opposition.js';

/**
 * A single application as published by a trademark register, independent of
 * any customer. See `docs/domain/trademark-model.md`.
 */
export interface CandidateApplication {
  readonly id: string;
  readonly registryCode: string;
  readonly applicationNumber: string;
  readonly markText: string;
  readonly markType: MarkType;
  readonly niceClasses: readonly number[];
  readonly applicantName: string;
  readonly filingDate: string;
  readonly publicationDate: string;
  readonly proceduralStatus: ProceduralStatus;
  readonly oppositionDeadline: OppositionDeadline | null;
  /** Pointer to the archived raw connector payload, for audit purposes only. */
  readonly rawPayloadRef: string | null;
  readonly fetchedAt: string;
}
