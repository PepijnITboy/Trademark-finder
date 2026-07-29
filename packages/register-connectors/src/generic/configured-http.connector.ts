import type { OppositionRuleSet, RegisteredTrademarkSnapshot } from '@merkwacht/domain';
import type { RegisterConnectorCapabilities } from '../core/register-capabilities.js';
import type { TrademarkRegisterConnector } from '../core/register-connector.js';
import type {
  CandidateApplicationInput,
  ConnectorHealthReport,
  FetchPublicationsParams,
  FetchPublicationsResult,
  RegisterCode,
} from '../core/register-types.js';
import { ConnectorConfigurationError } from '../core/register-errors.js';
import { buildGenericFixtureSet, type GenericConnectorFixtureSet } from './fixture-factory.js';
import { GenericHttpClient, type GenericHttpClientConfig } from './generic-http.client.js';
import {
  mapGenericPublicationToCandidateApplicationInput,
  mapGenericTrademarkToSnapshot,
} from './generic.mapper.js';
import {
  parseGenericPublicationsResponse,
  parseGenericTrademarkRecord,
} from './generic.schemas.js';

const DEFAULT_CAPABILITIES: RegisterConnectorCapabilities = {
  supportsIncrementalFetch: true,
  supportsFigurativeMarks: false,
  supportsTrademarkLookup: true,
  supportsOppositionStatusTracking: false,
};

export interface ConfiguredHttpConnectorOptions {
  readonly registryCode: RegisterCode;
  readonly envPrefix: string;
  readonly publicationsPath?: string | undefined;
  readonly trademarkPath?: ((registrationNumber: string) => string) | undefined;
  readonly oppositionMonths?: number | undefined;
  readonly useFixtures?: boolean | undefined;
  readonly fixtures?: GenericConnectorFixtureSet | undefined;
  readonly client?: GenericHttpClient | undefined;
  readonly apiBaseUrl?: string | undefined;
  readonly apiKey?: string | undefined;
  readonly fetchImpl?: typeof fetch | undefined;
}

/**
 * Generic TrademarkRegisterConnector for national/regional offices that expose
 * a JSON publications feed behind an API key. Without credentials (and fixtures
 * off) healthCheck returns configuration_required and fetch throws —
 * never fabricated live data.
 */
export class ConfiguredHttpConnector implements TrademarkRegisterConnector {
  readonly registryCode: RegisterCode;
  readonly capabilities = DEFAULT_CAPABILITIES;

  private readonly envPrefix: string;
  private readonly publicationsPath: string;
  private readonly trademarkPath: (n: string) => string;
  private readonly oppositionMonths: number;
  private readonly useFixtures: boolean;
  private readonly fixtures: GenericConnectorFixtureSet;
  private readonly client: GenericHttpClient;

  constructor(options: ConfiguredHttpConnectorOptions) {
    this.registryCode = options.registryCode;
    this.envPrefix = options.envPrefix;
    this.publicationsPath = options.publicationsPath ?? '/v1/publications';
    this.trademarkPath =
      options.trademarkPath ?? ((n) => `/v1/trademarks/${encodeURIComponent(n)}`);
    this.oppositionMonths = options.oppositionMonths ?? 2;
    this.useFixtures =
      options.useFixtures ?? process.env[`${options.envPrefix}_USE_FIXTURES`] === 'true';
    this.fixtures = options.fixtures ?? buildGenericFixtureSet(options.registryCode);
    const clientConfig: GenericHttpClientConfig = {
      registryCode: options.registryCode,
      envPrefix: options.envPrefix,
      apiBaseUrl: options.apiBaseUrl,
      apiKey: options.apiKey,
      fetchImpl: options.fetchImpl,
    };
    this.client = options.client ?? new GenericHttpClient(clientConfig);
  }

  getOppositionRuleSet(): OppositionRuleSet {
    return {
      kind: 'months',
      months: this.oppositionMonths,
      startsFrom: 'publication_date',
    };
  }

  async healthCheck(): Promise<ConnectorHealthReport> {
    if (this.useFixtures) {
      return {
        status: 'ok',
        message: `${this.registryCode} connector draait in fixture-modus (${this.envPrefix}_USE_FIXTURES=true).`,
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
    if (cursor != null) searchParams['cursor'] = String(cursor);

    const body = await this.client.get(this.publicationsPath, searchParams);
    const parsed = parseGenericPublicationsResponse(this.registryCode, body);
    const applications: CandidateApplicationInput[] = parsed.items.map((item) =>
      mapGenericPublicationToCandidateApplicationInput(this.registryCode, item),
    );
    return {
      applications,
      nextCheckpoint:
        parsed.nextCursor == null
          ? null
          : {
              registryCode: this.registryCode,
              cursor: parsed.nextCursor,
              updatedAt: new Date().toISOString(),
            },
      hasMore: Boolean(parsed.hasMore),
    };
  }

  async fetchTrademarkByNumber(registrationNumber: string): Promise<RegisteredTrademarkSnapshot | null> {
    if (this.useFixtures) {
      const match = this.fixtures.trademarks.find((t) => t.registrationNumber === registrationNumber);
      return match ? mapGenericTrademarkToSnapshot(this.registryCode, match) : null;
    }
    this.client.assertConfigured();
    const body = await this.client.getOrNull(this.trademarkPath(registrationNumber));
    if (body == null) return null;
    const record = parseGenericTrademarkRecord(this.registryCode, body);
    return mapGenericTrademarkToSnapshot(this.registryCode, record);
  }

  private fetchFixturePublications(params: FetchPublicationsParams): FetchPublicationsResult {
    const pageSize = params.pageSize ?? 100;
    const start = typeof params.since?.cursor === 'number' ? params.since.cursor : Number(params.since?.cursor ?? 0) || 0;
    const slice = this.fixtures.publications.slice(start, start + pageSize);
    const next = start + slice.length;
    const hasMore = next < this.fixtures.publications.length;
    return {
      applications: slice.map((item) =>
        mapGenericPublicationToCandidateApplicationInput(this.registryCode, item),
      ),
      nextCheckpoint: {
        registryCode: this.registryCode,
        cursor: next,
        updatedAt: new Date().toISOString(),
      },
      hasMore,
    };
  }
}

export function createConfiguredHttpConnector(
  options: ConfiguredHttpConnectorOptions,
): TrademarkRegisterConnector {
  return new ConfiguredHttpConnector(options);
}

/** Convenience: throw configuration error when fixtures off and not configured. */
export function assertLiveOrFixtures(
  connector: ConfiguredHttpConnector,
  useFixtures: boolean,
  client: GenericHttpClient,
): void {
  if (!useFixtures && !client.isConfigured) {
    throw new ConnectorConfigurationError(connector.registryCode, client.missingConfigKeys);
  }
}
