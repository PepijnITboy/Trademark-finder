import type { RegisteredTrademarkSnapshot } from '@merkwacht/domain';
import type { RegisterConnectorCapabilities } from './register-capabilities.js';
import type { OppositionRuleProvider } from './opposition-rules.js';
import type {
  ConnectorHealthReport,
  FetchPublicationsParams,
  FetchPublicationsResult,
  RegisterCode,
} from './register-types.js';

/**
 * The single contract every trademark register integration implements.
 * Consumers (`apps/worker`, `@merkwacht/scoring`) depend only on this
 * interface, never on a concrete connector, so registers can be added or
 * swapped without touching downstream code. See
 * `docs/connectors/connector-contract.md` for the full specification,
 * including the "no fake data" health-state rules.
 */
export interface TrademarkRegisterConnector extends OppositionRuleProvider {
  readonly registryCode: RegisterCode;
  readonly capabilities: RegisterConnectorCapabilities;

  /**
   * Reports whether the connector is configured and reachable. Must return
   * `configuration_required` (not throw, not fabricate data) when required
   * credentials are missing.
   */
  healthCheck(): Promise<ConnectorHealthReport>;

  /**
   * Fetches newly published/updated applications, resuming from
   * `params.since` when provided. Throws {@link ConnectorConfigurationError}
   * if required configuration is missing.
   */
  fetchPublications(params: FetchPublicationsParams): Promise<FetchPublicationsResult>;

  /**
   * Looks up the current register state of a specific registration, used to
   * build/refresh a `RegisteredTrademarkSnapshot`. Returns `null` if the
   * register has no record of the given registration number (not an
   * error). Throws {@link ConnectorConfigurationError} if required
   * configuration is missing.
   */
  fetchTrademarkByNumber(registrationNumber: string): Promise<RegisteredTrademarkSnapshot | null>;
}
