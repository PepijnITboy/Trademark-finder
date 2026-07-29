import type { RegisterCode } from '../core/register-types.js';
import {
  ConnectorConfigurationError,
  ConnectorParseError,
  ConnectorRateLimitError,
  ConnectorUpstreamError,
} from '../core/register-errors.js';
import type { ConnectorHealthReport } from '../core/register-types.js';

/** Default request timeout, matching `../boip/boip.client.ts`. */
const DEFAULT_TIMEOUT_MS = 10_000;

export interface GenericHttpClientConfig {
  readonly registryCode: RegisterCode;
  /** e.g. `EUIPO` -> falls back to `EUIPO_API_BASE_URL` when `apiBaseUrl` is omitted. */
  readonly envPrefix: string;
  readonly apiBaseUrl?: string | undefined;
  readonly apiKey?: string | undefined;
  readonly fetchImpl?: typeof fetch | undefined;
  readonly timeoutMs?: number | undefined;
  /** Path probed by {@link GenericHttpClient.probeHealth}. Defaults to `/health`. */
  readonly healthPath?: string | undefined;
}

/**
 * Thin, typed HTTP client shared by every register wired through
 * `createConfiguredHttpConnector`. Structurally identical to
 * `../boip/boip.client.ts` (bearer-token auth, JSON GET, timeout,
 * rate-limit/parse-error translation) but parameterized by `envPrefix` so
 * one implementation serves ~35 registers instead of duplicating this file
 * per register. Deep connectors (EUIPO, USPTO, WIPO) use their own
 * register-specific clients instead, since their real APIs need
 * OAuth/FTP/TSDR-specific handling this generic client doesn't attempt.
 */
export class GenericHttpClient {
  private readonly registryCode: RegisterCode;
  private readonly envPrefix: string;
  private readonly apiBaseUrl: string | undefined;
  private readonly apiKey: string | undefined;
  private readonly fetchImpl: typeof fetch | undefined;
  private readonly timeoutMs: number;
  private readonly healthPath: string;

  constructor(config: GenericHttpClientConfig) {
    this.registryCode = config.registryCode;
    this.envPrefix = config.envPrefix;
    this.apiBaseUrl = config.apiBaseUrl ?? process.env[`${config.envPrefix}_API_BASE_URL`];
    this.apiKey = config.apiKey ?? process.env[`${config.envPrefix}_API_KEY`];
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.healthPath = config.healthPath ?? '/health';
  }

  get missingConfigKeys(): readonly string[] {
    const missing: string[] = [];
    if (!this.apiBaseUrl) missing.push(`${this.envPrefix}_API_BASE_URL`);
    if (!this.apiKey) missing.push(`${this.envPrefix}_API_KEY`);
    return missing;
  }

  get isConfigured(): boolean {
    return this.missingConfigKeys.length === 0;
  }

  /** Throws {@link ConnectorConfigurationError} if the base URL/API key are missing. */
  assertConfigured(): void {
    const missing = this.missingConfigKeys;
    if (missing.length > 0) {
      throw new ConnectorConfigurationError(this.registryCode, missing);
    }
  }

  async get(path: string, searchParams: Readonly<Record<string, string>> = {}): Promise<unknown> {
    const response = await this.execute(path, searchParams);
    if (!response.ok) {
      throw new ConnectorUpstreamError(this.registryCode, response.status, `unexpected status calling ${path}`);
    }
    return this.parseJsonBody(path, response);
  }

  /** Like {@link get}, but returns `null` on a `404` - for lookups where "not found" is a valid outcome. */
  async getOrNull(path: string, searchParams: Readonly<Record<string, string>> = {}): Promise<unknown | null> {
    const response = await this.execute(path, searchParams);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new ConnectorUpstreamError(this.registryCode, response.status, `unexpected status calling ${path}`);
    }
    return this.parseJsonBody(path, response);
  }

  private async parseJsonBody(path: string, response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch (error) {
      throw new ConnectorParseError(this.registryCode, `response from ${path} was not valid JSON`, {
        cause: error,
      });
    }
  }

  private async execute(path: string, searchParams: Readonly<Record<string, string>>): Promise<Response> {
    this.assertConfigured();

    if (!this.fetchImpl) {
      throw new ConnectorUpstreamError(this.registryCode, null, 'no fetch implementation available in this runtime');
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
        throw new ConnectorUpstreamError(this.registryCode, null, `request to ${path} timed out after ${this.timeoutMs}ms`, {
          cause: error,
        });
      }
      throw new ConnectorUpstreamError(this.registryCode, null, `network error calling ${path}`, { cause: error });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 429) {
      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfterMs = retryAfterHeader ? parseRetryAfterMs(retryAfterHeader) : null;
      throw new ConnectorRateLimitError(this.registryCode, retryAfterMs);
    }

    return response;
  }

  /** Probes API reachability without throwing - used by the connector's `healthCheck`. */
  async probeHealth(): Promise<ConnectorHealthReport> {
    const checkedAt = new Date().toISOString();

    if (!this.isConfigured) {
      return {
        status: 'configuration_required',
        message: `${this.registryCode} connector is not configured. Missing: ${this.missingConfigKeys.join(', ')}.`,
        checkedAt,
      };
    }

    if (!this.fetchImpl) {
      return { status: 'unavailable', message: 'No fetch implementation available in this runtime.', checkedAt };
    }

    try {
      await this.get(this.healthPath);
      return { status: 'ok', message: `${this.registryCode} connector is reachable.`, checkedAt };
    } catch (error) {
      if (error instanceof ConnectorRateLimitError) {
        return { status: 'degraded', message: `${this.registryCode} health probe was rate limited.`, checkedAt };
      }
      return {
        status: 'unavailable',
        message: `${this.registryCode} health probe failed: ${error instanceof Error ? error.message : String(error)}`,
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
