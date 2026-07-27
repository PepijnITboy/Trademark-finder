import type { RegisterCode } from '../core/register-types.js';
import {
  ConnectorConfigurationError,
  ConnectorParseError,
  ConnectorRateLimitError,
  ConnectorUpstreamError,
} from '../core/register-errors.js';
import type { ConnectorHealthReport } from '../core/register-types.js';

const BOIP_REGISTRY_CODE: RegisterCode = 'BOIP';

/** Default request timeout, chosen to comfortably exceed typical Datolite p99 latency without hanging a job indefinitely. */
const DEFAULT_TIMEOUT_MS = 10_000;

export interface BoipClientConfig {
  /** Falls back to `BOIP_API_BASE_URL` when omitted. */
  readonly apiBaseUrl?: string | undefined;
  /** Falls back to `BOIP_API_KEY` when omitted. */
  readonly apiKey?: string | undefined;
  readonly fetchImpl?: typeof fetch | undefined;
  /** Per-request timeout in milliseconds. Defaults to {@link DEFAULT_TIMEOUT_MS}. */
  readonly timeoutMs?: number | undefined;
}

/**
 * Thin, typed HTTP client for BOIP's Datolite API. Owns configuration
 * resolution, request timeouts, and translating transport-level failures
 * (timeouts, rate limits, non-2xx responses, invalid JSON) into the shared
 * `RegisterConnectorError` hierarchy so `BoipConnector` never has to touch
 * `fetch` directly. See `docs/connectors/boip.md` and
 * `docs/connectors/connector-contract.md`.
 *
 * NOTE: exact paths/headers are best-effort placeholders pending
 * confirmation against BOIP's official Datolite API documentation.
 */
export class BoipClient {
  private readonly apiBaseUrl: string | undefined;
  private readonly apiKey: string | undefined;
  private readonly fetchImpl: typeof fetch | undefined;
  private readonly timeoutMs: number;

  constructor(config: BoipClientConfig = {}) {
    this.apiBaseUrl = config.apiBaseUrl ?? process.env['BOIP_API_BASE_URL'];
    this.apiKey = config.apiKey ?? process.env['BOIP_API_KEY'];
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  get missingConfigKeys(): readonly string[] {
    const missing: string[] = [];
    if (!this.apiBaseUrl) missing.push('BOIP_API_BASE_URL');
    if (!this.apiKey) missing.push('BOIP_API_KEY');
    return missing;
  }

  get isConfigured(): boolean {
    return this.missingConfigKeys.length === 0;
  }

  /** Throws {@link ConnectorConfigurationError} if `BOIP_API_BASE_URL`/`BOIP_API_KEY` are missing. */
  assertConfigured(): void {
    const missing = this.missingConfigKeys;
    if (missing.length > 0) {
      throw new ConnectorConfigurationError(BOIP_REGISTRY_CODE, missing);
    }
  }

  /**
   * Performs a GET request against the Datolite API and returns the parsed
   * JSON body. Enforces {@link BoipClientConfig.timeoutMs}, respects
   * `Retry-After` on `429` responses, and never returns fabricated data on
   * failure - it always throws one of the `RegisterConnectorError`
   * subclasses instead.
   */
  async get(path: string, searchParams: Readonly<Record<string, string>> = {}): Promise<unknown> {
    const response = await this.execute(path, searchParams);
    if (!response.ok) {
      throw new ConnectorUpstreamError(
        BOIP_REGISTRY_CODE,
        response.status,
        `unexpected status calling ${path}`,
      );
    }
    return this.parseJsonBody(path, response);
  }

  /** Like {@link get}, but returns `null` on a `404` instead of throwing - for lookups where "not found" is a valid, non-error outcome. */
  async getOrNull(path: string, searchParams: Readonly<Record<string, string>> = {}): Promise<unknown | null> {
    const response = await this.execute(path, searchParams);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new ConnectorUpstreamError(
        BOIP_REGISTRY_CODE,
        response.status,
        `unexpected status calling ${path}`,
      );
    }
    return this.parseJsonBody(path, response);
  }

  private async parseJsonBody(path: string, response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch (error) {
      throw new ConnectorParseError(BOIP_REGISTRY_CODE, `response from ${path} was not valid JSON`, {
        cause: error,
      });
    }
  }

  /** Resolves configuration, applies the request timeout, and translates rate-limit responses - shared by {@link get} and {@link getOrNull}. */
  private async execute(
    path: string,
    searchParams: Readonly<Record<string, string>>,
  ): Promise<Response> {
    this.assertConfigured();

    if (!this.fetchImpl) {
      throw new ConnectorUpstreamError(
        BOIP_REGISTRY_CODE,
        null,
        'no fetch implementation available in this runtime',
      );
    }

    const url = new URL(path, this.apiBaseUrl);
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        headers: { Authorization: `Bearer ${this.apiKey}`, Accept: 'application/json' },
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ConnectorUpstreamError(
          BOIP_REGISTRY_CODE,
          null,
          `request to ${path} timed out after ${this.timeoutMs}ms`,
          { cause: error },
        );
      }
      throw new ConnectorUpstreamError(BOIP_REGISTRY_CODE, null, `network error calling ${path}`, {
        cause: error,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 429) {
      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfterMs = retryAfterHeader ? parseRetryAfterMs(retryAfterHeader) : null;
      throw new ConnectorRateLimitError(BOIP_REGISTRY_CODE, retryAfterMs);
    }

    return response;
  }

  /** Probes API reachability without throwing - used by `BoipConnector.healthCheck`. */
  async probeHealth(): Promise<ConnectorHealthReport> {
    const checkedAt = new Date().toISOString();

    if (!this.isConfigured) {
      return {
        status: 'configuration_required',
        message: `BOIP connector is not configured. Missing: ${this.missingConfigKeys.join(', ')}.`,
        checkedAt,
      };
    }

    if (!this.fetchImpl) {
      return { status: 'unavailable', message: 'No fetch implementation available in this runtime.', checkedAt };
    }

    try {
      await this.get('/health');
      return { status: 'ok', message: 'BOIP connector is reachable.', checkedAt };
    } catch (error) {
      if (error instanceof ConnectorRateLimitError) {
        return { status: 'degraded', message: 'BOIP health probe was rate limited.', checkedAt };
      }
      return {
        status: 'unavailable',
        message: `BOIP health probe failed: ${error instanceof Error ? error.message : String(error)}`,
        checkedAt,
      };
    }
  }
}

/** Parses a `Retry-After` header value (seconds, or an HTTP-date) into milliseconds. Returns `null` if unparseable. */
function parseRetryAfterMs(headerValue: string): number | null {
  const asSeconds = Number(headerValue);
  if (Number.isFinite(asSeconds)) {
    return Math.max(0, asSeconds * 1000);
  }

  const asDate = Date.parse(headerValue);
  if (!Number.isNaN(asDate)) {
    return Math.max(0, asDate - Date.now());
  }

  return null;
}
