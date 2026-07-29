/**
 * Classification schemes per trademark register.
 * Nice 1–45 is the default for EU/most T1/T2 offices; US legacy A/B/200
 * must never be treated as Nice classes in UI or scoring.
 */

export const CLASSIFICATION_SCHEME_IDS = ['nice_45', 'us_legacy_cert'] as const;
export type ClassificationSchemeId = (typeof CLASSIFICATION_SCHEME_IDS)[number] | (string & {});

export interface ClassificationClass {
  readonly code: number | string;
  readonly labelNl: string;
}

export interface ClassificationScheme {
  readonly id: ClassificationSchemeId;
  readonly labelNl: string;
  readonly classes: readonly ClassificationClass[];
}

const NICE_CLASS_LABELS_NL: Readonly<Record<number, string>> = {
  1: 'Chemische producten',
  2: 'Vervven, vernissen',
  3: 'Cosmetica, reiniging',
  4: 'Industrieële oliën, brandstoffen',
  5: 'Farmaceutica',
  6: 'Metalen',
  7: 'Machines',
  8: 'Handgereedschap',
  9: 'Wetenschappelijke apparatuur, software',
  10: 'Medische instrumenten',
  11: 'Verlichting, verwarming',
  12: 'Voertuigen',
  13: 'Vuurwapens',
  14: 'Edelmetalen, juwelen',
  15: 'Muziekinstrumenten',
  16: 'Papier, drukwerk',
  17: 'Rubber, isolatie',
  18: 'Lederwaren',
  19: 'Bouwmaterialen (niet-metaal)',
  20: 'Meubelen',
  21: 'Huishoudelijke artikelen',
  22: 'Touwen, zakken',
  23: 'Garens',
  24: 'Textiel',
  25: 'Kleding',
  26: 'Kant, knopen',
  27: 'Tapijten',
  28: 'Spellen, speelgoed',
  29: 'Vlees, zuivel',
  30: 'Koffie, bakkerij',
  31: 'Landbouwproducten',
  32: 'Dranken (niet-alcoholisch)',
  33: 'Alcoholische dranken',
  34: 'Tabak',
  35: 'Reclame, business',
  36: 'Verzekeringen, financiën',
  37: 'Bouw, reparatie',
  38: 'Telecommunicatie',
  39: 'Transport, opslag',
  40: 'Behandeling van materialen',
  41: 'Onderwijs, entertainment',
  42: 'Wetenschap, IT-diensten',
  43: 'Horeca',
  44: 'Medische/veterinaire diensten',
  45: 'Juridische diensten, beveiliging',
};

function buildNice45Classes(): readonly ClassificationClass[] {
  return Array.from({ length: 45 }, (_, i) => {
    const code = i + 1;
    return { code, labelNl: NICE_CLASS_LABELS_NL[code] ?? `Klasse ${code}` };
  });
}

/** International Nice Classification (45 classes). */
export const NICE_45_SCHEME: ClassificationScheme = {
  id: 'nice_45',
  labelNl: 'Nice-classificatie (1–45)',
  classes: buildNice45Classes(),
};

/**
 * USPTO legacy certification-mark class codes occasionally seen in older
 * TSDR data. Not comparable to Nice classes.
 */
export const US_LEGACY_CERT_SCHEME: ClassificationScheme = {
  id: 'us_legacy_cert',
  labelNl: 'VS legacy certificeringsklassen',
  classes: [
    { code: 'A', labelNl: 'Collective membership marks (A)' },
    { code: 'B', labelNl: 'Certification marks for goods/services (B)' },
    { code: 200, labelNl: 'Collective membership (200)' },
  ],
};

export const CLASSIFICATION_SCHEMES: Readonly<Record<string, ClassificationScheme>> = {
  nice_45: NICE_45_SCHEME,
  us_legacy_cert: US_LEGACY_CERT_SCHEME,
};

export function getClassificationScheme(id: ClassificationSchemeId): ClassificationScheme {
  const scheme = CLASSIFICATION_SCHEMES[id];
  if (!scheme) {
    throw new Error(`Unknown classification scheme: ${String(id)}`);
  }
  return scheme;
}

export function isNice45Scheme(id: ClassificationSchemeId): boolean {
  return id === 'nice_45';
}

/**
 * Whether Nice-class overlap scoring is valid for a watched/candidate pair.
 * Both sides must use nice_45 (or an explicit mapping). Cross-scheme pairs
 * must not fabricate overlap.
 */
export function canComputeNiceClassOverlap(
  watchedSchemeId: ClassificationSchemeId,
  candidateSchemeId: ClassificationSchemeId,
): boolean {
  return isNice45Scheme(watchedSchemeId) && isNice45Scheme(candidateSchemeId);
}

/**
 * Classes available when the user selected one or more registers.
 * Multi-register: intersection of class *codes* only when all schemes are
 * identical; otherwise returns per-scheme sets and never invents Nice 45.
 */
export function resolveClassPickerOptions(
  schemeIds: readonly ClassificationSchemeId[],
): {
  readonly comparable: boolean;
  readonly schemeId: ClassificationSchemeId | null;
  readonly classes: readonly ClassificationClass[];
  readonly perScheme: Readonly<Record<string, readonly ClassificationClass[]>>;
} {
  const unique = [...new Set(schemeIds.length ? schemeIds : (['nice_45'] as ClassificationSchemeId[]))];
  const perScheme: Record<string, readonly ClassificationClass[]> = {};
  for (const id of unique) {
    perScheme[id] = getClassificationScheme(id).classes;
  }
  if (unique.length === 1) {
    const schemeId = unique[0]!;
    return {
      comparable: true,
      schemeId,
      classes: perScheme[schemeId]!,
      perScheme,
    };
  }
  const allNice = unique.every((id) => isNice45Scheme(id));
  if (allNice) {
    return {
      comparable: true,
      schemeId: 'nice_45',
      classes: NICE_45_SCHEME.classes,
      perScheme,
    };
  }
  return {
    comparable: false,
    schemeId: null,
    classes: [],
    perScheme,
  };
}

/** Normalize a class code for set membership (numbers stay numbers, strings trim). */
export function normalizeClassCode(code: number | string): string {
  return String(code).trim().toUpperCase();
}
