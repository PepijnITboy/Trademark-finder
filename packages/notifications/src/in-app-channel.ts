import { createId } from '@merkwacht/shared';
import type { NotificationChannel, NotificationInput, NotificationPayload } from './types';

/**
 * In-memory in-app notification channel. Suitable for local development
 * and tests; back this with a persisted `notifications` table before
 * relying on it in production.
 */
export class InAppChannel implements NotificationChannel {
  readonly name = 'in-app';
  private readonly store = new Map<string, NotificationPayload>();

  async send(payload: NotificationInput): Promise<NotificationPayload> {
    const notification: NotificationPayload = {
      ...payload,
      id: createId(),
      createdAt: new Date().toISOString(),
    };
    this.store.set(notification.id, notification);
    return notification;
  }

  list(recipientUserId: string): NotificationPayload[] {
    return [...this.store.values()].filter((notification) => notification.recipientUserId === recipientUserId);
  }

  markRead(id: string): void {
    const existing = this.store.get(id);
    if (existing) {
      this.store.set(id, { ...existing, readAt: new Date().toISOString() });
    }
  }
}
