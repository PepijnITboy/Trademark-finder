export interface NotificationPayload {
  id: string;
  recipientUserId: string;
  titleNl: string;
  bodyNl: string;
  createdAt: string;
  readAt?: string;
  metadata?: Record<string, unknown>;
}

export type NotificationInput = Omit<NotificationPayload, 'id' | 'createdAt'>;

export interface NotificationChannel {
  readonly name: string;
  send(payload: NotificationInput): Promise<NotificationPayload>;
}
