/**
 * Client-side mirror of `apps/api/src/store/types.ts`'s response records.
 * Kept as plain types (rather than importing from `@merkwacht/api`, which
 * isn't published as a consumable package) so the web app has a stable,
 * explicit contract for every API response shape it renders.
 */
import type {
  CandidateApplication,
  ConnectorHealthStatus,
  MatchStatus,
  NotificationPayload,
  TrademarkMatchScores,
  WatchEligibilityDecision,
  WatchedTrademarkStatus,
} from '@merkwacht/domain';
import type { DigestFrequency } from '@merkwacht/validation';

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

export interface MatchNoteRecord {
  readonly id: string;
  readonly matchId: string;
  readonly note: string;
  readonly createdAt: string;
}

export interface TrademarkMatchRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly watchedTrademarkId: string;
  readonly watchedTrademarkLabel: string;
  readonly candidate: CandidateApplication;
  readonly status: MatchStatus;
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
  readonly status: ConnectorHealthStatus | 'not_yet_supported';
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
  readonly locale?: string;
  readonly timezone?: string;
  readonly notificationEmail?: string;
  readonly digestFrequency?: DigestFrequency;
}

export interface DeadlineEntry {
  readonly matchId: string;
  readonly watchedTrademarkId: string;
  readonly watchedTrademarkLabel: string;
  readonly candidateMarkText: string;
  readonly registryCode: string;
  readonly deadline: {
    readonly candidateApplicationId: string;
    readonly registryCode: string;
    readonly startDate: string;
    readonly deadlineDate: string;
    readonly calculatedAt: string;
  } | null;
  readonly daysRemaining: number | null;
}

export interface DashboardResponse {
  readonly kpis: {
    readonly watchedTrademarks: number;
    readonly newMatches: number;
    readonly matchesInReview: number;
    readonly upcomingDeadlines: number;
  };
  readonly recentMatches: readonly TrademarkMatchRecord[];
  readonly upcomingDeadlines: readonly DeadlineEntry[];
}

export interface ArchiveResponse {
  readonly watchedTrademarks: readonly WatchedTrademarkRecord[];
  readonly matches: readonly TrademarkMatchRecord[];
}

export interface LookupCandidate {
  readonly registryCode: string;
  readonly registrationNumber: string;
  readonly markText: string;
  readonly markType: string;
  readonly niceClasses: readonly number[];
  readonly applicantName: string;
  readonly filingDate: string;
  readonly registrationDate: string | null;
  readonly registerStatus: string;
  readonly eligibility: WatchEligibilityDecision;
}

export interface LookupResponse {
  readonly query: string;
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly results: readonly LookupCandidate[];
}

export interface CreateWatchedTrademarkInput {
  readonly label: string;
  readonly notes?: string;
  readonly registryCode: string;
  readonly registrationNumber: string;
}

export interface PlatformHealthResponse {
  readonly status: string;
  readonly service: string;
  readonly timestamp: string;
}
