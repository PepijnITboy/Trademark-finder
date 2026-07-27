import { readFile } from 'node:fs/promises';
import type { RegisteredTrademarkSnapshot } from '@merkwacht/domain';
import type { CandidateApplicationInput } from '../core/register-types.js';
import { parseBoipFileImport } from './boip.parser.js';
import {
  mapBoipPublicationToCandidateApplicationInput,
  mapBoipTrademarkToSnapshot,
} from './boip.mapper.js';

/**
 * *** TEMPORARY ***
 *
 * Manual file/JSON import path for BOIP data, to be used **only** until
 * live Datolite API credentials (`BOIP_API_BASE_URL` / `BOIP_API_KEY`) are
 * provisioned, or for one-off backfills from a BOIP-provided export. This
 * adapter is explicitly **not** part of the `TrademarkRegisterConnector`
 * contract - it must never be wired into the worker's scheduled fetch jobs
 * as a silent substitute for live data. Delete this file (and its call
 * sites) once the real Datolite integration is live and no longer needed
 * for backfills. See the "no fake data" rule in
 * `docs/connectors/connector-contract.md`.
 *
 * Input shape: `{ "publications": [...], "trademarks": [...] }`, using the
 * same field names as the live Datolite API responses (see
 * `boip.schemas.ts`), so the same parser/mapper pipeline is reused.
 */
export interface BoipFileImportResult {
  readonly applications: readonly CandidateApplicationInput[];
  readonly snapshots: readonly RegisteredTrademarkSnapshot[];
}

export class BoipFileImportAdapter {
  /** Imports from an already-parsed JSON value (e.g. `JSON.parse(await response.text())`). */
  importFromObject(raw: unknown, sourceRef: string | null = null): BoipFileImportResult {
    const parsed = parseBoipFileImport(raw);
    const retrievedAt = new Date().toISOString();

    return {
      applications: parsed.publications.map((record) =>
        mapBoipPublicationToCandidateApplicationInput(record, { rawPayloadRef: sourceRef, retrievedAt }),
      ),
      snapshots: parsed.trademarks.map((record) =>
        mapBoipTrademarkToSnapshot(record, { rawPayloadRef: sourceRef, retrievedAt }),
      ),
    };
  }

  /** Reads and imports a local JSON file. `filePath` is also used as `rawPayloadRef` for audit purposes. */
  async importFromFile(filePath: string): Promise<BoipFileImportResult> {
    const contents = await readFile(filePath, 'utf-8');
    const raw: unknown = JSON.parse(contents);
    return this.importFromObject(raw, filePath);
  }
}
