import type { RegisterCode } from '../core/register-types.js';
import {
  ConnectorConfigurationError,
  ConnectorParseError,
  ConnectorRateLimitError,
  ConnectorUpstreamError,
} from '../core/register-errors.js';
import type { ConnectorHealthReport } from '../core/register-types.js';
import { euipoOAuthTokenResponseSchema } from './euipo.schemas.js';

const EUIPO_REGISTRY_CODE: RegisterCode = 'EUIPO';
const DEFAULT_TIMEOUT_MS = 10_000;
/** Refresh the cached token this many milliseconds before its reported expiry, to avoid racing an in-flight request against token expiry. */
const TOKEN_EXPIRY_SAFETY_MARGIN_MS = 30_000;

export interface EuipoOAuthClientConfig {
  /** Falls back to `EUIPO_API_BASE_URL` when omitted. Defaults to EUIPO's production Trademark Search API. */
  readonly apiBaseUrl?: string | undefined;
  /** OAuth2 token endpoint. Falls back to `EUIPO_TOKEN_URL`, then `${apiBaseUrl}/oauth2/token`. */
  readonly tokenUrl?: string | undefined;
  /** Falls back to `EUIPO_CLIENT_ID`. */
  readonly clientId?: string | undefined;
  /** Falls back to `EUIPO_CLIENT_SECRET`. */
  readonly clientSecret?: string | undefined;
  /**
   * EUIPO also publishes a subset of register data as downloadable,
   * unauthenticated "open data" bulk extracts (see
   * `docs/connectors/euipo.md`). When OAuth credentials are absent but
   * this is configured (falls back to `EUIPO_OPEN_DATA_BASE_URL`), the
   * client can still serve read-only publication data without a client
   * secret - useful for smaller integrations that don't need full
   * Trademark Search API access.
   */
  readonly openDataBaseUrl?: string | undefined;
  readonly fetchImpl?: typeof fetch | undefined;
  readonly timeoutMs?: number | undefined;
}

/**
 * OAuth2-client-credentials-aware HTTP client for EUIPO's Trademark Search
 * API, with a fallback to EUIPO's unauthenticated Open Data bulk extracts
 * when OAuth credentials aren't configured. Mirrors `../boip/boip.client.ts`
 * in structure (timeout handling, rate-limit/parse-error translation) but
 * adds token acquisition/caching on top. See `docs/connectors/euipo.md` and
 * `docs/connectors/connector-contract.md`.
 *
 * NOTE: exact OAuth/API paths are best-effort placeholders pending
 * confirmation against EUIPO's official developer portal documentation.
 */
export class EuipoOAuthClient {
  private readonly apiBaseUrl: string | undefined;
  private readonly tokenUrl: string | undefined;
  private readonly clientId: string | undefined;
  private readonly clientSecret: string | undefined;
  private readonly openDataBaseUrl: string | undefined;
  private readonly fetchImpl: typeof fetch | undefined;
  private readonly timeoutMs: number;

  private cachedToken: { accessToken: string; expiresAt: number } | undefined;

  constructor(config: EuipoOAuthClientConfig = {}) {
    this.apiBaseUrl =
      config.apiBaseUrl ?? process.env['EUIPO_API_BASE_URL'] ?? 'https://api.euipo.europa.eu/trademark-search';
    this.tokenUrl = config.tokenUrl ?? process.env['EUIPO_TOKEN_URL'];
    this.clientId = config.clientId ?? process.env['EUIPO_CLIENT_ID'];
    this.clientSecret = config.clientSecret ?? process.env['EUIPO_CLIENT_SECRET'];
    this.openDataBaseUrl = config.openDataBaseUrl ?? process.env['EUIPO_OPEN_DATA_BASE_URL'];
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** `true` once either OAuth credentials or an open-data base URL are present - see class doc for why both count as "configured". */
  get isConfigured(): boolean {
    return this.hasOAuthCredentials || this.hasOpenDataFallback;
  }

  get hasOAuthCredentials(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  get hasOpenDataFallback(): boolean {
    return Boolean(this.openDataBaseUrl);
  }

  get missingConfigKeys(): readonly string[] {
    if (this.isConfigured) return [];
    return ['EUIPO_CLIENT_ID', 'EUIPO_CLIENT_SECRET', 'EUIPO_OPEN_DATA_BASE_URL (alternative to OAuth)'];
  }

  assertConfigured(): void {
    if (!this.isConfigured) {
      throw new ConnectorConfigurationError(EUIPO_REGISTRY_CODE, this.missingConfigKeys);
    }
  }

  /**
   * Acquires (and caches) an OAuth2 client-credentials access token.
   * Throws {@link ConnectorConfigurationError} if `EUIPO_CLIENT_ID`/
   * `EUIPO_CLIENT_SECRET` aren't set - callers should check
   * {@link hasOAuthCredentials} first if an open-data fallback is
   * acceptable instead.
   */
  async getAccessToken(): Promise<string> {
    if (!this.hasOAuthCredentials) {
      throw new ConnectorConfigurationError(EUIPO_REGISTRY_CODE, ['EUIPO_CLIENT_ID', 'EUIPO_CLIENT_SECRET']);
    }
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.accessToken;
    }

    if (!this.fetchImpl) {
      throw new ConnectorUpstreamError(EUIPO_REGISTRY_CODE, null, 'no fetch implementation available in this runtime');
    }

    const tokenUrl = this.tokenUrl ?? new URL('/oauth2/token', this.apiBaseUrl).toString();
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId ?? '',
      client_secret: this.clientSecret ?? '',
    });

