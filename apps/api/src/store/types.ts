import type {
  CandidateApplication,
  MatchStatus as DomainMatchStatus,
  NotificationPayload,
  TrademarkMatchScores,
  WatchEligibilityDecision,
  WatchedTrademarkStatus,
} from '@merkwacht/domain';
import type { DigestFrequency } from '@merkwacht/validation';

/** A watched trademark as persisted/returned by the API. Mirrors `@merkwacht/domain`'s `WatchedTrademark`, scoped to an organization. */
export interface WatchedTrademarkRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly label: string;
  readonly notes: string | null;
  readonly status: WatchedTrademarkStatus;
  readonly registryCode: string;
  readonly registrationNumber: string;
  readonly markText: string;
  readonly niceClasses: readonly number[];
  readonly eligibility: WatchEligibilityDecision;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateWatchedTrademarkRecordInput {
  readonly label: string;
  readonly notes?: string | null;
  readonly registryCode: string;
  readonly registrationNumber: string;
  readonly markText: string;
  readonly niceClasses: readonly number[];
  readonly eligibility: WatchEligibilityDecision;
}

export interface UpdateWatchedTrademarkSettingsInput {
  readonly label?: string | undefined;
  readonly notes?: string | null | undefined;
}

/** A single free-text reviewer note attached to a match. */
export interface MatchNoteRecord {
  readonly id: string;
  readonly matchId: string;
  readonly note: string;
  readonly createdAt: string;
}

/**
 * A trademark match as persisted/returned by the API. Extends
 * `@merkwacht/domain`'s scoring/status vocabulary with the embedded
 * candidate application, so `GET /matches/:id` and the deadlines/export
 * endpoints don't need a second lookup - a deliberate denormalization for
 * API read models (the underlying `trademark_match`/`candidate_application`
 * tables stay normalized, see `docs/database/schema.md`).
 */
export interface TrademarkMatchRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly watchedTrademarkId: string;
  readonly watchedTrademarkLabel: string;
  readonly candidate: CandidateApplication;
  readonly status: DomainMatchStatus;
  readonly scores: TrademarkMatchScores;
  readonly totalScore: number;
  readonly weightProfileId: string;
  readonly reviewedBy: string | null;
  readonly reviewedAt: string | null;
  readonly advisorRequestedAt: string | null;
  readonly notes: readonly MatchNoteRecord[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RegisterSourceStatusRecord {
  readonly registryCode: string;
  readonly displayName: string;
  readonly status: string;
  readonly message: string;
  readonly checkedAt: string;
}

export interface NotificationRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly payload: NotificationPayload;
  readonly channel: string;
  readonly sentAt: string | null;
  readonly createdAt: string;
}

export interface OrganizationSettingsRecord {
  readonly organizationId: string;
  readonly locale: string;
  readonly timezone: string;
  readonly notificationEmail: string;
  readonly digestFrequency: DigestFrequency;
  readonly updatedAt: string;
}

export interface UpdateOrganizationSettingsInput {
  readonly locale?: string | undefined;
  readonly timezone?: string | undefined;
  readonly notificationEmail?: string | undefined;
  readonly digestFrequency?: DigestFrequency | undefined;
}

export interface ListMatchesFilter {
  readonly status?: DomainMatchStatus;
}

/**
 * Persistence contract every API route depends on. Implemented by
 * `DemoStore` (in-memory, always available) and `PostgresStore` (backed by
 * `@merkwacht/database`'s admin client). `createAppStore` picks between the
 * two - see `store/create-store.ts`.
 */
export interface AppStore {
  readonly kind: 'demo' | 'postgres';

  listWatchedTrademarks(organizationId: string): Promise<readonly WatchedTrademarkRecord[]>;
  getWatchedTrademark(organizationId: string, id: string): Promise<WatchedTrademarkRecord | null>;
  createWatchedTrademark(
    organizationId: string,
    input: CreateWatchedTrademarkRecordInput,
  ): Promise<WatchedTrademarkRecord>;
  updateWatchedTrademarkSettings(
    organizationId: string,
    id: string,
    patch: UpdateWatchedTrademarkSettingsInput,
  ): Promise<WatchedTrademarkRecord | null>;
  setWatchedTrademarkStatus(
    organizationId: string,
    id: string,
    status: WatchedTrademarkStatus,
  ): Promise<WatchedTrademarkRecord | null>;

  listMatches(
    organizationId: string,
    filter?: ListMatchesFilter,
  ): Promise<readonly TrademarkMatchRecord[]>;
  getMatch(organizationId: string, id: string): Promise<TrademarkMatchRecord | null>;
  updateMatchStatus(
    organizationId: string,
    id: string,
    status: DomainMatchStatus,
    reviewedBy: string,
  ): Promise<TrademarkMatchRecord | null>;
  addMatchNote(organizationId: string, id: string, note: string): Promise<MatchNoteRecord | null>;
  requestAdvisorReview(organizationId: string, id: string): Promise<TrademarkMatchRecord | null>;

  listRegisterSources(): Promise<readonly RegisterSourceStatusRecord[]>;
  listNotifications(organizationId: string): Promise<readonly NotificationRecord[]>;

  getOrganizationSettings(organizationId: string): Promise<OrganizationSettingsRecord>;
  updateOrganizationSettings(
    organizationId: string,
    patch: UpdateOrganizationSettingsInput,
  ): Promise<OrganizationSettingsRecord>;
}
