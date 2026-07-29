import type { MatchStatus as DomainMatchStatus, WatchedTrademarkStatus } from '@merkwacht/domain';
import { DEMO_BETA_IDS, DEV_SEED_IDS } from '@merkwacht/database';
import { createId } from '@merkwacht/shared';
import { buildDemoSeed } from './demo-data.js';
import type {
  AppStore,
  CreateWatchedTrademarkRecordInput,
  ListMatchesFilter,
  MatchNoteRecord,
  NotificationRecord,
  OrganizationSettingsRecord,
  RegisterSourceStatusRecord,
  TrademarkMatchRecord,
  UpdateOrganizationSettingsInput,
  UpdateWatchedTrademarkSettingsInput,
  WatchedTrademarkRecord,
} from './types.js';

/**
 * In-memory `AppStore` implementation, seeded with fictitious demo data
 * (see `demo-data.ts`). Multi-org capable: each organizationId is seeded
 * independently so tenancy tests can exercise OrgAlpha vs OrgBeta.
 */
export class DemoStore implements AppStore {
  readonly kind = 'demo' as const;

  private readonly watchedTrademarks = new Map<string, WatchedTrademarkRecord>();
  private readonly matches = new Map<string, TrademarkMatchRecord>();
  private notifications: NotificationRecord[] = [];
  private settingsByOrg = new Map<string, OrganizationSettingsRecord>();
  private readonly seedPromises = new Map<string, Promise<void>>();

  private async ensureSeeded(organizationId: string): Promise<void> {
    const existing = this.seedPromises.get(organizationId);
    if (existing) {
      await existing;
      return;
    }
    const promise = buildDemoSeed(organizationId).then((seed) => {
      for (const watched of seed.watchedTrademarks) this.watchedTrademarks.set(watched.id, watched);
      for (const match of seed.matches) this.matches.set(match.id, match);
      this.notifications = [...this.notifications, ...seed.notifications];
      this.settingsByOrg.set(organizationId, seed.settings);
    });
    this.seedPromises.set(organizationId, promise);
    await promise;
  }

  async listWatchedTrademarks(organizationId: string): Promise<readonly WatchedTrademarkRecord[]> {
    await this.ensureSeeded(organizationId);
    return [...this.watchedTrademarks.values()].filter((w) => w.organizationId === organizationId);
  }

  async getWatchedTrademark(organizationId: string, id: string): Promise<WatchedTrademarkRecord | null> {
    await this.ensureSeeded(organizationId);
    const record = this.watchedTrademarks.get(id);
    return record && record.organizationId === organizationId ? record : null;
  }

  async createWatchedTrademark(
    organizationId: string,
    input: CreateWatchedTrademarkRecordInput,
  ): Promise<WatchedTrademarkRecord> {
    await this.ensureSeeded(organizationId);
    const now = new Date().toISOString();
    const record: WatchedTrademarkRecord = {
      id: createId(),
      organizationId,
      label: input.label,
      notes: input.notes ?? null,
      status: 'active',
      registryCode: input.registryCode,
      registrationNumber: input.registrationNumber,
      markText: input.markText,
      niceClasses: input.niceClasses,
      eligibility: input.eligibility,
      watchSettings: {
        minScoreThreshold: 25,
        classMode: 'eigen',
        selectedNiceClasses: [...input.niceClasses],
        watchedRegisters: [input.registryCode],
      },
      createdAt: now,
      updatedAt: now,
    };
    this.watchedTrademarks.set(record.id, record);
    return record;
  }

  async updateWatchedTrademarkSettings(
    organizationId: string,
    id: string,
    patch: UpdateWatchedTrademarkSettingsInput,
  ): Promise<WatchedTrademarkRecord | null> {
    const existing = await this.getWatchedTrademark(organizationId, id);
    if (!existing) return null;
    const updated: WatchedTrademarkRecord = {
      ...existing,
      label: patch.label ?? existing.label,
      notes: patch.notes === undefined ? existing.notes : patch.notes,
      watchSettings: {
        minScoreThreshold: patch.minScoreThreshold ?? existing.watchSettings.minScoreThreshold,
        classMode: patch.classMode ?? existing.watchSettings.classMode,
        selectedNiceClasses:
          patch.selectedNiceClasses !== undefined
            ? [...patch.selectedNiceClasses]
            : existing.watchSettings.selectedNiceClasses,
        watchedRegisters:
          patch.watchedRegisters !== undefined
            ? [...patch.watchedRegisters]
            : existing.watchSettings.watchedRegisters,
      },
      updatedAt: new Date().toISOString(),
    };
    this.watchedTrademarks.set(id, updated);
    return updated;
  }

