import type { RegisteredTrademarkSnapshot } from '@merkwacht/domain';
import type { RegisterConnectorCapabilities } from '../core/register-capabilities.js';
import type { TrademarkRegisterConnector } from '../core/register-connector.js';
import { ConnectorConfigurationError } from '../core/register-errors.js';
import type {
  CandidateApplicationInput,
  ConnectorHealthReport,
  FetchPublicationsParams,
  FetchPublicationsResult,
} from '../core/register-types.js';
import { EuipoOAuthClient, type EuipoOAuthClientConfig } from './euipo.oauth-client.js';
import { EUIPO_FIXTURE_PUBLICATIONS, findEuipoFixtureTrademark } from './euipo.fixtures.js';
import { mapEuipoPublicationToCandidateApplicationInput, mapEuipoTrademarkToSnapshot } from './euipo.mapper.js';
import { getEuipoOppositionRuleSet } from './euipo.opposition-rules.js';
import { parseEuipoPublicationsResponse, parseEuipoTrademarkRecord } from './euipo.parser.js';

/**
 * EUIPO connector configuration. Falls back to `EUIPO_CLIENT_ID` /
 * `EUIPO_CLIENT_SECRET` / `EUIPO_API_BASE_URL` / `EUIPO_OPEN_DATA_BASE_URL`
 * / `EUIPO_USE_FIXTURES` environment variables when not passed explicitly,
 * mirroring `../boip/boip.connector.ts`.
 */
export interface EuipoConnectorConfig extends EuipoOAuthClientConfig {
  readonly useFixtures?: boolean | undefined;
  /** Inject a preconstructed client (primarily for tests). */
  readonly client?: EuipoOAuthClient | undefined;
}

const EUIPO_CAPABILITIES: RegisterConnectorCapabilities = {
  supportsIncrementalFetch: true,
  // Figurative/combined EU marks are published, but not yet meaningfully
  // consumed by scoring - see `../boip/boip.connector.ts` for the same
  // v1 scope decision.
  supportsFigurativeMarks: false,
  supportsTrademarkLookup: true,
  supportsOppositionStatusTracking: false,
};

/** Number of fixture publications served per call, to exercise checkpoint/pagination logic even with a small fixture set. */
const FIXTURE_PAGE_SIZE = 2;

/**
 * Connector for the EUIPO (European Union Intellectual Property Office)
 * trademark register. Prefers OAuth2 client-credentials access to the
 * Trademark Search API; when only `EUIPO_OPEN_DATA_BASE_URL` is
 * configured (no client secret), falls back to EUIPO's unauthenticated
 * open-data bulk extracts for publications (trademark-by-number lookup
 * still requires OAuth - see `euipo.oauth-client.ts`). Never fabricates
 * data: with neither configured, `healthCheck()` reports
 * `configuration_required` and every fetch method throws
 * `ConnectorConfigurationError`. See `docs/connectors/euipo.md` and
 * `docs/connectors/connector-contract.md`.
 */
export class EuipoConnector implements TrademarkRegisterConnector {
  readonly registryCode = 'EUIPO' as const;
  readonly capabilities = EUIPO_CAPABILITIES;

  private readonly useFixtures: boolean;
  private readonly client: EuipoOAuthClient;

  constructor(config: EuipoConnectorConfig = {}) {
    this.useFixtures = config.useFixtures ?? process.env['EUIPO_USE_FIXTURES'] === 'true';
    this.client =
      config.client ??
      new EuipoOAuthClient({
        apiBaseUrl: config.apiBaseUrl,
        tokenUrl: config.tokenUrl,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        openDataBaseUrl: config.openDataBaseUrl,
        fetchImpl: config.fetchImpl,
        timeoutMs: config.timeoutMs,
      });
  }

  async healthCheck(): Promise<ConnectorHealthReport> {
    if (this.useFixtures) {
      return {
        status: 'ok',
        message: 'EUIPO connector draait in fixture-modus (EUIPO_USE_FIXTURES=true); geen live verbinding.',
        checkedAt: new Date().toISOString(),
      };
    }
    return this.client.probeHealth();
  }

  async fetchPublications(params: FetchPublicationsParams): Promise<FetchPublicationsResult> {
    if (this.useFixtures) {
      return this.fetchFixturePublications(params);
    }

    this.client.assertConfigured();

    const pageSize = params.pageSize ?? 100;
    const cursor = params.since?.cursor ?? null;
    const searchParams: Record<string, string> = { pageSize: String(pageSize) };
    if (cursor !== null && cursor !== undefined) {
      searchParams['cursor'] = String(cursor);
    }

    const body = this.client.hasOAuthCredentials
      ? await this.client.getAuthenticated('/trademarks', searchParams)
      : await this.client.getOpenData('/bulk/publications', searchParams);
    const parsed = parseEuipoPublicationsResponse(body);

    const applications: CandidateApplicationInput[] = parsed.items.map((item) =>
      mapEuipoPublicationToCandidateApplicationInput(item),
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
      const fixture = findEuipoFixtureTrademark(registrationNumber);
      return fixture ? mapEuipoTrademarkToSnapshot(fixture) : null;
    }

    if (!this.client.hasOAuthCredentials) {
      throw new ConnectorConfigurationError(this.registryCode, [
        'EUIPO_CLIENT_ID',
        'EUIPO_CLIENT_SECRET (required for single-trademark lookup; the open-data fallback only serves bulk publications)',
      ]);
    }

    const body = await this.client.getAuthenticated(`/trademarks/${encodeURIComponent(registrationNumber)}`);
    if (body === null) {
      return null;
    }

    const parsed = parseEuipoTrademarkRecord(body);
    return mapEuipoTrademarkToSnapshot(parsed);
  }

  getOppositionRuleSet() {
    return getEuipoOppositionRuleSet();
  }

  /** Serves fixture publications with a resumable numeric-index checkpoint, same contract as live mode. */
  private fetchFixturePublications(params: FetchPublicationsParams): FetchPublicationsResult {
    const all = EUIPO_FIXTURE_PUBLICATIONS;
    const startIndex = readCursorIndex(params.since?.cursor);
    const pageSize = params.pageSize ?? FIXTURE_PAGE_SIZE;
    const page = all.slice(startIndex, startIndex + pageSize);
    const endIndex = startIndex + page.length;
    const hasMore = endIndex < all.length;

    return {
      applications: page.map((record) => mapEuipoPublicationToCandidateApplicationInput(record)),
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
export function createEuipoConnector(config: EuipoConnectorConfig = {}): TrademarkRegisterConnector {
  return new EuipoConnector(config);
}
