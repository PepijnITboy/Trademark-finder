import type { RegisteredTrademarkSnapshot } from '@merkwacht/domain';
import type { RegisterConnectorCapabilities } from '../core/register-capabilities.js';
import type { TrademarkRegisterConnector } from '../core/register-connector.js';
import { ConnectorConfigurationError, ConnectorUpstreamError } from '../core/register-errors.js';
import type {
  ConnectorHealthReport,
  FetchPublicationsParams,
  FetchPublicationsResult,
} from '../core/register-types.js';
import {
  parseWipoDeltaFileDate,
  resolveWipoFtpCredentialsFromEnv,
  type WipoFtpClient,
  type WipoFtpCredentials,
} from './wipo.ftp-client.js';
import { WIPO_FIXTURE_TRADEMARK_REGISTRATIONS, WIPO_ST66_FIXTURE_XML } from './wipo.fixtures.js';
import { mapWipoFixtureTrademarkToSnapshot, mapWipoTransactionToCandidateApplicationInput } from './wipo.mapper.js';
import { getWipoOppositionRuleSet } from './wipo.opposition-rules.js';
import { parseSt66XmlToRecords } from './wipo.st66-parser.js';

const WIPO_CAPABILITIES: RegisterConnectorCapabilities = {
  // Live incremental fetch resumes from a `yyyymmdd` daily-delta-file
  // checkpoint (see `fetchPublications` below); fixture mode resumes from
  // a numeric transaction-index checkpoint instead.
  supportsIncrementalFetch: true,
  supportsFigurativeMarks: false,
  supportsTrademarkLookup: true,
  supportsOppositionStatusTracking: false,
};

/** Number of fixture transactions served per call, to exercise checkpoint/pagination logic even with a small fixture set. */
const FIXTURE_PAGE_SIZE = 2;

export interface WipoMadridConnectorConfig {
  /** Explicit FTP credentials. Falls back to `resolveWipoFtpCredentialsFromEnv()` (`WIPO_FTP_HOST`/`WIPO_FTP_USER`/`WIPO_FTP_PASSWORD`) when omitted. Pass `null` explicitly to force "not configured" regardless of env vars (used by tests). */
  readonly credentials?: WipoFtpCredentials | null | undefined;
  /** Concrete FTP transport (see `wipo.ftp-client.ts` for why this is injected rather than built in). Required for any live (non-fixture) call. */
  readonly ftpClient?: WipoFtpClient | undefined;
  readonly useFixtures?: boolean | undefined;
}

/**
 * Connector for the WIPO Madrid System (international trademark
 * registrations). Unlike every other connector in this package, there is
 * no REST/JSON API: live data comes from WIPO's commercial FTP daily
 * delta feed (ST.66 XML, see `wipo.ftp-client.ts` and
 * `wipo.st66-parser.ts`). Never fabricates data: without FTP credentials
 * and an injected `WipoFtpClient` (and fixtures disabled), `healthCheck()`
 * reports `configuration_required` and every fetch method throws
 * `ConnectorConfigurationError`. See `docs/connectors/wipo.md` and
 * `docs/connectors/connector-contract.md`.
 */
export class WipoMadridConnector implements TrademarkRegisterConnector {
  readonly registryCode = 'WIPO' as const;
  readonly capabilities = WIPO_CAPABILITIES;

  private readonly credentials: WipoFtpCredentials | null;
  private readonly ftpClient: WipoFtpClient | undefined;
  private readonly useFixtures: boolean;

  constructor(config: WipoMadridConnectorConfig = {}) {
    this.credentials = config.credentials === undefined ? resolveWipoFtpCredentialsFromEnv() : config.credentials;
    this.ftpClient = config.ftpClient;
    this.useFixtures = config.useFixtures ?? process.env['WIPO_USE_FIXTURES'] === 'true';
  }

  private get missingConfigKeys(): readonly string[] {
    const missing: string[] = [];
    if (!this.credentials) missing.push('WIPO_FTP_HOST', 'WIPO_FTP_USER', 'WIPO_FTP_PASSWORD');
    if (!this.ftpClient) missing.push('WipoFtpClient implementation (commercial FTP transport)');
    return missing;
  }

  private assertConfigured(): void {
    if (this.missingConfigKeys.length > 0) {
      throw new ConnectorConfigurationError(this.registryCode, this.missingConfigKeys);
    }
  }

