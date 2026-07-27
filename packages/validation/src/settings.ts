import { z } from 'zod';

export const digestFrequencySchema = z.enum(['DAILY', 'WEEKLY', 'IMMEDIATE']);
export type DigestFrequency = z.infer<typeof digestFrequencySchema>;

export const organizationSettingsSchema = z.object({
  locale: z.enum(['nl-NL', 'en-US']).default('nl-NL'),
  timezone: z.string().min(1).default('Europe/Amsterdam'),
  notificationEmail: z.string().email('Ongeldig e-mailadres.'),
  digestFrequency: digestFrequencySchema.default('DAILY'),
});
export type OrganizationSettingsInput = z.infer<typeof organizationSettingsSchema>;
