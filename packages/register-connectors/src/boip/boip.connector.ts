import type { RegisteredTrademarkSnapshot } from '@merkwacht/domain';
import type { RegisterConnectorCapabilities } from '../core/register-capabilities.js';
import type { TrademarkRegisterConnector } from '../core/register-connector.js';
import type {
  CandidateApplicationInput,
  ConnectorHealthReport,
  FetchPublicationsParams,
  FetchPublicationsResult,
} from '../core/register-types.js';
import { BoipClient, type BoipClientConfig } from './boip.client.js';
import { findBoipFixtureTrademark, BOIP_FIXTURE_PUBLICATIONS } from './boip.fixtures.js';
import {
  mapBoipPublicationToCandidateApplicationInput,
  mapBoipTrademarkToSnapshot,
} from './boip.mapper.js';
import { getBoipOppositionRuleSet } from './boip.opposition-rules.js';
import { parseBoipPublicationsResponse, parseBoipTrademarkRecord } from './boip.parser.js';

/**
 * BOIP connector configuration. Falls back to `BOIP_API_BASE_URL` /
 * `BOIP_API_KEY` / `BOIP_USE_FIXTURES` environment variables when not
 * passed explicitly, so `apps/worker`/`apps/api` can construct it with zero
 * arguments in normal operation while tests inject explicit config.
 */
export interface BoipConnectorConfig extends BoipClientConfig {
  /**
   * When `true` (or `BOIP_USE_FIXTURES=true`), the connector serves
   * fictitious fixture data (`boip.fixtures.ts`) instead of calling the
   * live Datolite API. Intended for local development and demos only -
   * must never be enabled in production. The fixture data is clearly
   * fictitious (LUMARO-style invented names), never real register data.
   */
  readonly useFixtures?: boolean | undefined;
  /** Inject a preconstructed client (primarily for tests). */
  readonly client?: BoipClient | undefined;
}

const BOIP_CAPABILITIES: RegisterConnectorCapabilities = {
  supportsIncrementalFetch: true,
  // v1 watch eligibility is word-mark-only (see docs/connectors/boip.md);
  // BOIP itself does publish figurative marks, but Merkwacht doesn't yet
  // consume them meaningfully, hence `false` here.
  supportsFigurativeMarks: false,
  supportsTrademarkLookup: true,
  supportsOppositionStatusTracking: false,
};

/**
 * Connector for the BOIP (Benelux) trademark register, backed by BOIP's
 * Datolite data platform. HTTP plumbing lives in `boip.client.ts`, response
 * validation in `boip.schemas.ts`/`boip.parser.ts`, and domain mapping in
 * `boip.mapper.ts` - this class only wires those pieces together and
 * implements the `TrademarkRegisterConnector` contract. It never fabricates
 * trademark data: with no credentials configured (and fixtures disabled),
 * `healthCheck()` reports `configuration_required` and every fetch method
 * throws `ConnectorConfigurationError` rather than returning anything. See
 * `docs/connectors/connector-contract.md`.
 */
export class BoipConnector implements TrademarkRegisterConnector {
  readonly registryCode = 'BOIP' as const;
  readonly capabilities = BOIP_CAPABILITIES;

  private readonly useFixtures: boolean;
  private readonly client: BoipClient;

  constructor(config: BoipConnectorConfig = {}) {
    this.useFixtures = config.useFixtures ?? process.env['BOIP_USE_FIXTURES'] === 'true';
    this.client =
      config.client ??
      new BoipClient({
        apiBaseUrl: config.apiBaseUrl,
        apiKey: config.apiKey,
        fetchImpl: config.fetchImpl,
        timeoutMs: config.timeoutMs,
      });
  }

  async healthCheck(): Promise<ConnectorHealthReport> {
    if (this.useFixtures) {
      return {
        status: 'ok',
        message:
          'BOIP connector draait in fixture-modus (BOIP_USE_FIXTURES=true); geen live Datolite-verbinding.',
        checkedAt: new Date().toISOString(),
      };
    }
    return this.client.probeHealth();
  }

  async fetchPublications(params: FetchPublicationsParams): Promise<FetchPublicationsResult> {
    if (this.useFixtures) {
      return this.fetchFixturePublications();
    }

    this.client.assertConfigured();

    const pageSize = params.pageSize ?? 100;
    const cursor = params.since?.cursor ?? null;
    const searchParams: Record<string, string> = { pageSize: String(pageSize) };
    if (cursor !== null && cursor !== undefined) {
      searchParams['cursor'] = String(cursor);
    }

    const body = await this.client.get('/v1/publications', searchParams);
    const parsed = parseBoipPublicationsResponse(body);

    const applications: CandidateApplicationInput[] = parsed.items.map((item) =>
      mapBoipPublicationToCandidateApplicationInput(item),
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

  async fetchTrademarkByNumber(
    registrationNumber: string,
  ): Promise<RegisteredTrademarkSnapshot | null> {
    if (this.useFixtures) {
      const fixture = findBoipFixtureTrademark(registrationNumber);
      return fixture ? mapBoipTrademarkToSnapshot(fixture) : null;
    }

    this.client.assertConfigured();

    const body = await this.client.getOrNull(
      `/v1/trademarks/${encodeURIComponent(registrationNumber)}`,
    );
    if (body === null) {
      return null;
    }

    const parsed = parseBoipTrademarkRecord(body);
    return mapBoipTrademarkToSnapshot(parsed);
  }

  getOppositionRuleSet() {
    return getBoipOppositionRuleSet();
  }

  private fetchFixturePublications(): FetchPublicationsResult {
    return {
      applications: BOIP_FIXTURE_PUBLICATIONS.map((record) =>
        mapBoipPublicationToCandidateApplicationInput(record),
      ),
      nextCheckpoint: null,
      hasMore: false,
    };
  }
}

/** Convenience factory mirroring how `apps/worker`/`apps/api` wire this connector up. */
export function createBoipConnector(config: BoipConnectorConfig = {}): TrademarkRegisterConnector {
  return new BoipConnector(config);
}
