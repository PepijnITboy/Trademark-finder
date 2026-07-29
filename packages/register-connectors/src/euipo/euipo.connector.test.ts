import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectorConfigurationError } from '../core/register-errors.js';
import { EuipoConnector } from './euipo.connector.js';
import { EUIPO_FIXTURE_PUBLICATIONS, EUIPO_FIXTURE_TRADEMARK_REGISTRATIONS } from './euipo.fixtures.js';

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...init.headers },
  });
}

describe('EuipoConnector', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env['EUIPO_CLIENT_ID'];
    delete process.env['EUIPO_CLIENT_SECRET'];
    delete process.env['EUIPO_OPEN_DATA_BASE_URL'];
    delete process.env['EUIPO_USE_FIXTURES'];
  });

  describe('without credentials, without open-data fallback, and without fixtures', () => {
    it('reports configuration_required from healthCheck without making network calls', async () => {
      const fetchImpl = vi.fn();
      const connector = new EuipoConnector({ fetchImpl });

      const report = await connector.healthCheck();

      expect(report.status).toBe('configuration_required');
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('throws ConnectorConfigurationError from fetchPublications', async () => {
      const connector = new EuipoConnector({});
      await expect(connector.fetchPublications({})).rejects.toBeInstanceOf(ConnectorConfigurationError);
    });

    it('throws ConnectorConfigurationError from fetchTrademarkByNumber', async () => {
      const connector = new EuipoConnector({});
      await expect(connector.fetchTrademarkByNumber('EU-018123456')).rejects.toBeInstanceOf(
        ConnectorConfigurationError,
      );
    });
  });

  describe('in fixture mode', () => {
    it('reports a healthy status without any credentials', async () => {
      const connector = new EuipoConnector({ useFixtures: true });
      expect((await connector.healthCheck()).status).toBe('ok');
    });

    it('serves fixture publications paginated with a resumable checkpoint', async () => {
      const connector = new EuipoConnector({ useFixtures: true });

      const first = await connector.fetchPublications({});
      expect(first.applications.length).toBeGreaterThan(0);
      expect(first.applications.length).toBeLessThan(EUIPO_FIXTURE_PUBLICATIONS.length);
      expect(first.hasMore).toBe(true);

      const second = await connector.fetchPublications({ since: first.nextCheckpoint });
      const seen = new Set([...first.applications, ...second.applications].map((a) => a.applicationNumber));
      expect(seen.size).toBe(EUIPO_FIXTURE_PUBLICATIONS.length);
    });

    it('serves a fixture trademark snapshot by registration number', async () => {
      const connector = new EuipoConnector({ useFixtures: true });
      const [firstFixture] = EUIPO_FIXTURE_TRADEMARK_REGISTRATIONS;
      if (!firstFixture) throw new Error('expected at least one fixture trademark');

      const snapshot = await connector.fetchTrademarkByNumber(firstFixture.registrationNumber);
      expect(snapshot?.markText).toBe('LUMENTIA');
      expect(snapshot?.registryCode).toBe('EUIPO');
    });

    it('returns null for an unknown registration number', async () => {
      const connector = new EuipoConnector({ useFixtures: true });
      expect(await connector.fetchTrademarkByNumber('EU-DOES-NOT-EXIST')).toBeNull();
    });
  });

  describe('with OAuth client credentials', () => {
    it('acquires a token then fetches publications with it', async () => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ access_token: 'test-token', expires_in: 3600 }))
        .mockResolvedValueOnce(
          jsonResponse({
            items: [
              {
                applicationNumber: 'EU-099999999',
                markText: 'ZENDRIA',
                markFeature: 'WORD',
                niceClasses: [9],
                applicantName: 'Zendria SE',
                filingDate: '2026-01-01',
                publicationDate: '2026-01-20',
                status: 'PUBLISHED',
              },
            ],
            nextCursor: 'cursor-2',
            hasMore: true,
          }),
        );

      const connector = new EuipoConnector({
        clientId: 'client-id',
        clientSecret: 'client-secret',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });

      const result = await connector.fetchPublications({});

      expect(result.applications).toHaveLength(1);
      expect(result.applications[0]?.markText).toBe('ZENDRIA');
      expect(result.nextCheckpoint?.cursor).toBe('cursor-2');

      const [, tokenRequestInit] = fetchImpl.mock.calls[0] as [string, RequestInit];
      expect(tokenRequestInit.method).toBe('POST');
      const [, publicationsRequestInit] = fetchImpl.mock.calls[1] as [URL, RequestInit];
      expect((publicationsRequestInit.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token');
    });

    it('reuses a cached token across multiple calls', async () => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ access_token: 'cached-token', expires_in: 3600 }))
        .mockImplementation(() => Promise.resolve(jsonResponse({ items: [], hasMore: false })));

      const connector = new EuipoConnector({
        clientId: 'client-id',
        clientSecret: 'client-secret',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });

      await connector.fetchPublications({});
      await connector.fetchPublications({});

      const tokenCalls = fetchImpl.mock.calls.filter(([url]) => String(url).includes('/oauth2/token'));
      expect(tokenCalls).toHaveLength(1);
    });
  });

  describe('with only the open-data fallback configured (no client secret)', () => {
    it('reports ok health via the open-data endpoint', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ status: 'ok' }));
      const connector = new EuipoConnector({
        openDataBaseUrl: 'https://open-data.euipo.example.com',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });

      expect((await connector.healthCheck()).status).toBe('ok');
    });

    it('serves publications from the open-data endpoint without a token request', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(
        jsonResponse({
          items: [
            {
              applicationNumber: 'EU-088888888',
              markText: 'NOVARIS',
              niceClasses: [42],
              applicantName: 'Novaris BV',
              filingDate: '2026-02-01',
              publicationDate: '2026-02-18',
              status: 'PUBLISHED',
            },
          ],
          hasMore: false,
        }),
      );

      const connector = new EuipoConnector({
        openDataBaseUrl: 'https://open-data.euipo.example.com',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });

      const result = await connector.fetchPublications({});
      expect(result.applications).toHaveLength(1);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('still throws ConnectorConfigurationError for single-trademark lookup (OAuth-only capability)', async () => {
      const connector = new EuipoConnector({ openDataBaseUrl: 'https://open-data.euipo.example.com' });
      await expect(connector.fetchTrademarkByNumber('EU-018123456')).rejects.toBeInstanceOf(
        ConnectorConfigurationError,
      );
    });
  });

  it('exposes the EUTMR Article 46 opposition rule (3 months from publication)', () => {
    const connector = new EuipoConnector({});
    expect(connector.getOppositionRuleSet()).toEqual({
      kind: 'months',
      months: 3,
      startsFrom: 'publication_date',
    });
  });
});
