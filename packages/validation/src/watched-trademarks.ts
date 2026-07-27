import { z } from 'zod';

/** Jurisdictions supported by the watch/lookup flow. */
export const jurisdictionSchema = z.enum(['BENELUX', 'EUROPEAN_UNION', 'INTERNATIONAL']);
export type Jurisdiction = z.infer<typeof jurisdictionSchema>;

/** Nice classification classes range from 1 to 45. */
export const niceClassSchema = z.number().int().min(1).max(45);

export const watchedTrademarkLookupSchema = z.object({
  query: z.string().trim().min(2, 'Zoekterm moet minimaal 2 tekens bevatten.').max(200),
  jurisdictions: z.array(jurisdictionSchema).min(1).default(['BENELUX']),
  niceClasses: z.array(niceClassSchema).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type WatchedTrademarkLookupInput = z.infer<typeof watchedTrademarkLookupSchema>;

export const watchedTrademarkCreateSchema = z.object({
  name: z.string().trim().min(1, 'Merknaam is verplicht.').max(300),
  ownerName: z.string().trim().min(1, 'Naam van de merkhouder is verplicht.').max(300),
  jurisdictions: z.array(jurisdictionSchema).min(1, 'Kies minimaal één rechtsgebied.'),
  niceClasses: z.array(niceClassSchema).min(1, 'Kies minimaal één Nice-klasse.'),
  notes: z.string().trim().max(2000).optional(),
});
export type WatchedTrademarkCreateInput = z.infer<typeof watchedTrademarkCreateSchema>;
