import { describe, expect, it } from 'vitest';
import { DEFAULT_REGISTER_CATALOG } from '@merkwacht/domain';
import {
  ConnectorCockpitStore,
  canEnableRegisterForCustomers,
  groupCatalogByContinent,
  isRegisterMonitoringOk,
} from './connector-cockpit-store.js';

describe('ConnectorCockpitStore', () => {
  it('groups catalog by continent with Europe first', () => {
    const groups = groupCatalogByContinent(DEFAULT_REGISTER_CATALOG);
    expect(groups[0]?.continent).toBe('europe');
    expect(groups.some((g) => g.continent === 'asia')).toBe(true);
    const total = groups.reduce((n, g) => n + g.registers.length, 0);
    expect(total).toBe(DEFAULT_REGISTER_CATALOG.length);
  });

  it('records probes and logs without storing secret values', () => {
    const store = new ConnectorCockpitStore();
    store.setCredentialConfigured('EUIPO', { apiKeyConfigured: true });
    store.recordProbe('EUIPO', 'ok', 'Reachable');
    const runtime = store.getRuntime('EUIPO');
    expect(runtime?.apiKeyConfigured).toBe(true);
    expect(runtime?.lastProbeStatus).toBe('ok');
    expect(store.listLogs('EUIPO').length).toBeGreaterThanOrEqual(2);
  });

  it('monitoring OK requires live + enabledForWatch + green probe', () => {
    const store = new ConnectorCockpitStore();
    const boip = DEFAULT_REGISTER_CATALOG.find((r) => r.code === 'BOIP')!;
    expect(isRegisterMonitoringOk(boip, store.getRuntime('BOIP'))).toBe(false);
    store.recordProbe('BOIP', 'ok', 'fixtures');
    expect(isRegisterMonitoringOk(boip, store.getRuntime('BOIP'))).toBe(true);
    store.recordProbe('BOIP', 'configuration_required', 'missing key');
    expect(isRegisterMonitoringOk(boip, store.getRuntime('BOIP'))).toBe(false);
  });

  it('canEnableRegisterForCustomers does not require enabledForWatch (no deadlock)', () => {
    const store = new ConnectorCockpitStore();
    const euipo = DEFAULT_REGISTER_CATALOG.find((r) => r.code === 'EUIPO')!;
    expect(euipo.enabledForWatch).toBe(false);
    expect(canEnableRegisterForCustomers(euipo, store.getRuntime('EUIPO'))).toBe(false);
    // Force live status for gate test
    const liveEuipo = { ...euipo, connectorStatus: 'live' as const };
    store.recordProbe('EUIPO', 'ok', 'ok');
    expect(canEnableRegisterForCustomers(liveEuipo, store.getRuntime('EUIPO'))).toBe(true);
    expect(isRegisterMonitoringOk(liveEuipo, store.getRuntime('EUIPO'))).toBe(false);
  });

  it('upserts API key with last4 only in runtime (never full secret)', () => {
    const store = new ConnectorCockpitStore();
    const runtime = store.upsertApiKey('EUIPO', 'sk-test-secret-9876');
    expect(runtime?.apiKeyConfigured).toBe(true);
    expect(runtime?.apiKeyLast4).toBe('9876');
    expect(JSON.stringify(store.listRuntime())).not.toContain('sk-test-secret');
    expect(store.getApiKey('EUIPO')).toBe('sk-test-secret-9876');
  });

  it('disable reason is logged', () => {
    const store = new ConnectorCockpitStore();
    store.setDisableReason('DPMA', 'Upstream outage');
    expect(store.getRuntime('DPMA')?.disableReason).toBe('Upstream outage');
    expect(store.listLogs('DPMA')[0]?.message.toLowerCase()).toContain('uitgeschakeld');
  });
});
