/**
 * Register catalog for watch + name-research. Managed by the platform;
 * customer UIs only read enabled entries.
 */

import type { ClassificationSchemeId } from './classification-schemes.js';

export const REGISTER_CONNECTOR_STATUSES = ['live', 'coming_soon', 'disabled'] as const;
export type RegisterConnectorStatus = (typeof REGISTER_CONNECTOR_STATUSES)[number];

export type RegisterContinent =
  | 'europe'
  | 'north_america'
  | 'south_america'
  | 'africa'
  | 'asia'
  | 'oceania'
  | 'international';

export interface RegisterCatalogEntry {
  readonly code: string;
  readonly displayNameNl: string;
  readonly regionNl: string;
  readonly continent: RegisterContinent;
  readonly classificationSchemeId: ClassificationSchemeId;
  readonly connectorStatus: RegisterConnectorStatus;
  readonly basePriceCents: number;
  readonly enabledForWatch: boolean;
  readonly enabledForNameResearch: boolean;
  /** Auth mode hint for platform cockpit. */
  readonly authMode?: 'api_key' | 'oauth' | 'ftp' | 'open_data' | 'portal';
}

function entry(
  partial: Omit<RegisterCatalogEntry, 'classificationSchemeId' | 'continent'> &
    Partial<Pick<RegisterCatalogEntry, 'classificationSchemeId' | 'continent' | 'authMode'>>,
): RegisterCatalogEntry {
  return {
    classificationSchemeId: 'nice_45',
    continent: 'europe',
    ...partial,
  };
}

