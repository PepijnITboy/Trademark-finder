import type { NotificationChannel } from './statuses.js';

/**
 * Discriminated union of every notification Merkwacht can send. Kept as a
 * closed set (rather than a free-form `type: string`) so every notification
 * type has statically-checked, purpose-specific data.
 */
export type NotificationPayload =
  | {
      readonly type: 'new_match';
      readonly organizationId: string;
      readonly watchedTrademarkId: string;
      readonly trademarkMatchId: string;
      readonly totalScore: number;
    }
  | {
      readonly type: 'opposition_deadline_reminder';
      readonly organizationId: string;
      readonly watchedTrademarkId: string;
      readonly trademarkMatchId: string;
      readonly deadlineDate: string;
      readonly daysRemaining: number;
    }
  | {
      readonly type: 'opposition_deadline_passed';
      readonly organizationId: string;
      readonly watchedTrademarkId: string;
      readonly trademarkMatchId: string;
      readonly deadlineDate: string;
    }
  | {
      readonly type: 'connector_down';
      readonly registryCode: string;
      readonly healthStatus: string;
    }
  | {
      readonly type: 'ai_budget_exhausted';
      readonly monthlyBudgetEur: number;
      readonly spentEur: number;
    };

/** A notification's type discriminant, useful for exhaustive switches/filters. */
export type NotificationType = NotificationPayload['type'];

/** Envelope wrapping a payload with delivery metadata for a single channel. */
export interface NotificationDelivery {
  readonly id: string;
  readonly channel: NotificationChannel;
  readonly payload: NotificationPayload;
  readonly sentAt: string | null;
  readonly createdAt: string;
}
