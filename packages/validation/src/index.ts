import { z } from 'zod';

export { jurisdictionSchema, niceClassSchema, watchedTrademarkCreateSchema, watchedTrademarkLookupSchema } from './watched-trademarks';
export type { Jurisdiction, WatchedTrademarkCreateInput, WatchedTrademarkLookupInput } from './watched-trademarks';

export { matchStatusSchema, matchStatusUpdateSchema } from './matches';
export type { MatchStatus, MatchStatusUpdateInput } from './matches';

export { digestFrequencySchema, organizationSettingsSchema } from './settings';
export type { DigestFrequency, OrganizationSettingsInput } from './settings';

export {
  candidateApplicationInputSchema,
  markTypeSchema,
  niceClassificationSchema,
  proceduralStatusSchema,
} from './candidate-application';
export type { CandidateApplicationInputShape } from './candidate-application';

export {
  addressParseSchema,
  changePlanSchema,
  createChatMessageSchema,
  createChatThreadSchema,
  createMemberSchema,
  kvkNumberSchema,
  memberRoleSchema,
  notificationRecipientSchema,
  organizationLocaleSchema,
  organizationProfileSchema,
  updateMemberSchema,
  updateNotificationRecipientSchema,
} from './organization';
export type { OrganizationProfileInput } from './organization';

export { isValidBusinessEmail, suggestEmailFixes } from './email-smart';

/** Re-export zod for consumers that already import from validation. */
export { z };
