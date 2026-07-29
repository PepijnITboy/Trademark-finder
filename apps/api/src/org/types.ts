import type {
  FeatureFlag,
  SubscriptionPlan,
  SubscriptionStatus,
  SupportTier,
} from '@merkwacht/domain';
import type { DigestFrequency } from '@merkwacht/validation';

export type BillingEventProvider = 'mock' | 'stripe';

export interface BillingEventRecord {
  readonly id: string;
  readonly organizationId: string;
  eventType: string;
  payload: Record<string, unknown>;
  provider: BillingEventProvider;
  readonly createdAt: string;
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

export interface NotificationRecipientRecord {
  readonly id: string;
  readonly organizationId: string;
  email: string;
  mode: 'threshold' | 'digest';
  digestCadence: DigestFrequency | null;
  /** @deprecated Prefer digestCadence — kept for API compat mirrors mode=digest */
  digestFrequency: DigestFrequency;
  /** Minimum match score when mode=threshold; null for digest. */
  minScoreThreshold: number | null;
  isActive: boolean;
  watchedTrademarkIds: string[];
  readonly createdAt: string;
  updatedAt: string;
}

export interface SubscriptionStateRecord {
  readonly organizationId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  pendingPlan: SubscriptionPlan | null;
  currentPeriodEnd: string;
  /** True when the customer requested cancellation effective at `currentPeriodEnd`. */
  cancelAtPeriodEnd: boolean;
  /** ISO timestamp of the next invoice, typically `currentPeriodEnd` while active; null once cancellation takes effect. */
  nextInvoiceAt: string | null;
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
  /** When false, plan is hidden from new customer selection. */
  isActive: boolean;
  updatedAt: string;
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
  /** Total incl. BTW, in cents — kept as the historical/primary amount field. */
  amountCents: number;
  /** Total excl. BTW, in cents. */
  exVatCents: number;
  /** Total NL BTW (21%), in cents. */
  btwCents: number;
  currency: 'EUR';
  description: string;
  lineItems?: readonly InvoiceLineItemRecord[];
  paidAt: string | null;
  dueAt: string | null;
  /** Platform-only note when marking paid; never exposed on customer invoice APIs. */
  internalNote: string | null;
  pdfAvailable: boolean;
  ublXmlAvailable: boolean;
  readonly createdAt: string;
  updatedAt: string;
}

export interface OrganizationListItem {
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
  readonly kind: 'match' | 'admin' | 'report_ready' | 'connector_down' | 'invoice' | 'general';
  readonly sentByUserId: string;
  readonly createdAt: string;
  readAt: string | null;
}

export type SupportParticipantType = 'customer_user' | 'platform_operator' | 'external_firm';

export interface SupportParticipantRecord {
  readonly id: string;
  readonly threadId: string;
  participantType: SupportParticipantType;
  displayName: string;
  actorUserId: string | null;
  readonly joinedAt: string;
}

export interface SupportMessageRecord {
  readonly id: string;
  readonly threadId: string;
  readonly participantId: string;
  body: string;
  readonly createdAt: string;
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

export interface ParsedAddressResult {
  readonly addressLine: string;
  readonly postalCode: string;
  readonly city: string;
  readonly country: string;
  readonly latitude: number;
  readonly longitude: number;
}
