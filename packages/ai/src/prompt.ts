import type { TrademarkMatchScores } from '@merkwacht/domain';
import type { ScoringContext } from '@merkwacht/scoring';

/** Bump this whenever the prompt wording changes materially, so cached responses (keyed by `promptVersion`) never mix results from different prompt versions. */
export const AI_PROMPT_VERSION = 'trademark-match-v1';

/**
 * Deterministic, fixed Dutch clause appended to every AI-generated
 * rationale before it is validated/stored, so a disclaimer is guaranteed to
 * be present regardless of whether the model included one - see
 * `docs/product/legal-language.md`. This is deliberately short; the full
 * `LEGAL_DISCLAIMER_NL` text (from `@merkwacht/domain`) is what customer
 * dashboards/exports must render alongside match results.
 */
export const AI_RATIONALE_DISCLAIMER_SUFFIX_NL =
  'Dit is een geautomatiseerde AI-inschatting ter aanvulling op de regelgebaseerde score, geen juridisch advies.';

export const AI_ASSESSMENT_SYSTEM_PROMPT_NL =
  'Je beoordeelt in het Nederlands de aannemelijkheid van verwarringsgevaar tussen twee merken, ' +
  'als aanvulling op een reeds berekende regelgebaseerde score. Je geeft geen juridisch advies, ' +
  'beslist niet of er sprake is van inbreuk, en doet geen aanbeveling over het al dan niet indienen ' +
  'van een oppositie. Antwoord uitsluitend met een JSON-object met exact de velden "adjustment" ' +
  '(getal tussen -1 en 1), "rationaleNl" (korte Nederlandse toelichting, geen aanbeveling), ' +
  '"confidence" (getal tussen 0 en 1) en "riskLevel" ("LOW", "MEDIUM" of "HIGH").';

/**
 * Builds the structured user prompt for a single `(watched, candidate)`
 * pair: both mark texts, shared Nice classes, and the already-computed
 * rule-based scores, so the model is explicitly asked to add a *holistic*
 * signal rather than recompute what the deterministic pipeline already
 * covers - see `docs/scoring/ai-layer.md`'s "what the AI layer is asked to
 * do" section.
 */
export function buildTrademarkMatchPrompt(
  context: ScoringContext,
  ruleBasedScores: Omit<TrademarkMatchScores, 'aiPlausibilityAdjustment'>,
): string {
  const sharedNiceClasses = context.watched.snapshot.niceClasses.filter((klass) =>
    context.candidate.niceClasses.includes(klass),
  );

  return [
    `Bewaakt merk: "${context.watched.snapshot.markText}" (register: ${context.watched.snapshot.registryCode}, Nice-klassen: ${context.watched.snapshot.niceClasses.join(', ') || 'onbekend'})`,
    `Kandidaat-aanvraag: "${context.candidate.markText}" (register: ${context.candidate.registryCode}, Nice-klassen: ${context.candidate.niceClasses.join(', ') || 'onbekend'})`,
    `Gedeelde Nice-klassen: ${sharedNiceClasses.join(', ') || 'geen'}`,
    'Reeds berekende regelgebaseerde scores (0-1 per component):',
    `- textualSimilarity: ${ruleBasedScores.textualSimilarity.toFixed(2)}`,
    `- phoneticSimilarity: ${ruleBasedScores.phoneticSimilarity.toFixed(2)}`,
    `- visualSimilarity: ${ruleBasedScores.visualSimilarity.toFixed(2)}`,
    `- semanticSimilarity: ${ruleBasedScores.semanticSimilarity.toFixed(2)}`,
    `- niceClassOverlap: ${ruleBasedScores.niceClassOverlap.toFixed(2)}`,
    `- goodsServicesOverlap: ${ruleBasedScores.goodsServicesOverlap.toFixed(2)}`,
    `- geographicOverlap: ${ruleBasedScores.geographicOverlap.toFixed(2)}`,
    'Geef een aanvullende inschatting (adjustment) van hoe deze regelgebaseerde scores mogelijk ' +
      'onder- of overschat zijn gelet op de merken als geheel, en licht dit kort toe.',
  ].join('\n');
}
