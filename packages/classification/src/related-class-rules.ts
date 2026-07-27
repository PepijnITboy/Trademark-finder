import type { RelatedClassRule } from './types.js';

/**
 * Curated, hand-maintained relationships between Nice classification
 * classes that commonly appear together in real filings (e.g. software
 * (class 9) is frequently filed alongside SaaS/development services (class
 * 42)). This is a starting list, not an exhaustive or official WIPO
 * mapping - see `docs/product/legal-language.md`: a suggestion is a
 * heuristic observation, never a registrability or eligibility claim.
 *
 * Rules are stored one-directional (`niceClass` -> `relatedClass`) but
 * `suggestRelatedClasses` treats every rule as bidirectional, since the
 * co-occurrence pattern they describe holds in both directions.
 */
export const RELATED_NICE_CLASS_RULES: readonly RelatedClassRule[] = [
  {
    niceClass: 9,
    relatedClass: 42,
    reasonNl: 'Software (klasse 9) wordt vaak samen met ontwikkel-/SaaS-diensten (klasse 42) aangevraagd.',
  },
  {
    niceClass: 9,
    relatedClass: 38,
    reasonNl:
      'Software/apparatuur (klasse 9) wordt vaak gecombineerd met telecommunicatiediensten (klasse 38).',
  },
  {
    niceClass: 25,
    relatedClass: 35,
    reasonNl:
      'Kleding (klasse 25) wordt vaak gecombineerd met detailhandelsdiensten in kleding (klasse 35).',
  },
  {
    niceClass: 18,
    relatedClass: 25,
    reasonNl: 'Lederwaren/tassen (klasse 18) worden vaak samen met kleding (klasse 25) aangevraagd.',
  },
  {
    niceClass: 41,
    relatedClass: 35,
    reasonNl: 'Opleidingsdiensten (klasse 41) worden vaak gecombineerd met zakelijke diensten (klasse 35).',
  },
  {
    niceClass: 43,
    relatedClass: 41,
    reasonNl:
      'Horeca-/verblijfsdiensten (klasse 43) worden vaak gecombineerd met entertainment-/evenementendiensten (klasse 41).',
  },
  {
    niceClass: 29,
    relatedClass: 30,
    reasonNl:
      'Voedingsmiddelen van dierlijke/plantaardige oorsprong (klasse 29) worden vaak samen met bewerkte voedingsmiddelen/dranken op basis van graan (klasse 30) aangevraagd.',
  },
  {
    niceClass: 35,
    relatedClass: 42,
    reasonNl:
      'Zakelijke/marketingdiensten (klasse 35) worden vaak gecombineerd met softwareontwikkeling/SaaS (klasse 42).',
  },
];
