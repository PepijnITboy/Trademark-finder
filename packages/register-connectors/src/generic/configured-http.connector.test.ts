import { describe, expect, it } from 'vitest';
import { ConnectorConfigurationError } from '../core/register-errors.js';
import { createConfiguredHttpConnector } from './configured-http.connector.js';

describe('ConfiguredHttpConnector', () => {
  it('configuration_required without credentials', async () => {
    const connector = createConfiguredHttpConnector({
      registryCode: 'DPMA',
      envPrefix: 'DPMA_TEST_MISSING',
      useFixtures: false,
      apiBaseUrl: undefined,
      apiKey: undefined,
    });
    expect((await connector.healthCheck()).status).toBe('configuration_required');
    await expect(connector.fetchPublications({})).rejects.toBeInstanceOf(ConnectorConfigurationError);
  });

  it('fixture mode incremental checkpoint', async () => {
    const connector = createConfiguredHttpConnector({
      registryCode: 'CIPO',
      envPrefix: 'CIPO',
      useFixtures: true,
    });
    const page1 = await connector.fetchPublications({ pageSize: 1 });
    expect(page1.applications).toHaveLength(1);
    expect(page1.hasMore).toBe(true);
    const page2 = await connector.fetchPublications({ since: page1.nextCheckpoint, pageSize: 10 });
    expect(page2.applications[0]?.applicationNumber).not.toBe(page1.applications[0]?.applicationNumber);
  });
});
