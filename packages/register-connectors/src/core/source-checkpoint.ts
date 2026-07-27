import type { RegisterCode } from './register-types.js';

/**
 * Opaque, per-connector cursor persisted between `fetch_publications` runs
 * (backed by the `source_checkpoint` table, see `docs/database/schema.md`).
 * Only the connector that wrote a checkpoint's `cursor` should interpret its
 * shape — everything else must treat it as opaque `unknown`.
 */
export interface SourceCheckpoint {
  readonly registryCode: RegisterCode;
  readonly cursor: unknown;
  readonly updatedAt: string;
}
