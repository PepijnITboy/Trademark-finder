/**
 * Sample watched-trademark names used throughout tests and local seed
 * scripts. Kept intentionally fictional/distinctive so they never collide
 * with real registered marks.
 */
export const SAMPLE_TRADEMARK_NAMES = [
  'LUMARO',
  'NOVEXA',
  'BRENTIQ',
  'VELORA',
  'KASTORIN',
  'ZENDRIA',
  'ARQUINOX',
  'FLORIANT',
] as const;
export type SampleTrademarkName = (typeof SAMPLE_TRADEMARK_NAMES)[number];

/**
 * Mirrors `DEV_SEED_IDS` from `@merkwacht/database`. Duplicated (rather
 * than imported) so this package has no runtime dependency on the
 * database package; keep these values in sync manually if the seed IDs
 * ever change.
 */
export const SAMPLE_SEED_IDS = {
  organizationId: '00000000-0000-4000-8000-000000000001',
  workspaceId: '00000000-0000-4000-8000-000000000002',
  userId: '00000000-0000-4000-8000-000000000003',
} as const;

export const SAMPLE_ORGANIZATION = {
  id: SAMPLE_SEED_IDS.organizationId,
  name: 'Voorbeeld Merkenbureau B.V.',
};

export const SAMPLE_WATCHED_TRADEMARK = {
  name: 'LUMARO',
  ownerName: SAMPLE_ORGANIZATION.name,
  jurisdictions: ['BENELUX'] as const,
  niceClasses: [9, 42] as const,
};
