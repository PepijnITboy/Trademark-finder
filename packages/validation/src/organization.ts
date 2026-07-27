import { z } from 'zod';
import { digestFrequencySchema } from './settings.js';

const nlPhoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s()-]{8,20}$/, 'Ongeldig telefoonnummer.')
  .optional()
  .or(z.literal(''));

export const kvkNumberSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{8}$/, 'KVK-nummer moet uit 8 cijfers bestaan.')
  .optional()
  .or(z.literal(''));

export const organizationProfileSchema = z.object({
  legalName: z.string().trim().min(1, 'Bedrijfsnaam is verplicht.').max(200),
  addressLine: z.string().trim().max(300).default(''),
  postalCode: z.string().trim().max(20).default(''),
  city: z.string().trim().max(100).default(''),
  country: z.string().trim().length(2).default('NL'),
  kvkNumber: kvkNumberSchema,
  contactEmail: z.string().email('Ongeldig e-mailadres.').optional().or(z.literal('')),
  billingEmail: z.string().email('Ongeldig e-mailadres.').optional().or(z.literal('')),
  phone: nlPhoneSchema,
});
export type OrganizationProfileInput = z.infer<typeof organizationProfileSchema>;

export const organizationLocaleSchema = z.object({
  locale: z.enum(['nl-NL', 'en-US']),
  timezone: z.string().min(1),
});

export const memberRoleSchema = z.enum(['admin', 'jurist']);

export const createMemberSchema = z.object({
  email: z.string().email('Ongeldig e-mailadres.'),
  displayName: z.string().trim().min(1).max(120),
  role: memberRoleSchema.default('jurist'),
  jobTitle: z.string().trim().max(120).optional(),
  phone: nlPhoneSchema,
});

export const updateMemberSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  role: memberRoleSchema.optional(),
  jobTitle: z.string().trim().max(120).optional().nullable(),
  phone: nlPhoneSchema.nullable().optional(),
});

export const notificationRecipientSchema = z.object({
  email: z.string().email('Ongeldig e-mailadres.'),
  digestFrequency: digestFrequencySchema.default('DAILY'),
  minScoreThreshold: z.number().min(0).max(100).default(50),
  watchedTrademarkIds: z.array(z.string().uuid()).optional(),
  allWatches: z.boolean().default(true),
});

export const updateNotificationRecipientSchema = z.object({
  digestFrequency: digestFrequencySchema.optional(),
  minScoreThreshold: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
  watchedTrademarkIds: z.array(z.string().uuid()).optional(),
  allWatches: z.boolean().optional(),
});

export const changePlanSchema = z.object({
  plan: z.enum(['basis', 'starter', 'plus', 'pro', 'enterprise']),
});

export const createChatThreadSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  body: z.string().trim().min(1).max(5000),
  trademarkMatchId: z.string().uuid().optional(),
});

export const createChatMessageSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

export const addressParseSchema = z.object({
  addressLine: z.string().trim().min(3).max(300),
});