  async healthCheck(): Promise<ConnectorHealthReport> {
    const checkedAt = new Date().toISOString();
    if (this.useFixtures) {
      return {
        status: 'ok',
        message: 'WIPO Madrid connector draait in fixture-modus (WIPO_USE_FIXTURES=true); ST.66 sample-data.',
        checkedAt,
      };
    }
    if (this.missingConfigKeys.length > 0) {
      return {
        status: 'configuration_required',
        message: `WIPO Madrid FTP is niet geconfigureerd. Ontbreekt: ${this.missingConfigKeys.join(', ')}. Scraping van de Madrid Monitor-UI is niet toegestaan - zie docs/connectors/wipo.md.`,
        checkedAt,
      };
    }
    try {
      const names = await this.ftpClient!.listDailyDeltaNames();
      return { status: 'ok', message: `WIPO FTP bereikbaar (${names.length} delta-bestand(en) zichtbaar).`, checkedAt };
    } catch (error) {
      return {
        status: 'unavailable',
        message: `WIPO FTP-probe mislukt: ${error instanceof Error ? error.message : String(error)}`,
        checkedAt,
      };
    }
  }

  async fetchPublications(params: FetchPublicationsParams): Promise<FetchPublicationsResult> {
    if (this.useFixtures) {
      return this.fetchFixturePublications(params);
    }

    this.assertConfigured();

    const sinceDate = typeof params.since?.cursor === 'string' ? params.since.cursor : null;
    const names = await this.ftpClient!.listDailyDeltaNames();
    const pending = names
      .map((name) => ({ name, date: parseWipoDeltaFileDate(name) }))
      .filter((entry): entry is { name: string; date: string } => entry.date !== null)
      .filter((entry) => !sinceDate || entry.date > sinceDate)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (pending.length === 0) {
      return {
        applications: [],
        nextCheckpoint: params.since ? { ...params.since, updatedAt: new Date().toISOString() } : null,
        hasMore: false,
      };
    }

    const next = pending[0];
    if (!next) {
      throw new ConnectorUpstreamError(this.registryCode, null, 'unexpected empty pending delta list');
    }
    const zippedBuffer = await this.ftpClient!.downloadDailyDelta(next.name);
    // Production: unzip `zippedBuffer` before parsing; fixtures/tests pass
    // plain UTF-8 XML buffers directly (see `wipo.ftp-client.ts`).
    const xml = zippedBuffer.toString('utf8');
    const records = parseSt66XmlToRecords(xml);

    return {
      applications: records.map((record) => mapWipoTransactionToCandidateApplicationInput(record)),
      nextCheckpoint: { registryCode: this.registryCode, cursor: next.date, updatedAt: new Date().toISOString() },
      hasMore: pending.length > 1,
    };
  }

  async fetchTrademarkByNumber(registrationNumber: string): Promise<RegisteredTrademarkSnapshot | null> {
    if (this.useFixtures) {
      const fixture = WIPO_FIXTURE_TRADEMARK_REGISTRATIONS.find(
        (record) => record.registrationNumber === registrationNumber,
      );
      return fixture ? mapWipoFixtureTrademarkToSnapshot(fixture) : null;
    }

    this.assertConfigured();
    // Single-registration lookup isn't served by the daily-delta feed
    // (which only carries *changed* records, not a random-access index) -
    // it would require importing WIPO's periodic full base file into a
    // local index, which isn't implemented yet. Throwing here (rather
    // than returning `null`, which would misleadingly imply "no such
    // registration") keeps this connector honest about what it can't do
    // yet - see `docs/connectors/wipo.md`.
    throw new ConnectorConfigurationError(this.registryCode, [
      'WIPO base-file import (single-registration lookup requires indexing the periodic full base file; the daily delta feed alone is insufficient)',
    ]);
  }

  getOppositionRuleSet() {
    return getWipoOppositionRuleSet();
  }

  /** Serves fixture ST.66 transactions with a resumable numeric-index checkpoint, same contract as live mode. */
  private fetchFixturePublications(params: FetchPublicationsParams): FetchPublicationsResult {
    const all = parseSt66XmlToRecords(WIPO_ST66_FIXTURE_XML);
    const startIndex = readCursorIndex(params.since?.cursor);
    const pageSize = params.pageSize ?? FIXTURE_PAGE_SIZE;
    const page = all.slice(startIndex, startIndex + pageSize);
    const endIndex = startIndex + page.length;
    const hasMore = endIndex < all.length;

    return {
      applications: page.map((record) => mapWipoTransactionToCandidateApplicationInput(record)),
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
export function createWipoMadridConnector(config: WipoMadridConnectorConfig = {}): TrademarkRegisterConnector {
  return new WipoMadridConnector(config);
}