export const DEFAULT_REGISTER_CATALOG: readonly RegisterCatalogEntry[] = [
  // Regional Europe
  entry({
    code: 'BOIP',
    displayNameNl: 'Benelux (BOIP)',
    regionNl: 'België, Nederland, Luxemburg',
    continent: 'europe',
    connectorStatus: 'live',
    basePriceCents: 7900,
    enabledForWatch: true,
    enabledForNameResearch: true,
    authMode: 'api_key',
  }),
  entry({
    code: 'EUIPO',
    displayNameNl: 'Europees (EUIPO)',
    regionNl: 'Europese Unie',
    continent: 'europe',
    connectorStatus: 'coming_soon',
    basePriceCents: 9900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'oauth',
  }),
  entry({
    code: 'WIPO',
    displayNameNl: 'WIPO Madrid',
    regionNl: 'Internationaal (Madrid)',
    continent: 'international',
    connectorStatus: 'coming_soon',
    basePriceCents: 14900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'ftp',
  }),
  // EU / Europe nationals
  entry({
    code: 'UKIPO',
    displayNameNl: 'Verenigd Koninkrijk (UKIPO)',
    regionNl: 'Verenigd Koninkrijk',
    connectorStatus: 'coming_soon',
    basePriceCents: 8900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'api_key',
  }),
  entry({
    code: 'DPMA',
    displayNameNl: 'Duitsland (DPMA)',
    regionNl: 'Duitsland',
    connectorStatus: 'coming_soon',
    basePriceCents: 8900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'open_data',
  }),
  entry({
    code: 'INPI',
    displayNameNl: 'Frankrijk (INPI)',
    regionNl: 'Frankrijk',
    connectorStatus: 'coming_soon',
    basePriceCents: 8900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'api_key',
  }),
  entry({
    code: 'OEPM',
    displayNameNl: 'Spanje (OEPM)',
    regionNl: 'Spanje',
    connectorStatus: 'coming_soon',
    basePriceCents: 8900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'open_data',
  }),
  entry({
    code: 'UIBM',
    displayNameNl: 'Italië (UIBM)',
    regionNl: 'Italië',
    connectorStatus: 'coming_soon',
    basePriceCents: 8900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'portal',
  }),
  entry({
    code: 'IPI_CH',
    displayNameNl: 'Zwitserland (IPI)',
    regionNl: 'Zwitserland',
    connectorStatus: 'coming_soon',
    basePriceCents: 8900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'api_key',
  }),
  entry({
    code: 'PRH',
    displayNameNl: 'Finland (PRH)',
    regionNl: 'Finland',
    connectorStatus: 'coming_soon',
    basePriceCents: 7900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'open_data',
  }),
  entry({
    code: 'PRV',
    displayNameNl: 'Zweden (PRV)',
    regionNl: 'Zweden',
    connectorStatus: 'coming_soon',
    basePriceCents: 7900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'open_data',
  }),
  entry({
    code: 'DKPTO',
    displayNameNl: 'Denemarken (DKPTO)',
    regionNl: 'Denemarken',
    connectorStatus: 'coming_soon',
    basePriceCents: 7900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'open_data',
  }),
  entry({
    code: 'NIPO',
    displayNameNl: 'Noorwegen (NIPO)',
    regionNl: 'Noorwegen',
    connectorStatus: 'coming_soon',
    basePriceCents: 7900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'api_key',
  }),
  entry({
    code: 'IPO_IE',
    displayNameNl: 'Ierland (IPO)',
    regionNl: 'Ierland',
    connectorStatus: 'coming_soon',
    basePriceCents: 7900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'open_data',
  }),
  entry({
    code: 'INPI_PT',
    displayNameNl: 'Portugal (INPI)',
    regionNl: 'Portugal',
    connectorStatus: 'coming_soon',
    basePriceCents: 7900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'portal',
  }),
  entry({
    code: 'OEPA',
    displayNameNl: 'Oostenrijk (ÖPA)',
    regionNl: 'Oostenrijk',
    connectorStatus: 'coming_soon',
    basePriceCents: 7900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'open_data',
  }),
  entry({
    code: 'UPRP',
    displayNameNl: 'Polen (UPRP)',
    regionNl: 'Polen',
    connectorStatus: 'coming_soon',
    basePriceCents: 7900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'portal',
  }),
  entry({
    code: 'UPV_CZ',
    displayNameNl: 'Tsjechië (ÚPV)',
    regionNl: 'Tsjechië',
    connectorStatus: 'coming_soon',
    basePriceCents: 7900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'open_data',
  }),
  entry({
    code: 'HIPO',
    displayNameNl: 'Hongarije (HIPO)',
    regionNl: 'Hongarije',
    connectorStatus: 'coming_soon',
    basePriceCents: 7900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'portal',
  }),
  entry({
    code: 'OBI',
    displayNameNl: 'Griekenland (OBI)',
    regionNl: 'Griekenland',
    connectorStatus: 'coming_soon',
    basePriceCents: 7900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'portal',
  }),
  entry({
    code: 'OSIM',
    displayNameNl: 'Roemenië (OSIM)',
    regionNl: 'Roemenië',
    connectorStatus: 'coming_soon',
    basePriceCents: 7900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'portal',
  }),
  entry({
    code: 'BPO',
    displayNameNl: 'Bulgarije (BPO)',
    regionNl: 'Bulgarije',
    connectorStatus: 'coming_soon',
    basePriceCents: 7900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'portal',
  }),
  entry({
    code: 'SIPO_HR',
    displayNameNl: 'Kroatië (SIPO)',
    regionNl: 'Kroatië',
    connectorStatus: 'coming_soon',
    basePriceCents: 7900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'portal',
  }),
  entry({
    code: 'IPO_SK',
    displayNameNl: 'Slowakije (IPO SR)',
    regionNl: 'Slowakije',
    connectorStatus: 'coming_soon',
    basePriceCents: 7900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'portal',
  }),
  entry({
    code: 'SIPO_SI',
    displayNameNl: 'Slovenië (SIPO)',
    regionNl: 'Slovenië',
    connectorStatus: 'coming_soon',
    basePriceCents: 7900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'portal',
  }),
  entry({
    code: 'VLS',
    displayNameNl: 'Litouwen (VLS)',
    regionNl: 'Litouwen',
    connectorStatus: 'coming_soon',
    basePriceCents: 6900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'open_data',
  }),
  entry({
    code: 'LRPV',
    displayNameNl: 'Letland (LRPV)',
    regionNl: 'Letland',
    connectorStatus: 'coming_soon',
    basePriceCents: 6900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'portal',
  }),
  entry({
    code: 'EPA',
    displayNameNl: 'Estland (EPA)',
    regionNl: 'Estland',
    connectorStatus: 'coming_soon',
    basePriceCents: 6900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'open_data',
  }),
  entry({
    code: 'DRCOR',
    displayNameNl: 'Cyprus (DRCOR)',
    regionNl: 'Cyprus',
    connectorStatus: 'coming_soon',
    basePriceCents: 6900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'portal',
  }),
  entry({
    code: 'IPOMT',
    displayNameNl: 'Malta (IPOMT)',
    regionNl: 'Malta',
    connectorStatus: 'coming_soon',
    basePriceCents: 6900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'portal',
  }),
  // Majors outside Europe
  entry({
    code: 'USPTO',
    displayNameNl: 'Verenigde Staten (USPTO)',
    regionNl: 'Verenigde Staten',
    continent: 'north_america',
    classificationSchemeId: 'nice_45',
    connectorStatus: 'coming_soon',
    basePriceCents: 11900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'api_key',
  }),
  entry({
    code: 'CIPO',
    displayNameNl: 'Canada (CIPO)',
    regionNl: 'Canada',
    continent: 'north_america',
    connectorStatus: 'coming_soon',
    basePriceCents: 9900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'open_data',
  }),
  entry({
    code: 'IPAU',
    displayNameNl: 'Australië (IP Australia)',
    regionNl: 'Australië',
    continent: 'oceania',
    connectorStatus: 'coming_soon',
    basePriceCents: 9900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'api_key',
  }),
  entry({
    code: 'INPI_BR',
    displayNameNl: 'Brazilië (INPI)',
    regionNl: 'Brazilië',
    continent: 'south_america',
    connectorStatus: 'coming_soon',
    basePriceCents: 9900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'portal',
  }),
  entry({
    code: 'CIPC',
    displayNameNl: 'Zuid-Afrika (CIPC)',
    regionNl: 'Zuid-Afrika',
    continent: 'africa',
    connectorStatus: 'coming_soon',
    basePriceCents: 8900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'portal',
  }),
  entry({
    code: 'IMPI',
    displayNameNl: 'Mexico (IMPI)',
    regionNl: 'Mexico',
    continent: 'north_america',
    connectorStatus: 'coming_soon',
    basePriceCents: 8900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'portal',
  }),
  entry({
    code: 'JPO',
    displayNameNl: 'Japan (JPO)',
    regionNl: 'Japan',
    continent: 'asia',
    connectorStatus: 'coming_soon',
    basePriceCents: 10900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'api_key',
  }),
  entry({
    code: 'KIPO',
    displayNameNl: 'Zuid-Korea (KIPO)',
    regionNl: 'Zuid-Korea',
    continent: 'asia',
    connectorStatus: 'coming_soon',
    basePriceCents: 10900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'api_key',
  }),
  entry({
    code: 'IPO_IN',
    displayNameNl: 'India (IPO)',
    regionNl: 'India',
    continent: 'asia',
    connectorStatus: 'coming_soon',
    basePriceCents: 8900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'portal',
  }),
  entry({
    code: 'CNIPA',
    displayNameNl: 'China (CNIPA)',
    regionNl: 'China',
    continent: 'asia',
    connectorStatus: 'coming_soon',
    basePriceCents: 11900,
    enabledForWatch: false,
    enabledForNameResearch: true,
    authMode: 'portal',
  }),
];

