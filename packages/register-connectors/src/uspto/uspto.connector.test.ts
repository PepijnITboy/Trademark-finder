import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectorConfigurationError } from '../core/register-errors.js';
import { UsptoConnector } from './uspto.connector.js';
import { USPTO_FIXTURE_CASE_STATUSES, USPTO_FIXTURE_GAZETTE_PUBLICATIONS } from './uspto.fixtures.js';

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...init.headers },
  });
}

describe('UsptoConnector', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env['USPTO_API_KEY'];
    delete process.env['USPTO_GAZETTE_FEED_URL'];
    delete process.env['USPTO_USE_FIXTURES'];
  });

  describe('without credentials and without fixtures', () => {
    it('reports configuration_required from healthCheck without making network calls', async () => {
      const fetchImpl = vi.fn();
      const connector = new UsptoConnector({ fetchImpl });

      const report = await connector.healthCheck();
      expect(report.status).toBe('configuration_required');
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('throws ConnectorConfigurationError from fetchPublications', async () => {
      const connector = new UsptoConnector({});
      await expect(connector.fetchPublications({})).rejects.toBeInstanceOf(ConnectorConfigurationError);
    });

    it('throws ConnectorConfigurationError from fetchTrademarkByNumber', async () => {
      const connector = new UsptoConnector({});
      await expect(connector.fetchTrademarkByNumber('US-7012345')).rejects.toBeInstanceOf(
        ConnectorConfigurationError,
      );
    });
  });

  describe('with only USPTO_API_KEY configured (no Gazette feed)', () => {
    it('reports ok health (lookup available) without a network call', async () => {
      const fetchImpl = vi.fn();
      const connector = new UsptoConnector({ apiKey: 'test-key', fetchImpl });
      const report = await connector.healthCheck();
      expect(report.status).toBe('ok');
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('still throws ConnectorConfigurationError from fetchPublications (Gazette feed missing)', async () => {
      const connector = new UsptoConnector({ apiKey: 'test-key' });
      await expect(connector.fetchPublications({})).rejects.toBeInstanceOf(ConnectorConfigurationError);
    });

    it('performs a live TSDR lookup for fetchTrademarkByNumber', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(
        jsonResponse({
          registrationNumber: 'US-7012345',
          markText: 'LUMENARY',
          niceClasses: [9, 42],
          applicantName: 'Lumenary Technologies Inc.',
          filingDate: '2022-01-15',
          registrationDate: '2022-10-04',
          status: 'REGISTERED - PRINCIPAL REGISTER',
        }),
      );
      const connector = new UsptoConnector({ apiKey: 'test-key', fetchImpl: fetchImpl as unknown as typeof fetch });

      const snapshot = await connector.fetchTrademarkByNumber('rn7012345');
      expect(snapshot?.markText).toBe('LUMENARY');
      expect(snapshot?.registerStatus).toBe('registered');

      const [, requestInit] = fetchImpl.mock.calls[0] as [URL, RequestInit];
      expect((requestInit.headers as Record<string, string>)['USPTO-API-KEY']).toBe('test-key');
    });

    it('returns null (not an error) when TSDR 404s', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
      const connector = new UsptoConnector({ apiKey: 'test-key', fetchImpl: fetchImpl as unknown as typeof fetch });
      expect(await connector.fetchTrademarkByNumber('rn0000000')).toBeNull();
    });
  });

  describe('with both USPTO_API_KEY and USPTO_GAZETTE_FEED_URL configured', () => {
    it('maps a successful Gazette response into CandidateApplicationInput records', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(
        jsonResponse({
          items: [
            {
              applicationNumber: 'US-11111111',
              markText: 'ZENDRIA',
              niceClasses: [9],
              applicantName: 'Zendria LLC',
              filingDate: '2026-01-01',
              publicationDate: '2026-02-10',
              status: 'PUBLISHED FOR OPPOSITION',
            },
          ],
          nextCursor: 'cursor-2',
          hasMore: true,
        }),
      );

      const connector = new UsptoConnector({
        apiKey: 'test-key',
        gazetteFeedUrl: 'https://gazette.example.com/feed',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });

      const result = await connector.fetchPublications({});
      expect(result.applications).toHaveLength(1);
      expect(result.applications[0]?.markText).toBe('ZENDRIA');
      expect(result.applications[0]?.proceduralStatus).toBe('opposition_period');
      expect(result.nextCheckpoint?.cursor).toBe('cursor-2');
    });
  });

  describe('in fixture mode', () => {
    it('reports a healthy status without any credentials', async () => {
      const connector = new UsptoConnector({ useFixtures: true });
      expect((await connector.healthCheck()).status).toBe('ok');
    });

    it('serves fixture publications paginated with a resumable checkpoint', async () => {
      const connector = new UsptoConnector({ useFixtures: true });
      const first = await connector.fetchPublications({ pageSize: 2 });
      expect(first.applications).toHaveLength(2);
      expect(first.nextCheckpoint?.cursor).toBe(2);

      const second = await connector.fetchPublications({ since: first.nextCheckpoint });
      const seen = new Set([...first.applications, ...second.applications].map((a) => a.applicationNumber));
      expect(seen.size).toBe(USPTO_FIXTURE_GAZETTE_PUBLICATIONS.length);
    });

    it('serves a fixture trademark snapshot by registration number', async () => {
      const connector = new UsptoConnector({ useFixtures: true });
      const [firstFixture] = USPTO_FIXTURE_CASE_STATUSES;
      if (!firstFixture) throw new Error('expected at least one fixture case status');
      const snapshot = await connector.fetchTrademarkByNumber(firstFixture.registrationNumber);
      expect(snapshot?.markText).toBe('LUMENARY');
    });

    it('returns null for an unknown registration number', async () => {
      const connector = new UsptoConnector({ useFixtures: true });
      expect(await connector.fetchTrademarkByNumber('US-DOES-NOT-EXIST')).toBeNull();
    });
  });

  it('exposes the Lanham Act §13 opposition rule (30 calendar days from publication)', () => {
    const connector = new UsptoConnector({});
    expect(connector.getOppositionRuleSet()).toEqual({
      kind: 'calendar_days',
      days: 30,
      startsFrom: 'publication_date',
    });
  });
});
