import { z } from 'zod';

export const matchStatusSchema = z.enum(['NEW', 'IN_REVIEW', 'RELEVANT', 'DISMISSED', 'ESCALATED']);
export type MatchStatus = z.infer<typeof matchStatusSchema>;

export const matchStatusUpdateSchema = z.object({
  matchId: z.string().uuid('Ongeldig match-ID.'),
  status: matchStatusSchema,
  note: z.string().trim().max(2000).optional(),
});
export type MatchStatusUpdateInput = z.infer<typeof matchStatusUpdateSchema>;