export function registersForNameResearch(
  catalog: readonly RegisterCatalogEntry[],
): readonly RegisterCatalogEntry[] {
  return catalog.filter(
    (r) =>
      r.enabledForNameResearch &&
      r.connectorStatus !== 'disabled' &&
      (r.connectorStatus === 'live' || r.connectorStatus === 'coming_soon'),
  );
}

/** Registers that can actually run a live name-research scan right now. */
export function registersLiveForNameResearch(
  catalog: readonly RegisterCatalogEntry[],
): readonly RegisterCatalogEntry[] {
  return catalog.filter(
    (r) => r.enabledForNameResearch && r.connectorStatus === 'live',
  );
}

/** Display priority for platform cockpit: Benelux → EUIPO → DE/FR/UK → rest. */
const REGISTER_SORT_PRIORITY: Readonly<Record<string, number>> = {
  BOIP: 10,
  EUIPO: 20,
  DPMA: 30,
  INPI: 40,
  UKIPO: 50,
  WIPO: 60,
  USPTO: 70,
};

export function compareRegistersByPriority(a: RegisterCatalogEntry, b: RegisterCatalogEntry): number {
  const pa = REGISTER_SORT_PRIORITY[a.code] ?? 500;
  const pb = REGISTER_SORT_PRIORITY[b.code] ?? 500;
  if (pa !== pb) return pa - pb;
  return a.displayNameNl.localeCompare(b.displayNameNl, 'nl');
}

export function sortRegistersByPriority(
  catalog: readonly RegisterCatalogEntry[],
): readonly RegisterCatalogEntry[] {
  return [...catalog].sort(compareRegistersByPriority);
}

export function catalogEntryByCode(
  catalog: readonly RegisterCatalogEntry[],
  code: string,
): RegisterCatalogEntry | undefined {
  return catalog.find((r) => r.code === code);
}

export function classificationSchemeForRegister(
  catalog: readonly RegisterCatalogEntry[],
  registryCode: string,
): ClassificationSchemeId {
  return catalogEntryByCode(catalog, registryCode)?.classificationSchemeId ?? 'nice_45';
}

export const CONTINENT_LABELS_NL: Readonly<Record<RegisterContinent, string>> = {
  europe: 'Europa',
  north_america: 'Noord-Amerika',
  south_america: 'Zuid-Amerika',
  africa: 'Afrika',
  asia: 'Azië',
  oceania: 'Oceanië',
  international: 'Internationaal',
};
