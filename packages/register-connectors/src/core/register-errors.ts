import type { RegisterCode } from './register-types.js';

/** Base class for all register connector errors. Always carries the offending `registryCode`. */
export abstract class RegisterConnectorError extends Error {
  abstract readonly code: string;

  protected constructor(
    readonly registryCode: RegisterCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}

/**
 * Required configuration (API key, base URL, etc.) is missing or invalid.
 * Connectors must throw this instead of making a doomed network call, and
 * must never substitute fabricated data. Maps to `configuration_required`
 * health. See `docs/connectors/connector-contract.md`.
 */
export class ConnectorConfigurationError extends RegisterConnectorError {
  readonly code = 'configuration_required';

  constructor(registryCode: RegisterCode, missing: readonly string[]) {
    super(
      registryCode,
      `${registryCode} connector is missing required configuration: ${missing.join(', ')}`,
    );
  }
}

/** The register rejected/limited the request rate. Carries a retry hint when the register provides one. */
export class ConnectorRateLimitError extends RegisterConnectorError {
  readonly code = 'rate_limited';

  constructor(
    registryCode: RegisterCode,
    readonly retryAfterMs: number | null,
    options?: { cause?: unknown },
  ) {
    super(registryCode, `${registryCode} connector was rate limited`, options);
  }
}

/** The register returned an unexpected error/5xx response. */
export class ConnectorUpstreamError extends RegisterConnectorError {
  readonly code = 'upstream_error';

  constructor(
    registryCode: RegisterCode,
    readonly statusCode: number | null,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(registryCode, `${registryCode} connector upstream error: ${message}`, options);
  }
}

/**
 * The register returned data that could not be mapped to a domain type.
 * This usually means the upstream response shape changed. Must be logged
 * loudly and must never be silently papered over with guessed/partial
 * fields.
 */
export class ConnectorParseError extends RegisterConnectorError {
  readonly code = 'parse_error';

  constructor(registryCode: RegisterCode, message: string, options?: { cause?: unknown }) {
    super(registryCode, `${registryCode} connector could not parse upstream response: ${message}`, options);
  }
}
