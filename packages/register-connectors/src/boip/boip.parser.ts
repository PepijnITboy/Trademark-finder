import type { RegisterCode } from '../core/register-types.js';
import { ConnectorParseError } from '../core/register-errors.js';
import {
  boipFileImportSchema,
  boipPublicationsResponseSchema,
  boipTrademarkRecordSchema,
  type BoipFileImport,
  type BoipPublicationsResponse,
  type BoipTrademarkRecord,
} from './boip.schemas.js';

const BOIP_REGISTRY_CODE: RegisterCode = 'BOIP';

/**
 * Parses and validates a raw `GET /v1/publications` response body. Throws
 * {@link ConnectorParseError} (never returns partially-guessed data) when
 * the shape doesn't match {@link boipPublicationsResponseSchema} - see the
 * "no fake data" rule in `docs/connectors/connector-contract.md`.
 */
export function parseBoipPublicationsResponse(body: unknown): BoipPublicationsResponse {
  const result = boipPublicationsResponseSchema.safeParse(body);
  if (!result.success) {
    throw new ConnectorParseError(
      BOIP_REGISTRY_CODE,
      `publications response failed schema validation: ${result.error.message}`,
      { cause: result.error },
    );
  }
  return result.data;
}

/**
 * Parses and validates a raw `GET /v1/trademarks/:registrationNumber`
 * response body. Throws {@link ConnectorParseError} on schema mismatch.
 */
export function parseBoipTrademarkRecord(body: unknown): BoipTrademarkRecord {
  const result = boipTrademarkRecordSchema.safeParse(body);
  if (!result.success) {
    throw new ConnectorParseError(
      BOIP_REGISTRY_CODE,
      `trademark lookup response failed schema validation: ${result.error.message}`,
      { cause: result.error },
    );
  }
  return result.data;
}

/**
 * Parses and validates the contents of a TEMPORARY file/JSON import
 * (see `boip.file-import.adapter.ts`). Throws {@link ConnectorParseError}
 * on schema mismatch, same as the live API parsers above.
 */
export function parseBoipFileImport(body: unknown): BoipFileImport {
  const result = boipFileImportSchema.safeParse(body);
  if (!result.success) {
    throw new ConnectorParseError(
      BOIP_REGISTRY_CODE,
      `file import payload failed schema validation: ${result.error.message}`,
      { cause: result.error },
    );
  }
  return result.data;
}
