import { beforeEach, describe, expect, it } from 'vitest';
import { ConnectorConfigurationError } from '../core/register-errors.js';
import { REGISTER_CODES } from '../core/register-types.js';
import { createAllConnectors } from './create-all-connectors.js';

/**
 * Shared contract test looping every connector `createAllConnectors`
 * produces - the single place that asserts every register in
 * `REGISTER_CODES` upholds the "no fake data" invariant from
 * `docs/connectors/connector-contract.md`, regardless of whether it's a
 * deep connector (BOIP/EUIPO/USPTO/WIPO) or generically wired.
 */
describe('connector contract suite', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    for (const code of REGISTER_CODES) {
      delete process.env[`${code}_API_KEY`];
      delete process.env[`${code}_API_BASE_URL`];
      delete process.env[`${code}_USE_FIXTURES`];
    }
    delete process.env['EUIPO_CLIENT_ID'];
    delete process.env['EUIPO_CLIENT_SECRET'];
    delete process.env['EUIPO_OPEN_DATA_BASE_URL'];
    delete process.env['USPTO_GAZETTE_FEED_URL'];
    delete process.env['WIPO_FTP_HOST'];
    delete process.env['WIPO_FTP_USER'];
    delete process.env['WIPO_FTP_PASSWORD'];
  });

  it('registers exactly one connector per catalog register code', () => {
    const connectors = createAllConnectors();
    expect(connectors.size).toBe(REGISTER_CODES.length);
    for (const code of REGISTER_CODES) {
      expect(connectors.has(code)).toBe(true);
      expect(connectors.get(code)?.registryCode).toBe(code);
    }
  });

  it('every connector reports a valid capabilities object and opposition rule set', () => {
    const connectors = createAllConnectors();
    for (const connector of connectors.values()) {
      expect(typeof connector.capabilities.supportsIncrementalFetch).toBe('boolean');
      expect(typeof connector.capabilities.supportsTrademarkLookup).toBe('boolean');
      const ruleSet = connector.getOppositionRuleSet();
      expect(['calendar_days', 'months']).toContain(ruleSet.kind);
    }
  });

  it('health without live secrets is configuration_required (or ok only when explicitly running on fixtures)', async () => {
    const connectors = createAllConnectors();
    for (const [code, connector] of connectors) {
      const health = await connector.healthCheck();
      expect(['ok', 'configuration_required', 'degraded', 'unavailable']).toContain(health.status);

      if (health.status === 'configuration_required') {
        await expect(connector.fetchPublications({})).rejects.toBeInstanceOf(ConnectorConfigurationError);
      } else if (health.status === 'ok') {
        // Without any live secrets configured, an 'ok' health can only be
        // legitimate if the connector is explicitly in fixture mode - it
        // must never report 'ok' by fabricating reachability.
        expect(health.message.toLowerCase()).toContain('fixture');
      }
      void code;
    }
  });

  it('never fabricates data: fetchPublications throws ConnectorConfigurationError for every connector without configuration or fixtures', async () => {
    const connectors = createAllConnectors();
    for (const connector of connectors.values()) {
      await expect(connector.fetchPublications({})).rejects.toBeInstanceOf(ConnectorConfigurationError);
    }
  });

  it('never fabricates data: fetchTrademarkByNumber throws ConnectorConfigurationError for every connector without configuration or fixtures', async () => {
    const connectors = createAllConnectors();
    for (const connector of connectors.values()) {
      await expect(connector.fetchTrademarkByNumber('ANY-0000000')).rejects.toBeInstanceOf(
        ConnectorConfigurationError,
      );
    }
  });

  it('every connector serves fixture data end-to-end when running fully on fixtures', async () => {
    const env: NodeJS.ProcessEnv = { ...process.env };
    for (const code of REGISTER_CODES) {
      env[`${code}_USE_FIXTURES`] = 'true';
    }
    const connectors = createAllConnectors(env);

    for (const [code, connector] of connectors) {
      const health = await connector.healthCheck();
      expect(health.status).toBe('ok');

      const publications = await connector.fetchPublications({});
      expect(Array.isArray(publications.applications)).toBe(true);
      for (const application of publications.applications) {
        expect(application.registryCode).toBe(code);
      }
    }
  });
});
