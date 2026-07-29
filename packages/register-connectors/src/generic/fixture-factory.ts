import type { RegisterCode } from '../core/register-types.js';
import type { GenericPublicationRecord, GenericTrademarkRecord } from './generic.schemas.js';

/**
 * Builds fictitious, LUMARO-style fixture data for a register, keyed only
 * by `registryCode` so `../catalog/create-all-connectors.ts` can give every
 * generically-wired register its own deterministic, non-overlapping
 * fixture set without hand-writing ~35 fixture files. Mirrors the intent
 * (never real register data, clearly invented names) of
 * `../boip/boip.fixtures.ts`, `../euipo/euipo.fixtures.ts`, etc. Never use
 * this in a production data path - see the "no fake data" rule in
 * `docs/connectors/connector-contract.md`.
 */
export interface GenericConnectorFixtureSet {
  readonly trademarks: readonly GenericTrademarkRecord[];
  readonly publications: readonly GenericPublicationRecord[];
}

/**
 * Pool of invented brand-name families (short, distinctive,
 * non-dictionary), each with a "own mark" and two "new application" marks
 * that are deliberately close (near-duplicate) and distinct
 * (unrelated) respectively, so fixture-mode local development exercises
 * the scoring pipeline end-to-end - same idea as BOIP's LUMARO/LUMAROO
 * pair. One family is selected per register, deterministically, below.
 */
const FIXTURE_NAME_FAMILIES: ReadonlyArray<{
  readonly own: string;
  readonly closeVariant: string;
  readonly distinct: string;
}> = [
  { own: 'LUMARO', closeVariant: 'LUMAROO', distinct: 'BRENTIQ' },
  { own: 'NOVEXA', closeVariant: 'NOVEXO', distinct: 'WILLEMPE' },
  { own: 'VELORIX', closeVariant: 'VELORIQ', distinct: 'KASTELLO' },
  { own: 'ZENDRIA', closeVariant: 'ZENDRIO', distinct: 'PRIMAVEX' },
  { own: 'SOLVENDA', closeVariant: 'SOLVENDO', distinct: 'TRIVANDO' },
  { own: 'MARENTIS', closeVariant: 'MARENTYS', distinct: 'OBLIVENE' },
  { own: 'CORDALIA', closeVariant: 'CORDALYA', distinct: 'FENWIRRA' },
  { own: 'TALVERON', closeVariant: 'TALVERAN', distinct: 'GRISOMBE' },
  { own: 'PENDRAVO', closeVariant: 'PENDRAVA', distinct: 'ULMENTRA' },
  { own: 'QUIVARNA', closeVariant: 'QUIVARNO', distinct: 'DOSTELIA' },
];

/** Small, deterministic string hash (not cryptographic) used only to pick a stable fixture family per register code. */
function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function niceClassesFor(registryCode: string, seed: number): number[] {
  const base = [9, 35, 42];
  const pick = hashCode(registryCode + String(seed)) % base.length;
  const secondary = base[(pick + 1) % base.length];
  return secondary === undefined ? [base[pick] ?? 9] : [base[pick] ?? 9, secondary];
}

/**
 * Builds a deterministic fixture set for `registryCode`: one "own"
 * registered trademark plus three new publications (a close near-duplicate,
 * a moderately similar one, and an unrelated one).
 */
export function buildGenericFixtureSet(registryCode: RegisterCode): GenericConnectorFixtureSet {
  const family = FIXTURE_NAME_FAMILIES[hashCode(registryCode) % FIXTURE_NAME_FAMILIES.length];
  if (!family) {
    throw new Error('FIXTURE_NAME_FAMILIES must not be empty');
  }

  const trademarks: GenericTrademarkRecord[] = [
    {
      registrationNumber: `${registryCode}-0001000001`,
      markText: family.own,
      markType: 'WORD',
      niceClasses: niceClassesFor(registryCode, 1),
      applicantName: `${titleCase(family.own)} Holding B.V.`,
      filingDate: '2022-03-10',
      registrationDate: '2022-09-14',
      registerStatus: 'REGISTERED',
    },
  ];

  const publications: GenericPublicationRecord[] = [
    {
      applicationNumber: `${registryCode}-2026-0000001`,
      markText: family.closeVariant,
      markType: 'WORD',
      niceClasses: niceClassesFor(registryCode, 1),
      applicantName: `${titleCase(family.closeVariant)} Digital B.V.`,
      filingDate: '2026-06-01',
      publicationDate: '2026-06-20',
      proceduralStatus: 'PUBLISHED',
    },
    {
      applicationNumber: `${registryCode}-2026-0000002`,
      markText: family.distinct,
      markType: 'WORD',
      niceClasses: niceClassesFor(registryCode, 2),
      applicantName: `${titleCase(family.distinct)} Labs B.V.`,
      filingDate: '2026-05-10',
      publicationDate: '2026-05-28',
      proceduralStatus: 'PUBLISHED',
    },
    {
      applicationNumber: `${registryCode}-2026-0000003`,
      markText: `${family.own}${family.own.slice(-2)}`,
      markType: 'WORD',
      niceClasses: niceClassesFor(registryCode, 3),
      applicantName: `${titleCase(family.own)} Ventures N.V.`,
      filingDate: '2026-04-02',
      publicationDate: '2026-04-19',
      proceduralStatus: 'PUBLISHED',
    },
  ];

  return { trademarks, publications };
}

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
