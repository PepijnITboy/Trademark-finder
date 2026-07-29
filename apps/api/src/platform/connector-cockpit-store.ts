import { createId } from '@merkwacht/shared';
import {
  CONTINENT_LABELS_NL,
  DEFAULT_REGISTER_CATALOG,
  type RegisterCatalogEntry,
  type RegisterContinent,
} from '@merkwacht/domain';

export interface ConnectorOperationLogEntry {
  readonly id: string;
  readonly registryCode: string;
  readonly level: 'info' | 'warn' | 'error';
  readonly message: string;
  readonly createdAt: string;
}

export interface ConnectorRuntimeState {
  registryCode: string;
  apiKeyConfigured: boolean;
  /** Last 4 characters of the stored API key; never the full secret. */
  apiKeyLast4: string | null;
  ftpConfigured: boolean;
  lastProbeStatus: string | null;
  lastProbeMessage: string | null;
  lastProbeAt: string | null;
  lastFetchAt: string | null;
  lastFetchedCount: number | null;
  disableReason: string | null;
  connectedOrganizationCount: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * In-memory platform cockpit state for register connectors (demo/API).
 * Credential *values* are never stored — only configured flags + operation logs.
 */
export class ConnectorCockpitStore {
  private readonly runtime = new Map<string, ConnectorRuntimeState>();
  private readonly logs: ConnectorOperationLogEntry[] = [];
  /** Server-side secrets — never serialized to API responses. */
  private readonly secrets = new Map<string, { apiKey?: string; ftpPassword?: string }>();

  constructor(catalog: readonly RegisterCatalogEntry[] = DEFAULT_REGISTER_CATALOG) {
    for (const entry of catalog) {
      const envKey = process.env[`${entry.code}_API_KEY`] ?? (entry.code === 'BOIP' ? process.env['BOIP_API_KEY'] : undefined);
      const hasEnvKey = envKey != null && envKey.length > 0;
      if (hasEnvKey && envKey) {
        this.secrets.set(entry.code, { apiKey: envKey });
      }
      this.runtime.set(entry.code, {
        registryCode: entry.code,
        apiKeyConfigured: hasEnvKey,
        apiKeyLast4: hasEnvKey && envKey ? envKey.slice(-4) : null,
        ftpConfigured: false,
        lastProbeStatus: null,
        lastProbeMessage: null,
        lastProbeAt: null,
        lastFetchAt: null,
        lastFetchedCount: null,
        disableReason: null,
        connectedOrganizationCount: entry.code === 'BOIP' ? 1 : 0,
      });
    }
  }

  listRuntime(): readonly ConnectorRuntimeState[] {
    return [...this.runtime.values()].sort((a, b) => a.registryCode.localeCompare(b.registryCode));
  }

  getRuntime(code: string): ConnectorRuntimeState | null {
    return this.runtime.get(code) ?? null;
  }

  setCredentialConfigured(
    code: string,
    patch: { apiKeyConfigured?: boolean; ftpConfigured?: boolean },
  ): ConnectorRuntimeState | null {
    const existing = this.runtime.get(code);
    if (!existing) return null;
    if (patch.apiKeyConfigured !== undefined) {
      existing.apiKeyConfigured = patch.apiKeyConfigured;
      if (!patch.apiKeyConfigured) {
        existing.apiKeyLast4 = null;
        const secret = this.secrets.get(code);
        if (secret) {
          delete secret.apiKey;
          this.secrets.set(code, secret);
        }
      }
    }
    if (patch.ftpConfigured !== undefined) existing.ftpConfigured = patch.ftpConfigured;
    this.appendLog(code, 'info', `Credential-metadata bijgewerkt (${Object.keys(patch).join(', ')})`);
    return existing;
  }

  /**
   * Upsert a real API key. Stores the secret server-side; runtime exposes only
   * configured flag + last 4 characters.
   */
  upsertApiKey(code: string, apiKey: string): ConnectorRuntimeState | null {
    const existing = this.runtime.get(code);
    if (!existing) return null;
    const trimmed = apiKey.trim();
    if (trimmed.length < 4) return null;
    const prev = this.secrets.get(code) ?? {};
    this.secrets.set(code, { ...prev, apiKey: trimmed });
    existing.apiKeyConfigured = true;
    existing.apiKeyLast4 = trimmed.slice(-4);
    // Make key available to connector factories that read process.env.
    process.env[`${code}_API_KEY`] = trimmed;
    if (code === 'BOIP') process.env['BOIP_API_KEY'] = trimmed;
    if (code === 'USPTO') process.env['USPTO_API_KEY'] = trimmed;
    this.appendLog(code, 'info', `API-sleutel opgeslagen (····${existing.apiKeyLast4})`);
    return existing;
  }

