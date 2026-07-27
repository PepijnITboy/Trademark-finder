/**
 * Merkonderzoek (pre-filing clearance) — strictly separate from Merkbescherming matches.
 */

import type { RegisterCatalogEntry } from './register-catalog.js';

export const NAME_RESEARCH_MIN_THRESHOLD = 20;
export const NAME_RESEARCH_MAX_THRESHOLD = 100;
/** Below this threshold the UI warns that the report may become very large. */
export const NAME_RESEARCH_LARGE_REPORT_WARN_BELOW = 40;

export const NAME_RESEARCH_ORDER_STATUSES = [
  'draft',
  'awaiting_payment',
  'queued',
  'running',
  'completed',
  'failed',
  'canceled',
] as const;
export type NameResearchOrderStatus = (typeof NAME_RESEARCH_ORDER_STATUSES)[number];

export const NAME_RESEARCH_STEP_STATUSES = [
  'pending',
  'running',
  'completed',
  'pending_connector',
  'failed',
] as const;
export type NameResearchStepStatus = (typeof NAME_RESEARCH_STEP_STATUSES)[number];

export interface NameResearchProgressStep {
  readonly id: string;
  readonly labelNl: string;
  readonly registryCode: string | null;
  readonly status: NameResearchStepStatus;
}

export interface NameResearchHitScores {
  readonly textualSimilarity: number;
  readonly phoneticSimilarity: number;
  readonly visualSimilarity: number;
  readonly niceClassOverlap: number;
}

export interface NameResearchRegisterScope {
  readonly registryCode: string;
  /** Nice classes 1–45 for this register only. Empty is invalid at create time. */
  readonly niceClasses: readonly number[];
}

export interface NameResearchHit {
  readonly id: string;
  readonly orderId: string;
  readonly priorMarkText: string;
  readonly registryCode: string;
  readonly niceClasses: readonly number[];
  readonly scores: NameResearchHitScores;
  readonly totalRiskScore: number;
  readonly priorMarkNumber: string | null;
  readonly applicantName: string | null;
  readonly filingDate: string | null;
  readonly registrationOrPublicationDate: string | null;
  readonly markType: string | null;
  readonly statusNl: string | null;
}

export type NameResearchAdviceBand = 'low' | 'medium' | 'high';