  async setWatchedTrademarkStatus(
    organizationId: string,
    id: string,
    status: WatchedTrademarkStatus,
  ): Promise<WatchedTrademarkRecord | null> {
    const existing = await this.getWatchedTrademark(organizationId, id);
    if (!existing) return null;
    const updated: WatchedTrademarkRecord = { ...existing, status, updatedAt: new Date().toISOString() };
    this.watchedTrademarks.set(id, updated);
    return updated;
  }

  async listMatches(
    organizationId: string,
    filter: ListMatchesFilter = {},
  ): Promise<readonly TrademarkMatchRecord[]> {
    await this.ensureSeeded(organizationId);
    return [...this.matches.values()]
      .filter((match) => match.organizationId === organizationId)
      .filter((match) => (filter.status ? match.status === filter.status : true))
      .sort((a, b) => b.totalScore - a.totalScore);
  }

  async getMatch(organizationId: string, id: string): Promise<TrademarkMatchRecord | null> {
    await this.ensureSeeded(organizationId);
    const match = this.matches.get(id);
    return match && match.organizationId === organizationId ? match : null;
  }

  async updateMatchStatus(
    organizationId: string,
    id: string,
    status: DomainMatchStatus,
    reviewedBy: string,
  ): Promise<TrademarkMatchRecord | null> {
    const existing = await this.getMatch(organizationId, id);
    if (!existing) return null;
    const now = new Date().toISOString();
    const updated: TrademarkMatchRecord = { ...existing, status, reviewedBy, reviewedAt: now, updatedAt: now };
    this.matches.set(id, updated);
    return updated;
  }

  async addMatchNote(organizationId: string, id: string, note: string): Promise<MatchNoteRecord | null> {
    const existing = await this.getMatch(organizationId, id);
    if (!existing) return null;
    const noteRecord: MatchNoteRecord = { id: createId(), matchId: id, note, createdAt: new Date().toISOString() };
    const updated: TrademarkMatchRecord = {
      ...existing,
      notes: [...existing.notes, noteRecord],
      updatedAt: noteRecord.createdAt,
    };
    this.matches.set(id, updated);
    return noteRecord;
  }

  async requestAdvisorReview(organizationId: string, id: string): Promise<TrademarkMatchRecord | null> {
    const existing = await this.getMatch(organizationId, id);
    if (!existing) return null;
    const now = new Date().toISOString();
    const updated: TrademarkMatchRecord = { ...existing, advisorRequestedAt: now, updatedAt: now };
    this.matches.set(id, updated);
    return updated;
  }

  async listRegisterSources(): Promise<readonly RegisterSourceStatusRecord[]> {
    // Populated by the caller (routes/register-sources.ts), which queries
    // live connector health - the demo store has no opinion on connector
    // reachability.
    return [];
  }

  async listNotifications(organizationId: string): Promise<readonly NotificationRecord[]> {
    await this.ensureSeeded(organizationId);
    return this.notifications.filter((n) => n.organizationId === organizationId);
  }

  async getOrganizationSettings(organizationId: string): Promise<OrganizationSettingsRecord> {
    await this.ensureSeeded(organizationId);
    const existing = this.settingsByOrg.get(organizationId);
    if (existing) return existing;
    const fallback: OrganizationSettingsRecord = {
      organizationId,
      locale: 'nl-NL',
      timezone: 'Europe/Amsterdam',
      notificationEmail: 'onbekend@voorbeeld.nl',
      digestFrequency: 'DAILY',
      updatedAt: new Date().toISOString(),
    };
    this.settingsByOrg.set(organizationId, fallback);
    return fallback;
  }

  async updateOrganizationSettings(
    organizationId: string,
    patch: UpdateOrganizationSettingsInput,
  ): Promise<OrganizationSettingsRecord> {
    const existing = await this.getOrganizationSettings(organizationId);
    const updated: OrganizationSettingsRecord = {
      organizationId: existing.organizationId,
      locale: patch.locale ?? existing.locale,
      timezone: patch.timezone ?? existing.timezone,
      notificationEmail: patch.notificationEmail ?? existing.notificationEmail,
      digestFrequency: patch.digestFrequency ?? existing.digestFrequency,
      updatedAt: new Date().toISOString(),
    };
    this.settingsByOrg.set(organizationId, updated);
    return updated;
  }
}

/** Convenience factory — each org seeds independently on first access. */
export function createDemoStore(): DemoStore {
  return new DemoStore();
}

/** Stable demo tenant ids for tenancy suites. */
export const DEMO_STORE_TENANT_IDS = {
  alpha: DEV_SEED_IDS.organizationId,
  beta: DEMO_BETA_IDS.organizationId,
} as const;