    let response: Response;
    try {
      response = await this.fetchImpl(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body,
      });
    } catch (error) {
      throw new ConnectorUpstreamError(EUIPO_REGISTRY_CODE, null, 'network error acquiring OAuth token', {
        cause: error,
      });
    }

    if (!response.ok) {
      throw new ConnectorUpstreamError(EUIPO_REGISTRY_CODE, response.status, 'OAuth token request failed');
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch (error) {
      throw new ConnectorParseError(EUIPO_REGISTRY_CODE, 'OAuth token response was not valid JSON', { cause: error });
    }

    const parsed = euipoOAuthTokenResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new ConnectorParseError(EUIPO_REGISTRY_CODE, `OAuth token response failed schema validation: ${parsed.error.message}`, {
        cause: parsed.error,
      });
    }

    const expiresInMs = (parsed.data.expires_in ?? 3600) * 1000;
    this.cachedToken = {
      accessToken: parsed.data.access_token,
      expiresAt: Date.now() + Math.max(0, expiresInMs - TOKEN_EXPIRY_SAFETY_MARGIN_MS),
    };
    return this.cachedToken.accessToken;
  }

  /** Authenticated GET against the Trademark Search API. Requires OAuth credentials (not the open-data fallback). */
  async getAuthenticated(path: string, searchParams: Readonly<Record<string, string>> = {}): Promise<unknown> {
    const token = await this.getAccessToken();
    return this.executeGet(this.apiBaseUrl, path, searchParams, { Authorization: `Bearer ${token}` });
  }

  /** Unauthenticated GET against the open-data bulk extract base URL. */
  async getOpenData(path: string, searchParams: Readonly<Record<string, string>> = {}): Promise<unknown> {
    if (!this.hasOpenDataFallback) {
      throw new ConnectorConfigurationError(EUIPO_REGISTRY_CODE, ['EUIPO_OPEN_DATA_BASE_URL']);
    }
    return this.executeGet(this.openDataBaseUrl, path, searchParams, {});
  }

  private async executeGet(
    baseUrl: string | undefined,
    path: string,
    searchParams: Readonly<Record<string, string>>,
    extraHeaders: Record<string, string>,
  ): Promise<unknown> {
    if (!this.fetchImpl) {
      throw new ConnectorUpstreamError(EUIPO_REGISTRY_CODE, null, 'no fetch implementation available in this runtime');
    }

    const url = new URL(path, baseUrl);
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        headers: { Accept: 'application/json', ...extraHeaders },
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ConnectorUpstreamError(EUIPO_REGISTRY_CODE, null, `request to ${path} timed out after ${this.timeoutMs}ms`, {
          cause: error,
        });
      }
      throw new ConnectorUpstreamError(EUIPO_REGISTRY_CODE, null, `network error calling ${path}`, { cause: error });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 429) {
      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfterMs = retryAfterHeader ? parseRetryAfterMs(retryAfterHeader) : null;
      throw new ConnectorRateLimitError(EUIPO_REGISTRY_CODE, retryAfterMs);
    }
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new ConnectorUpstreamError(EUIPO_REGISTRY_CODE, response.status, `unexpected status calling ${path}`);
    }

    try {
      return await response.json();
    } catch (error) {
      throw new ConnectorParseError(EUIPO_REGISTRY_CODE, `response from ${path} was not valid JSON`, { cause: error });
    }
  }

  /** Probes reachability without throwing - used by `EuipoConnector.healthCheck`. */
  async probeHealth(): Promise<ConnectorHealthReport> {
    const checkedAt = new Date().toISOString();

    if (!this.isConfigured) {
      return {
        status: 'configuration_required',
        message: `EUIPO connector is not configured. Missing: ${this.missingConfigKeys.join(', ')}.`,
        checkedAt,
      };
    }

    try {
      if (this.hasOAuthCredentials) {
        await this.getAccessToken();
        return { status: 'ok', message: 'EUIPO connector obtained an OAuth token successfully.', checkedAt };
      }
      await this.getOpenData('/health');
      return { status: 'ok', message: 'EUIPO open-data fallback is reachable.', checkedAt };
    } catch (error) {
      if (error instanceof ConnectorRateLimitError) {
        return { status: 'degraded', message: 'EUIPO health probe was rate limited.', checkedAt };
      }
      return {
        status: 'unavailable',
        message: `EUIPO health probe failed: ${error instanceof Error ? error.message : String(error)}`,
        checkedAt,
      };
    }
  }
}

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
