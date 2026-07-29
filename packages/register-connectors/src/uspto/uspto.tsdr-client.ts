import type { RegisterCode } from '../core/register-types.js';
import {
  ConnectorConfigurationError,
  ConnectorParseError,
  ConnectorRateLimitError,
  ConnectorUpstreamError,
} from '../core/register-errors.js';
import { usptoCaseStatusRecordSchema, usptoGazetteResponseSchema, type UsptoCaseStatusRecord, type UsptoGazetteResponse } from './uspto.schemas.js';

const USPTO_REGISTRY_CODE: RegisterCode = 'USPTO';
const DEFAULT_TIMEOUT_MS = 10_000;

export interface UsptoTsdrClientConfig {
  /** TSDR API key, sent as the `USPTO-API-KEY` header. Falls back to `USPTO_API_KEY`. Enables single-mark lookups via {@link getCaseStatus}. */
  readonly apiKey?: string | undefined;
  /** Falls back to `USPTO_API_BASE_URL`. Defaults to USPTO's production TSDR API. */
  readonly apiBaseUrl?: string | undefined;
  /**
   * USPTO does not expose the weekly Trademark Official Gazette as a
   * simple incremental JSON API - this is expected to be a JSON proxy (an
   * operator-managed adapter in front of the official bulk XML/PDF feed,
   * see `docs/connectors/uspto.md`) that Merkwacht configures separately
   * from TSDR credentials. Falls back to `USPTO_GAZETTE_FEED_URL`.
   */
  readonly gazetteFeedUrl?: string | undefined;
  readonly fetchImpl?: typeof fetch | undefined;
  readonly timeoutMs?: number | undefined;
}

/**
 * Client for two distinct USPTO data sources (see class-level rationale in
 * `uspto.schemas.ts`): TSDR single-mark status lookups (`getCaseStatus`,
 * needs only `USPTO_API_KEY`) and the Official Gazette publications feed
 * (`getGazettePublications`, needs a separately-configured
 * `USPTO_GAZETTE_FEED_URL`). Deliberately keeps their configuration state
 * independent so a Merkwacht deployment with only a TSDR key still gets a
 * working `fetchTrademarkByNumber`, even though `fetchPublications`
 * remains `configuration_required` until the Gazette feed is set up too.
 *
 * NOTE: exact TSDR paths/headers are best-effort placeholders pending
 * confirmation against USPTO's official TSDR API documentation.
 */
export class UsptoTsdrClient {
  private readonly apiKey: string | undefined;
  private readonly apiBaseUrl: string;
  private readonly gazetteFeedUrl: string | undefined;
  private readonly fetchImpl: typeof fetch | undefined;
  private readonly timeoutMs: number;

  constructor(config: UsptoTsdrClientConfig = {}) {
    this.apiKey = config.apiKey ?? process.env['USPTO_API_KEY'];
    this.apiBaseUrl = config.apiBaseUrl ?? process.env['USPTO_API_BASE_URL'] ?? 'https://tsdrapi.uspto.gov';
    this.gazetteFeedUrl = config.gazetteFeedUrl ?? process.env['USPTO_GAZETTE_FEED_URL'];
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  get isLookupConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  get isGazetteConfigured(): boolean {
    return Boolean(this.gazetteFeedUrl);
  }

  assertLookupConfigured(): void {
    if (!this.isLookupConfigured) {
      throw new ConnectorConfigurationError(USPTO_REGISTRY_CODE, ['USPTO_API_KEY']);
    }
  }

  assertGazetteConfigured(): void {
    if (!this.isGazetteConfigured) {
      throw new ConnectorConfigurationError(USPTO_REGISTRY_CODE, [
        'USPTO_GAZETTE_FEED_URL (Official Gazette publications proxy, separate from the TSDR lookup key)',
      ]);
    }
  }

  /** Looks up a single mark's current status via TSDR. `id` should already carry the `sn`/`rn` TSDR prefix (e.g. `rn7012345`). Returns `null` on a 404. */
  async getCaseStatus(id: string): Promise<UsptoCaseStatusRecord | null> {
    this.assertLookupConfigured();
    if (!this.fetchImpl) {
      throw new ConnectorUpstreamError(USPTO_REGISTRY_CODE, null, 'no fetch implementation available in this runtime');
    }

    const url = new URL(`/ts/cd/casestatus/${encodeURIComponent(id)}/info.json`, this.apiBaseUrl);
    const response = await this.executeGet(url, { 'USPTO-API-KEY': this.apiKey ?? '' });
    if (response === null) return null;

    const parsed = usptoCaseStatusRecordSchema.safeParse(response);
    if (!parsed.success) {
      throw new ConnectorParseError(
        USPTO_REGISTRY_CODE,
        `TSDR case status response failed schema validation: ${parsed.error.message}`,
        { cause: parsed.error },
      );
    }
    return parsed.data;
  }

  /** Fetches a page of the Official Gazette publications feed. Requires `USPTO_GAZETTE_FEED_URL`. */
  async getGazettePublications(searchParams: Readonly<Record<string, string>> = {}): Promise<UsptoGazetteResponse> {
    this.assertGazetteConfigured();
    if (!this.fetchImpl) {
      throw new ConnectorUpstreamError(USPTO_REGISTRY_CODE, null, 'no fetch implementation available in this runtime');
    }

    const url = new URL(this.gazetteFeedUrl ?? '');
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
    const response = await this.executeGet(url, {});
    const parsed = usptoGazetteResponseSchema.safeParse(response ?? {});
    if (!parsed.success) {
      throw new ConnectorParseError(
        USPTO_REGISTRY_CODE,
        `Gazette feed response failed schema validation: ${parsed.error.message}`,
        { cause: parsed.error },
      );
    }
    return parsed.data;
  }

  private async executeGet(url: URL, extraHeaders: Record<string, string>): Promise<unknown | null> {
    if (!this.fetchImpl) {
      throw new ConnectorUpstreamError(USPTO_REGISTRY_CODE, null, 'no fetch implementation available in this runtime');
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
        throw new ConnectorUpstreamError(
          USPTO_REGISTRY_CODE,
          null,
          `request to ${url.pathname} timed out after ${this.timeoutMs}ms`,
          { cause: error },
        );
      }
      throw new ConnectorUpstreamError(USPTO_REGISTRY_CODE, null, `network error calling ${url.pathname}`, {
        cause: error,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 404) return null;
    if (response.status === 429) {
      const retryAfterHeader = response.headers.get('Retry-After');
      throw new ConnectorRateLimitError(
        USPTO_REGISTRY_CODE,
        retryAfterHeader ? parseRetryAfterMs(retryAfterHeader) : null,
      );
    }
    if (!response.ok) {
      throw new ConnectorUpstreamError(USPTO_REGISTRY_CODE, response.status, `unexpected status calling ${url.pathname}`);
    }
    try {
      return await response.json();
    } catch (error) {
      throw new ConnectorParseError(USPTO_REGISTRY_CODE, `response from ${url.pathname} was not valid JSON`, {
        cause: error,
      });
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
