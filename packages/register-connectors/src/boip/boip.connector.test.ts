import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectorConfigurationError } from '../core/register-errors.js';
import { BoipConnector } from './boip.connector.js';
import { BOIP_FIXTURE_PUBLICATIONS, BOIP_FIXTURE_TRADEMARK_REGISTRATIONS } from './boip.fixtures.js';

describe('BoipConnector', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env['BOIP_API_BASE_URL'];
    delete process.env['BOIP_API_KEY'];
    delete process.env['BOIP_USE_FIXTURES'];
  });

  describe('without credentials and without fixtures', () => {
    it('reports configuration_required from healthCheck without making network calls', async () => {
      const fetchImpl = vi.fn();
      const connector = new BoipConnector({ fetchImpl });

      const report = await connector.healthCheck();

      expect(report.status).toBe('configuration_required');
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('throws ConnectorConfigurationError from fetchPublications instead of returning data', async () => {
      const connector = new BoipConnector({});
      await expect(connector.fetchPublications({})).rejects.toBeInstanceOf(ConnectorConfigurationError);
    });

    it('throws ConnectorConfigurationError from fetchTrademarkByNumber instead of returning data', async () => {
      const connector = new BoipConnector({});
      await expect(connector.fetchTrademarkByNumber('BX-0001234567')).rejects.toBeInstanceOf(
        ConnectorConfigurationError,
      );
    });
  });

  describe('in fixture mode (BOIP_USE_FIXTURES)', () => {
    it('reports a healthy status without any credentials', async () => {
      const connector = new BoipConnector({ useFixtures: true });
      const report = await connector.healthCheck();
      expect(report.status).toBe('ok');
    });

    it('serves fixture publications mapped to CandidateApplicationInput', async () => {
      const connector = new BoipConnector({ useFixtures: true });
      const result = await connector.fetchPublications({});

      expect(result.applications).toHaveLength(BOIP_FIXTURE_PUBLICATIONS.length);
      expect(result.hasMore).toBe(false);
      expect(result.nextCheckpoint).toBeNull();

      const lumaroo = result.applications.find((application) => application.markText === 'LUMAROO');
      expect(lumaroo).toBeDefined();
      expect(lumaroo?.registryCode).toBe('BOIP');
      expect(lumaroo?.proceduralStatus).toBe('published');
    });

    it('serves a fixture trademark snapshot by registration number', async () => {
      const connector = new BoipConnector({ useFixtures: true });
      const [firstFixture] = BOIP_FIXTURE_TRADEMARK_REGISTRATIONS;
      if (!firstFixture) throw new Error('expected at least one fixture trademark registration');

      const snapshot = await connector.fetchTrademarkByNumber(firstFixture.registrationNumber);

      expect(snapshot).not.toBeNull();
      expect(snapshot?.markText).toBe('LUMARO');
      expect(snapshot?.registerStatus).toBe('registered');
      expect(snapshot?.markType).toBe('word');
    });

    it('returns null for an unknown registration number', async () => {
      const connector = new BoipConnector({ useFixtures: true });
      const snapshot = await connector.fetchTrademarkByNumber('BX-DOES-NOT-EXIST');
      expect(snapshot).toBeNull();
    });
  });

  describe('with credentials, using an injected fetch implementation', () => {
    function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
      return new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { 'content-type': 'application/json', ...init.headers },
      });
    }

    it('maps a successful publications response into CandidateApplicationInput records', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(
        jsonResponse({
          items: [
            {
              applicationNumber: 'BX-9999999999',
              markText: 'ZENDRIA',
              markType: 'WORD',
              niceClasses: [9],
              applicantName: 'Zendria B.V.',
              filingDate: '2026-01-01',
              publicationDate: '2026-01-15',
              proceduralStatus: 'PUBLISHED',
            },
          ],
          nextCursor: 'cursor-2',
          hasMore: true,
        }),
      );

      const connector = new BoipConnector({
        apiBaseUrl: 'https://datolite.example.com',
        apiKey: 'test-key',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });

      const result = await connector.fetchPublications({ pageSize: 50 });

      expect(result.applications).toHaveLength(1);
      expect(result.applications[0]?.markText).toBe('ZENDRIA');
      expect(result.hasMore).toBe(true);
      expect(result.nextCheckpoint?.cursor).toBe('cursor-2');

      const [, requestInit] = fetchImpl.mock.calls[0] as [URL, RequestInit];
      expect((requestInit.headers as Record<string, string>)['Authorization']).toBe('Bearer test-key');
    });

    it('throws ConnectorRateLimitError with a retryAfterMs hint on HTTP 429', async () => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValue(jsonResponse({ message: 'slow down' }, { status: 429, headers: { 'Retry-After': '2' } }));

      const connector = new BoipConnector({
        apiBaseUrl: 'https://datolite.example.com',
        apiKey: 'test-key',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });

      await expect(connector.fetchPublications({})).rejects.toMatchObject({
        code: 'rate_limited',
        retryAfterMs: 2000,
      });
    });

    it('returns null (not an error) when a trademark lookup 404s', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));

      const connector = new BoipConnector({
        apiBaseUrl: 'https://datolite.example.com',
        apiKey: 'test-key',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });

      const snapshot = await connector.fetchTrademarkByNumber('BX-0000000000');
      expect(snapshot).toBeNull();
    });

    it('throws ConnectorParseError when the response does not match the expected schema', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ unexpected: 'shape' }));

      const connector = new BoipConnector({
        apiBaseUrl: 'https://datolite.example.com',
        apiKey: 'test-key',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });

      await expect(connector.fetchPublications({})).rejects.toMatchObject({ code: 'parse_error' });
    });
  });
});
