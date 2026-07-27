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
  digestFrequency: DigestFrequency;
  /** Minimum match score (0–100) before this address is notified. */
  minScoreThreshold: number;
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
  updatedAt: string;
}

export type InvoiceStatus = 'open' | 'paid' | 'void';

export interface InvoiceRecord {
  readonly id: string;
  readonly organizationId: string;
  number: string;
  status: InvoiceStatus;
  amountCents: number;
  description: string;
  paidAt: string | null;
  pdfAvailable: boolean;
  readonly createdAt: string;
  updatedAt: string;
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
