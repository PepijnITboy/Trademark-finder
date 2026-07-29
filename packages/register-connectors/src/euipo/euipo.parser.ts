import type { RegisterCode } from '../core/register-types.js';
import { ConnectorParseError } from '../core/register-errors.js';
import {
  euipoPublicationsResponseSchema,
  euipoTrademarkRecordSchema,
  type EuipoPublicationsResponse,
  type EuipoTrademarkRecord,
} from './euipo.schemas.js';

const EUIPO_REGISTRY_CODE: RegisterCode = 'EUIPO';

/** Parses and validates a raw `GET /trademark-search/trademarks` response body. Throws {@link ConnectorParseError} on schema mismatch. */
export function parseEuipoPublicationsResponse(body: unknown): EuipoPublicationsResponse {
  const result = euipoPublicationsResponseSchema.safeParse(body);
  if (!result.success) {
    throw new ConnectorParseError(
      EUIPO_REGISTRY_CODE,
      `publications response failed schema validation: ${result.error.message}`,
      { cause: result.error },
    );
  }
  return result.data;
}

/** Parses and validates a raw single-trademark lookup response body. Throws {@link ConnectorParseError} on schema mismatch. */
export function parseEuipoTrademarkRecord(body: unknown): EuipoTrademarkRecord {
  const result = euipoTrademarkRecordSchema.safeParse(body);
  if (!result.success) {
    throw new ConnectorParseError(
      EUIPO_REGISTRY_CODE,
      `trademark lookup response failed schema validation: ${result.error.message}`,
      { cause: result.error },
    );
  }
  return result.data;
}
