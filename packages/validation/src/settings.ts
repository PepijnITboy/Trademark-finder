import { z } from 'zod';

export const digestCadenceSchema = z.enum(['DAILY', 'WEEKLY', 'MONTHLY']);
export type DigestCadence = z.infer<typeof digestCadenceSchema>;

/** @deprecated Use digestCadenceSchema — kept as alias for gradual migration. */
export const digestFrequencySchema = digestCadenceSchema;
export type DigestFrequency = DigestCadence;

export const notifyModeSchema = z.enum(['threshold', 'digest']);
export type NotifyMode = z.infer<typeof notifyModeSchema>;

/** Locale/timezone only — notification emails live on notification_recipients. */
export const organizationSettingsSchema = z.object({
  locale: z.enum(['nl-NL', 'en-US']).default('nl-NL'),
  timezone: z.string().min(1).default('Europe/Amsterdam'),
});
export type OrganizationSettingsInput = z.infer<typeof organizationSettingsSchema>;