export interface NameResearchOrder {
  readonly id: string;
  readonly organizationId: string;
  readonly markText: string;
  readonly intendedNicheNl: string | null;
  readonly scopes: readonly NameResearchRegisterScope[];
  readonly minScoreThreshold: number;
  readonly status: NameResearchOrderStatus;
  readonly priceCents: number;
  readonly currency: 'eur';
  readonly creditUsed: boolean;
  readonly stripeSessionId: string | null;
  readonly progressSteps: readonly NameResearchProgressStep[];
  readonly overallRiskScore: number | null;
  readonly adviceBand: NameResearchAdviceBand | null;
  readonly adviceTextNl: string | null;
  readonly hits: readonly NameResearchHit[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt: string | null;
}

export interface NameResearchQuoteInput {
  readonly scopes: readonly NameResearchRegisterScope[];
  readonly catalog: readonly RegisterCatalogEntry[];
}

export interface NameResearchQuote {
  readonly registerSubtotalCents: number;
  readonly totalCents: number;
  readonly currency: 'eur';
  readonly lineItems: readonly { code: string; labelNl: string; amountCents: number }[];
}

export function clampNameResearchThreshold(minScoreThreshold: number): number {
  return Math.min(
    NAME_RESEARCH_MAX_THRESHOLD,
    Math.max(NAME_RESEARCH_MIN_THRESHOLD, Math.round(minScoreThreshold)),
  );
}

/** Low threshold → many hits visible; UI should warn (no price impact). */
export function shouldWarnLargeReport(minScoreThreshold: number): boolean {
  return clampNameResearchThreshold(minScoreThreshold) < NAME_RESEARCH_LARGE_REPORT_WARN_BELOW;
}

export function validateNameResearchScopes(
  scopes: readonly NameResearchRegisterScope[],
): void {
  if (scopes.length === 0) {
    throw new Error('Selecteer minstens één register met klassen.');
  }
  const seen = new Set<string>();
  for (const scope of scopes) {
    if (seen.has(scope.registryCode)) {
      throw new Error(`Register ${scope.registryCode} is dubbel geselecteerd.`);
    }
    seen.add(scope.registryCode);
    if (scope.niceClasses.length === 0) {
      throw new Error(`Selecteer minstens één Nice-klasse voor ${scope.registryCode}.`);
    }
    for (const c of scope.niceClasses) {
      if (!Number.isInteger(c) || c < 1 || c > 45) {
        throw new Error(`Ongeldige Nice-klasse ${c} voor ${scope.registryCode}.`);
      }
    }
  }
}

/** Price = sum of register base prices only (threshold is not billed). */
export function quoteNameResearch(input: NameResearchQuoteInput): NameResearchQuote {
  validateNameResearchScopes(input.scopes);
  const lineItems: { code: string; labelNl: string; amountCents: number }[] = [];
  let registerSubtotalCents = 0;
  for (const scope of input.scopes) {
    const entry = input.catalog.find((r) => r.code === scope.registryCode);
    if (!entry || !entry.enabledForNameResearch || entry.connectorStatus === 'disabled') {
      throw new Error(`Register ${scope.registryCode} is niet beschikbaar voor merkonderzoek.`);
    }
    lineItems.push({
      code: entry.code,
      labelNl: entry.displayNameNl,
      amountCents: entry.basePriceCents,
    });
    registerSubtotalCents += entry.basePriceCents;
  }
  return {
    registerSubtotalCents,
    totalCents: registerSubtotalCents,
    currency: 'eur',
    lineItems,
  };
}

export function adviceBandFromRisk(overallRiskScore: number): NameResearchAdviceBand {
  if (overallRiskScore >= 70) return 'high';
  if (overallRiskScore >= 40) return 'medium';
  return 'low';
}

export function adviceTextNl(band: NameResearchAdviceBand, markText: string): string {
  switch (band) {
    case 'high':
      return `Voor “${markText}” zijn er sterke overlappingen met bestaande merken. Overweeg een andere naam of pas de klassen/scope aan voordat u deponeert. Dit is geen juridisch advies.`;
    case 'medium':
      return `Voor “${markText}” zijn er enkele relevante gelijkenissen. Laat een merkgemachtigde de hits beoordelen voordat u een depot indient. Dit is geen juridisch advies.`;
    case 'low':
      return `Voor “${markText}” zijn binnen de gekozen drempel weinig sterke conflicten gevonden. Residual risico blijft bestaan — dit is geen juridisch advies of garantie op registratie.`;
  }
}

/** Phonetic-ish risk score between proposed name and a prior mark (0–100). */
export function clearanceRiskScore(
  proposed: string,
  prior: string,
  classOverlap: boolean,
): NameResearchHitScores & { totalRiskScore: number } {
  const a = proposed.trim().toLowerCase();
  const b = prior.trim().toLowerCase();
  if (!a || !b) {
    return {
      textualSimilarity: 0,
      phoneticSimilarity: 0,
      visualSimilarity: 0,
      niceClassOverlap: 0,
      totalRiskScore: 0,
    };
  }
  const textual = Math.round(stringSimilarity(a, b) * 100);
  const phonetic = Math.round(stringSimilarity(simplifyPhonetic(a), simplifyPhonetic(b)) * 100);
  const visual = Math.round(stringSimilarity(a.slice(0, 4), b.slice(0, 4)) * 100);
  const nice = classOverlap ? 80 : 15;
  const totalRiskScore = Math.round(textual * 0.3 + phonetic * 0.35 + visual * 0.15 + nice * 0.2);
  return {
    textualSimilarity: textual,
    phoneticSimilarity: phonetic,
    visualSimilarity: visual,
    niceClassOverlap: nice,
    totalRiskScore,
  };
}

function simplifyPhonetic(value: string): string {
  return value
    .replace(/ph/g, 'f')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/ck/g, 'k')
    .replace(/y/g, 'i')
    .replace(/aa|ae/g, 'a')
    .replace(/ee|ei|ij/g, 'e')
    .replace(/oo|oe/g, 'o')
    .replace(/[^a-z]/g, '');
}

function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  if (longer.length === 0) return 1;
  const edit = levenshtein(longer, shorter);
  return (longer.length - edit) / longer.length;
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
  for (let i = 0; i < rows; i += 1) matrix[i]![0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0]![j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost,
      );
    }
  }
  return matrix[a.length]![b.length]!;
}
