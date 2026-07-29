import { beforeEach, describe, expect, it } from 'vitest';
import { ConnectorConfigurationError } from '../core/register-errors.js';
import { parseWipoDeltaFileDate } from './wipo.ftp-client.js';
import { WIPO_ST66_FIXTURE_XML } from './wipo.fixtures.js';
import { parseSt66XmlToRecords } from './wipo.st66-parser.js';
import { WipoMadridConnector } from './wipo.connector.js';

describe('parseSt66XmlToRecords', () => {
  it('extracts transaction records from fixture ST.66 XML', () => {
    const records = parseSt66XmlToRecords(WIPO_ST66_FIXTURE_XML);
    expect(records).toHaveLength(3);
    expect(records[0]?.markText).toBe('LUMAROWORLD');
    expect(records[0]?.niceClasses).toEqual([9, 42]);
  });

  it('returns an empty array for XML with no transactions', () => {
    expect(parseSt66XmlToRecords('<Transaction></Transaction>')).toEqual([]);
  });
});

describe('parseWipoDeltaFileDate', () => {
  it('extracts a yyyymmdd checkpoint from a daily delta filename', () => {
    expect(parseWipoDeltaFileDate('20260728.zip')).toBe('20260728');
  });

  it('returns null for filenames that do not match the expected pattern', () => {
    expect(parseWipoDeltaFileDate('bad.zip')).toBeNull();
    expect(parseWipoDeltaFileDate('20260728.tar.gz')).toBeNull();
  });
});

describe('WipoMadridConnector', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env['WIPO_FTP_HOST'];
    delete process.env['WIPO_FTP_USER'];
    delete process.env['WIPO_FTP_PASSWORD'];
    delete process.env['WIPO_USE_FIXTURES'];
  });

  describe('without FTP credentials and without fixtures', () => {
    it('reports configuration_required from healthCheck without touching any FTP client', async () => {
      const connector = new WipoMadridConnector({});
      const report = await connector.healthCheck();
      expect(report.status).toBe('configuration_required');
    });

    it('throws ConnectorConfigurationError from fetchPublications', async () => {
      const connector = new WipoMadridConnector({});
      await expect(connector.fetchPublications({})).rejects.toBeInstanceOf(ConnectorConfigurationError);
    });

    it('throws ConnectorConfigurationError from fetchTrademarkByNumber', async () => {
      const connector = new WipoMadridConnector({});
      await expect(connector.fetchTrademarkByNumber('WO-1876543')).rejects.toBeInstanceOf(
        ConnectorConfigurationError,
      );
    });
  });

  describe('with credentials but no injected WipoFtpClient', () => {
    it('still reports configuration_required (transport is required too)', async () => {
      const connector = new WipoMadridConnector({
        credentials: { host: 'ftp.example', user: 'u', password: 'p' },
      });
      expect((await connector.healthCheck()).status).toBe('configuration_required');
    });
  });

  describe('in fixture mode', () => {
    it('reports a healthy status without any credentials', async () => {
      const connector = new WipoMadridConnector({ useFixtures: true });
      expect((await connector.healthCheck()).status).toBe('ok');
    });

    it('serves fixture ST.66 publications paginated with a resumable checkpoint', async () => {
      const connector = new WipoMadridConnector({ useFixtures: true });

      const first = await connector.fetchPublications({ pageSize: 1 });
      expect(first.applications).toHaveLength(1);
      expect(first.hasMore).toBe(true);

      const second = await connector.fetchPublications({ since: first.nextCheckpoint });
      const applicationNumbers = [...first.applications, ...second.applications].map((a) => a.applicationNumber);
      expect(new Set(applicationNumbers).size).toBe(3);
    });

    it('serves a fixture trademark snapshot by registration number, and null for unknown numbers', async () => {
      const connector = new WipoMadridConnector({ useFixtures: true });
      const snapshot = await connector.fetchTrademarkByNumber('WO-1876543');
      expect(snapshot?.markText).toBe('LUMAROINT');
      expect(await connector.fetchTrademarkByNumber('WO-DOES-NOT-EXIST')).toBeNull();
    });
  });

  describe('with credentials and an injected WipoFtpClient (live path)', () => {
    it('fetches the earliest pending daily delta and derives a yyyymmdd checkpoint', async () => {
      const connector = new WipoMadridConnector({
        credentials: { host: 'ftp.example', user: 'u', password: 'p' },
        ftpClient: {
          async listDailyDeltaNames() {
            return ['20260727.zip', '20260728.zip'];
          },
          async downloadDailyDelta(fileName) {
            expect(fileName).toBe('20260727.zip');
            return Buffer.from(WIPO_ST66_FIXTURE_XML, 'utf8');
          },
        },
      });

      const result = await connector.fetchPublications({});
      expect(result.applications).toHaveLength(3);
      expect(result.nextCheckpoint?.cursor).toBe('20260727');
      expect(result.hasMore).toBe(true);
    });

    it('resumes from a yyyymmdd checkpoint, only considering later delta files', async () => {
      const connector = new WipoMadridConnector({
        credentials: { host: 'ftp.example', user: 'u', password: 'p' },
        ftpClient: {
          async listDailyDeltaNames() {
            return ['20260727.zip', '20260728.zip'];
          },
          async downloadDailyDelta(fileName) {
            expect(fileName).toBe('20260728.zip');
            return Buffer.from(WIPO_ST66_FIXTURE_XML, 'utf8');
          },
        },
      });

      const result = await connector.fetchPublications({
        since: { registryCode: 'WIPO', cursor: '20260727', updatedAt: new Date().toISOString() },
      });
      expect(result.nextCheckpoint?.cursor).toBe('20260728');
      expect(result.hasMore).toBe(false);
    });

    it('returns no applications and preserves the checkpoint when there are no newer delta files', async () => {
      const connector = new WipoMadridConnector({
        credentials: { host: 'ftp.example', user: 'u', password: 'p' },
        ftpClient: {
          async listDailyDeltaNames() {
            return ['20260727.zip'];
          },
          async downloadDailyDelta() {
            throw new Error('should not be called');
          },
        },
      });

      const result = await connector.fetchPublications({
        since: { registryCode: 'WIPO', cursor: '20260727', updatedAt: new Date().toISOString() },
      });
      expect(result.applications).toEqual([]);
      expect(result.hasMore).toBe(false);
      expect(result.nextCheckpoint?.cursor).toBe('20260727');
    });

    it('throws ConnectorConfigurationError from fetchTrademarkByNumber even when the FTP transport is configured', async () => {
      const connector = new WipoMadridConnector({
        credentials: { host: 'ftp.example', user: 'u', password: 'p' },
        ftpClient: {
          async listDailyDeltaNames() {
            return [];
          },
          async downloadDailyDelta() {
            throw new Error('should not be called');
          },
        },
      });
      await expect(connector.fetchTrademarkByNumber('WO-1876543')).rejects.toBeInstanceOf(
        ConnectorConfigurationError,
      );
    });
  });

  it('exposes the documented placeholder opposition rule (3 months from WIPO publication date)', () => {
    const connector = new WipoMadridConnector({});
    expect(connector.getOppositionRuleSet()).toEqual({
      kind: 'months',
      months: 3,
      startsFrom: 'publication_date',
    });
  });
});
