import type { ComparisonEvidence, TrademarkFeatureVector } from '@merkwacht/domain';

/**
 * Deterministic Dutch explanation templates for clear cases (no AI).
 */
export function buildDeterministicExplanation(input: {
  earlierMark: string;
  laterMark: string;
  features: TrademarkFeatureVector;
  evidence: readonly ComparisonEvidence[];
}): { summaryNl: string; bulletsNl: string[]; usedTemplateIds: string[] } {
  const bullets: string[] = [];
  const usedTemplateIds: string[] = [];
  const { features, earlierMark, laterMark } = input;

  if (features.exact.normalized === 1) {
    bullets.push('De namen zijn exact gelijk na normalisatie.');
    usedTemplateIds.push('exact_normalized');
  } else if (features.exact.compact === 1) {
    bullets.push('De namen zijn gelijk wanneer spaties en leestekens worden genegeerd.');
    usedTemplateIds.push('exact_compact');
  } else if (features.orthographic.levenshtein >= 0.8 && features.orthographic.lengthRatio === 1) {
    bullets.push(
      `De namen “${earlierMark}” en “${laterMark}” verschillen slechts in een klein aantal tekens bij gelijke lengte.`,
    );
    usedTemplateIds.push('small_edit_same_length');
  }

  if (features.phonetic.bestCodeSimilarity >= 0.85) {
    bullets.push('De overeenkomst zit (ook) in de uitspraak volgens de fonetische vergelijking.');
    usedTemplateIds.push('phonetic_high');
  }

  if (features.token.sharedDistinctiveCount > 0) {
    bullets.push('Beide merken delen een of meer onderscheidende woorddelen.');
    usedTemplateIds.push('shared_distinctive');
  }

  if (features.goodsServices.overallSimilarity >= 0.7) {
    bullets.push('De waren en diensten lijken sterk op elkaar.');
    usedTemplateIds.push('goods_high');
  } else if (!features.goodsServices.coverage || features.metadata.missingFeatureCount > 0) {
    bullets.push('Er ontbreekt (deels) tekst over waren en diensten; de inschatting is daardoor onzekerder.');
    usedTemplateIds.push('goods_missing');
  }

  if (bullets.length === 0) {
    bullets.push(
      `Er is een mogelijke overeenkomst tussen “${earlierMark}” en “${laterMark}” op basis van de berekende kenmerken.`,
    );
    usedTemplateIds.push('generic');
  }

  return {
    summaryNl: bullets[0]!,
    bulletsNl: bullets,
    usedTemplateIds,
  };
}
