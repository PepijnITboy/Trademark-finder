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

export interface WatchedTrademarkWatchSettings {
  readonly minScoreThreshold: number;
  readonly classMode: 'eigen' | 'custom' | 'all';
  readonly selectedNiceClasses: readonly number[];
  readonly watchedRegisters: readonly string[];
}

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
  readonly watchSettings: WatchedTrademarkWatchSettings;
  /** Live + enabledForWatch + last probe ok for this watch's register. */
  readonly registerMonitoringOk: boolean;
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
  readonly updatedAt: string;
}

export interface UpdateOrganizationSettingsInput {
  readonly locale?: string;
  readonly timezone?: string;
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

export interface OrganizationProfileRecord {
  readonly organizationId: string;
  legalName: string;
  addressLine: string;
  postalCode: string;
  city: string;
  country: string;
  kvkNumber: string;
  contactEmail: string;
  billingEmail: string;
  phone: string;
  latitude: number | null;
  longitude: number | null;
  readonly updatedAt: string;
}

export type OrganizationMemberRole = 'owner' | 'admin' | 'jurist';

export interface OrganizationMemberRecord {
  readonly id: string;
  readonly organizationId: string;
  email: string;
  displayName: string;
  role: OrganizationMemberRole;
  jobTitle: string | null;
  phone: string | null;
  readonly createdAt: string;
  updatedAt: string;
}

export interface ParsedAddressResult {
  readonly addressLine: string;
  readonly postalCode: string;
  readonly city: string;
  readonly country: string;
  readonly latitude: number;
  readonly longitude: number;
}

export interface NotificationRecipientRecord {
  readonly id: string;
  readonly organizationId: string;
  email: string;
  mode: 'threshold' | 'digest';
  digestCadence: DigestFrequency | null;
  digestFrequency: DigestFrequency;
  minScoreThreshold: number | null;
  isActive: boolean;
  watchedTrademarkIds: readonly string[];
  readonly createdAt: string;
  updatedAt: string;
}

export interface CreateNotificationRecipientInput {
  readonly email: string;
  readonly mode: 'threshold' | 'digest';
  readonly digestCadence?: DigestFrequency | null;
  readonly minScoreThreshold?: number | null;
  readonly allWatches?: boolean;
  readonly watchedTrademarkIds?: readonly string[];
}

export interface UpdateNotificationRecipientInput {
  readonly mode?: 'threshold' | 'digest';
  readonly digestCadence?: DigestFrequency | null;
  readonly minScoreThreshold?: number | null;
  readonly isActive?: boolean;
  readonly allWatches?: boolean;
  readonly watchedTrademarkIds?: readonly string[];
}

export type SubscriptionPlan = 'basis' | 'starter' | 'plus' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'pending_downgrade';
export type SupportTier = 'basis' | 'standaard' | 'prioriteit' | 'dedicated';
export type FeatureFlag =
  | 'ai_enrichment'
  | 'pdf_export'
  | 'csv_export'
  | 'email_notifications'
  | 'multi_register_watch'
  | 'platform_access'
  | 'merkrechten_chat';

export interface SubscriptionStateRecord {
  readonly organizationId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  pendingPlan: SubscriptionPlan | null;
  currentPeriodEnd: string;
  cancelAtPeriodEnd?: boolean;
  nextInvoiceAt?: string | null;
  updatedAt: string;
}

export interface PlanCatalogRecord {
  readonly code: SubscriptionPlan;
  displayNameNl: string;
  priceMonthlyCents: number;
  maxWatchedTrademarks: number;
  maxNotificationEmails: number;
  supportTier: SupportTier;
  features: Readonly<Record<FeatureFlag, boolean>>;
  isActive: boolean;
  updatedAt: string;
}

export interface SubscriptionEntitlements {
  readonly organizationId: string;
  readonly plan: SubscriptionPlan;
  readonly status: SubscriptionStatus;
  readonly maxWatchedTrademarks: number;
  readonly maxNotificationEmails: number;
  readonly supportTier: SupportTier;
  readonly features: Readonly<Record<FeatureFlag, boolean>>;
  readonly pendingPlan: SubscriptionPlan | null;
  readonly currentPeriodEnd: string | null;
}

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void';

export interface InvoiceLineItemRecord {
  readonly description: string;
  readonly exVatCents: number;
  readonly btwCents: number;
  readonly incVatCents: number;
}

export interface InvoiceRecord {
  readonly id: string;
  readonly organizationId: string;
  number: string;
  status: InvoiceStatus;
  amountCents: number;
  exVatCents?: number;
  btwCents?: number;
  currency?: 'EUR';
  description: string;
  lineItems?: readonly InvoiceLineItemRecord[];
  paidAt: string | null;
  dueAt?: string | null;
  pdfAvailable: boolean;
  ublXmlAvailable?: boolean;
  readonly createdAt: string;
  updatedAt: string;
}

export interface PlatformInvoiceRecord extends InvoiceRecord {
  readonly organizationName: string;
  readonly internalNote: string | null;
}

export interface PlatformOrganizationListItem {
  readonly id: string;
  readonly legalName: string;
  readonly plan: SubscriptionPlan;
  readonly status: SubscriptionStatus;
  readonly since: string;
  readonly openInvoiceCount: number;
  readonly memberCount: number;
  readonly watchedTrademarkCount: number;
}

export interface InAppNotificationRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly title: string;
  readonly body: string;
  readonly kind?: 'match' | 'admin' | 'report_ready' | 'connector_down' | 'invoice' | 'general';
  readonly sentByUserId: string;
  readonly createdAt: string;
  readAt: string | null;
}

export interface UpdatePlanCatalogInput {
  readonly displayNameNl?: string;
  readonly priceMonthlyCents?: number;
  readonly maxWatchedTrademarks?: number;
  readonly maxNotificationEmails?: number;
  readonly supportTier?: SupportTier;
  readonly features?: Partial<Record<FeatureFlag, boolean>>;
  readonly isActive?: boolean;
}

export type SupportThreadStatus = 'open' | 'closed';

export interface SupportThreadRecord {
  readonly id: string;
  readonly organizationId: string;
  subject: string;
  status: SupportThreadStatus;
  trademarkMatchId: string | null;
  readonly createdAt: string;
  updatedAt: string;
}

export interface SupportMessageRecord {
  readonly id: string;
  readonly threadId: string;
  readonly participantId: string;
  body: string;
  readonly createdAt: string;
}

export interface SupportParticipantRecord {
  readonly id: string;
  readonly threadId: string;
  participantType: 'customer_user' | 'platform_operator' | 'external_firm';
  displayName: string;
  actorUserId: string | null;
  readonly joinedAt: string;
}

export interface ChatThreadDetail {
  readonly thread: SupportThreadRecord;
  readonly messages: readonly SupportMessageRecord[];
  readonly participants: readonly SupportParticipantRecord[];
}

export interface PlatformChatThreadRecord extends SupportThreadRecord {
  readonly messageCount: number;
  readonly organizationName: string;
}