  /** Returns the stored API key for probe/fetch — never expose via HTTP. */
  getApiKey(code: string): string | null {
    return this.secrets.get(code)?.apiKey ?? null;
  }

  recordProbe(code: string, status: string, message: string): ConnectorRuntimeState | null {
    const existing = this.runtime.get(code);
    if (!existing) return null;
    existing.lastProbeStatus = status;
    existing.lastProbeMessage = message;
    existing.lastProbeAt = nowIso();
    this.appendLog(code, status === 'ok' ? 'info' : 'warn', `Probe: ${status} — ${message}`);
    return existing;
  }

  recordFetch(code: string, count: number): ConnectorRuntimeState | null {
    const existing = this.runtime.get(code);
    if (!existing) return null;
    existing.lastFetchAt = nowIso();
    existing.lastFetchedCount = count;
    this.appendLog(code, 'info', `Fetch voltooid: ${count} publicatie(s)`);
    return existing;
  }

  setDisableReason(code: string, reason: string | null): ConnectorRuntimeState | null {
    const existing = this.runtime.get(code);
    if (!existing) return null;
    existing.disableReason = reason;
    if (reason) {
      this.appendLog(code, 'warn', `Connector uitgeschakeld: ${reason}`);
    } else {
      this.appendLog(code, 'info', 'Connector opnieuw ingeschakeld');
    }
    return existing;
  }

  setConnectedCount(code: string, count: number): void {
    const existing = this.runtime.get(code);
    if (existing) existing.connectedOrganizationCount = count;
  }

  listLogs(code?: string, limit = 100): readonly ConnectorOperationLogEntry[] {
    const filtered = code ? this.logs.filter((l) => l.registryCode === code) : this.logs;
    return filtered.slice(-limit).reverse();
  }

  appendLog(registryCode: string, level: ConnectorOperationLogEntry['level'], message: string): void {
    this.logs.push({
      id: createId(),
      registryCode,
      level,
      message,
      createdAt: nowIso(),
    });
    if (this.logs.length > 2000) this.logs.splice(0, this.logs.length - 2000);
  }
}

export function groupCatalogByContinent(
  catalog: readonly RegisterCatalogEntry[],
): readonly { continent: RegisterContinent; labelNl: string; registers: readonly RegisterCatalogEntry[] }[] {
  const order: RegisterContinent[] = [
    'europe',
    'international',
    'north_america',
    'south_america',
    'africa',
    'asia',
    'oceania',
  ];
  return order
    .map((continent) => ({
      continent,
      labelNl: CONTINENT_LABELS_NL[continent],
      registers: catalog.filter((r) => r.continent === continent),
    }))
    .filter((g) => g.registers.length > 0);
}

/**
 * True when the register is actively monitoring for customers:
 * connector live + enabled for watch + last probe green.
 * Used for "Beschermd" / KPI "Registers actief".
 */
export function isRegisterMonitoringOk(
  entry: RegisterCatalogEntry,
  runtime: ConnectorRuntimeState | null,
): boolean {
  if (entry.connectorStatus !== 'live' || !entry.enabledForWatch) return false;
  if (!runtime) return false;
  return runtime.lastProbeStatus === 'ok';
}

/** @deprecated Prefer {@link isRegisterMonitoringOk}. */
export function isRegisterLiveGated(
  entry: RegisterCatalogEntry,
  runtime: ConnectorRuntimeState | null,
): boolean {
  return isRegisterMonitoringOk(entry, runtime);
}

/**
 * True when the register may be switched on for customers (no chicken-and-egg):
 * connector live + last probe green. Does not require enabledForWatch.
 */
export function canEnableRegisterForCustomers(
  entry: RegisterCatalogEntry,
  runtime: ConnectorRuntimeState | null,
): boolean {
  if (entry.connectorStatus !== 'live') return false;
  if (!runtime) return false;
  return runtime.lastProbeStatus === 'ok';
}

export function createConnectorCockpitStore(): ConnectorCockpitStore {
  return new ConnectorCockpitStore();
}
