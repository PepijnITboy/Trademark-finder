import type { RegisteredTrademarkSnapshot } from '@merkwacht/domain';
import type { RegisterConnectorCapabilities } from '../core/register-capabilities.js';
import type { TrademarkRegisterConnector } from '../core/register-connector.js';
import type {
  CandidateApplicationInput,
  ConnectorHealthReport,
  FetchPublicationsParams,
  FetchPublicationsResult,
} from '../core/register-types.js';
import { findUsptoFixtureCaseStatus, USPTO_FIXTURE_GAZETTE_PUBLICATIONS } from './uspto.fixtures.js';
import { mapUsptoCaseStatusToSnapshot, mapUsptoPublicationToCandidateApplicationInput } from './uspto.mapper.js';
import { getUsptoOppositionRuleSet } from './uspto.opposition-rules.js';
import { UsptoTsdrClient, type UsptoTsdrClientConfig } from './uspto.tsdr-client.js';

/**
 * USPTO connector configuration. Falls back to `USPTO_API_KEY` /
 * `USPTO_API_BASE_URL` / `USPTO_GAZETTE_FEED_URL` / `USPTO_USE_FIXTURES`
 * environment variables when not passed explicitly, mirroring
 * `../boip/boip.connector.ts`.
 */
export interface UsptoConnectorConfig extends UsptoTsdrClientConfig {
  readonly useFixtures?: boolean | undefined;
  /** Inject a preconstructed client (primarily for tests). */
  readonly client?: UsptoTsdrClient | undefined;
}

const USPTO_CAPABILITIES: RegisterConnectorCapabilities = {
  supportsIncrementalFetch: true,
  supportsFigurativeMarks: false,
  supportsTrademarkLookup: true,
  supportsOppositionStatusTracking: false,
};

/** Number of fixture publications served per call, to exercise checkpoint/pagination logic even with a small fixture set. */
const FIXTURE_PAGE_SIZE = 2;

/**
 * Connector for the USPTO (United States Patent and Trademark Office)
 * trademark register, backed by the TSDR API (single-mark lookups) and an
 * operator-configured Official Gazette publications proxy (see
 * `uspto.tsdr-client.ts` for why these are configured independently).
 * Never fabricates data: with neither configured, `healthCheck()` reports
 * `configuration_required` and every fetch method throws
 * `ConnectorConfigurationError`. See `docs/connectors/uspto.md` and
 * `docs/connectors/connector-contract.md`.
 */
export class UsptoConnector implements TrademarkRegisterConnector {
  readonly registryCode = 'USPTO' as const;
  readonly capabilities = USPTO_CAPABILITIES;

  private readonly useFixtures: boolean;
  private readonly client: UsptoTsdrClient;

  constructor(config: UsptoConnectorConfig = {}) {
    this.useFixtures = config.useFixtures ?? process.env['USPTO_USE_FIXTURES'] === 'true';
    this.client =
      config.client ??
      new UsptoTsdrClient({
        apiKey: config.apiKey,
        apiBaseUrl: config.apiBaseUrl,
        gazetteFeedUrl: config.gazetteFeedUrl,
        fetchImpl: config.fetchImpl,
        timeoutMs: config.timeoutMs,
      });
  }

  async healthCheck(): Promise<ConnectorHealthReport> {
    const checkedAt = new Date().toISOString();
    if (this.useFixtures) {
      return {
        status: 'ok',
        message: 'USPTO connector draait in fixture-modus (USPTO_USE_FIXTURES=true); geen live verbinding.',
        checkedAt,
      };
    }
    if (!this.client.isLookupConfigured) {
      return {
        status: 'configuration_required',
        message: 'USPTO connector is not configured. Missing: USPTO_API_KEY.',
        checkedAt,
      };
    }
    // TSDR has no documented generic health/ping endpoint, so - unlike
    // BOIP's live `/health` probe - we report readiness from configuration
    // presence alone rather than inventing a network probe against an
    // undocumented endpoint. `fetchTrademarkByNumber`/`fetchPublications`
    // still surface real upstream failures via `ConnectorUpstreamError`.
    const gazetteNote = this.client.isGazetteConfigured
      ? 'Gazette-feed geconfigureerd; publicaties beschikbaar.'
      : 'Alleen TSDR-lookup beschikbaar (USPTO_GAZETTE_FEED_URL ontbreekt voor publicaties).';
    return { status: 'ok', message: `USPTO TSDR API-key aanwezig. ${gazetteNote}`, checkedAt };
  }

  async fetchPublications(params: FetchPublicationsParams): Promise<FetchPublicationsResult> {
    if (this.useFixtures) {
      return this.fetchFixturePublications(params);
    }

    this.client.assertGazetteConfigured();

    const pageSize = params.pageSize ?? 100;
    const cursor = params.since?.cursor ?? null;
    const searchParams: Record<string, string> = { pageSize: String(pageSize) };
    if (cursor !== null && cursor !== undefined) {
      searchParams['cursor'] = String(cursor);
    }

    const parsed = await this.client.getGazettePublications(searchParams);
    const applications: CandidateApplicationInput[] = parsed.items.map((item) =>
      mapUsptoPublicationToCandidateApplicationInput(item),
    );

    return {
      applications,
      nextCheckpoint:
        parsed.nextCursor === null || parsed.nextCursor === undefined
          ? null
          : { registryCode: this.registryCode, cursor: parsed.nextCursor, updatedAt: new Date().toISOString() },
      hasMore: Boolean(parsed.hasMore),
    };
  }

  async fetchTrademarkByNumber(registrationNumber: string): Promise<RegisteredTrademarkSnapshot | null> {
    if (this.useFixtures) {
      const fixture = findUsptoFixtureCaseStatus(registrationNumber);
      return fixture ? mapUsptoCaseStatusToSnapshot(fixture) : null;
    }

    this.client.assertLookupConfigured();
    const record = await this.client.getCaseStatus(registrationNumber);
    return record ? mapUsptoCaseStatusToSnapshot(record) : null;
  }

  getOppositionRuleSet() {
    return getUsptoOppositionRuleSet();
  }

  /** Serves fixture publications with a resumable numeric-index checkpoint, same contract as live mode. */
  private fetchFixturePublications(params: FetchPublicationsParams): FetchPublicationsResult {
    const all = USPTO_FIXTURE_GAZETTE_PUBLICATIONS;
    const startIndex = readCursorIndex(params.since?.cursor);
    const pageSize = params.pageSize ?? FIXTURE_PAGE_SIZE;
    const page = all.slice(startIndex, startIndex + pageSize);
    const endIndex = startIndex + page.length;
    const hasMore = endIndex < all.length;

    return {
      applications: page.map((record) => mapUsptoPublicationToCandidateApplicationInput(record)),
      nextCheckpoint: hasMore
        ? { registryCode: this.registryCode, cursor: endIndex, updatedAt: new Date().toISOString() }
        : null,
      hasMore,
    };
  }
}

function readCursorIndex(cursor: unknown): number {
  return typeof cursor === 'number' && Number.isInteger(cursor) && cursor >= 0 ? cursor : 0;
}

/** Convenience factory mirroring how `apps/worker`/`apps/api` wire this connector up. */
export function createUsptoConnector(config: UsptoConnectorConfig = {}): TrademarkRegisterConnector {
  return new UsptoConnector(config);
}
