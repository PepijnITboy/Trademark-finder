/**
 * Register catalog for watch + name-research. Managed by the platform;
 * customer UIs only read enabled entries.
 */

export const REGISTER_CONNECTOR_STATUSES = ['live', 'coming_soon', 'disabled'] as const;
export type RegisterConnectorStatus = (typeof REGISTER_CONNECTOR_STATUSES)[number];

export interface RegisterCatalogEntry {
  readonly code: string;
  readonly displayNameNl: string;
  readonly regionNl: string;
  readonly connectorStatus: RegisterConnectorStatus;
  readonly basePriceCents: number;
  readonly enabledForWatch: boolean;
  readonly enabledForNameResearch: boolean;
}

export const DEFAULT_REGISTER_CATALOG: readonly RegisterCatalogEntry[] = [
  {
    code: 'BOIP',
    displayNameNl: 'Benelux (BOIP)',
    regionNl: 'België, Nederland, Luxemburg',
    connectorStatus: 'live',
    basePriceCents: 7900,
    enabledForWatch: true,
    enabledForNameResearch: true,
  },
  {
    code: 'EUIPO',
    displayNameNl: 'Europees (EUIPO)',
    regionNl: 'Europese Unie',
    connectorStatus: 'coming_soon',
    basePriceCents: 9900,
    enabledForWatch: false,
    enabledForNameResearch: true,
  },
  {
    code: 'DPMA',
    displayNameNl: 'Duitsland (DPMA)',
    regionNl: 'Duitsland',
    connectorStatus: 'coming_soon',
    basePriceCents: 8900,
    enabledForWatch: false,
    enabledForNameResearch: true,
  },
  {
    code: 'INPI',
    displayNameNl: 'Frankrijk (INPI)',
    regionNl: 'Frankrijk',
    connectorStatus: 'coming_soon',
    basePriceCents: 8900,
    enabledForWatch: false,
    enabledForNameResearch: true,
  },
  {
    code: 'OEPM',
    displayNameNl: 'Spanje (OEPM)',
    regionNl: 'Spanje',
    connectorStatus: 'coming_soon',
    basePriceCents: 8900,
    enabledForWatch: false,
    enabledForNameResearch: true,
  },
  {
    code: 'WIPO',
    displayNameNl: 'Wereldwijd (WIPO)',
    regionNl: 'Internationaal',
    connectorStatus: 'coming_soon',
    basePriceCents: 14900,
    enabledForWatch: false,
    enabledForNameResearch: true,
  },
];

export function registersForNameResearch(
  catalog: readonly RegisterCatalogEntry[],
): readonly RegisterCatalogEntry[] {
  return catalog.filter((r) => r.enabledForNameResearch && r.connectorStatus !== 'disabled');
}
