export const AI_PROVIDER_IDS = ['openai', 'anthropic', 'google', 'none'] as const;
export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

export interface AiProviderResolveInput {
  readonly activeProvider: AiProviderId;
  readonly openaiKey?: string | null;
  readonly anthropicKey?: string | null;
  readonly googleKey?: string | null;
}

export interface AiProviderResolveResult {
  readonly provider: AiProviderId;
  readonly apiKey: string | null;
  /** True when enrichment can run (currently OpenAI with a key). */
  readonly enrichmentAvailable: boolean;
  readonly reasonNl: string;
}

function hasKey(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length >= 8;
}

/**
 * Resolves which AI provider the worker/scoring layer should use.
 * Missing key for the selected provider ⇒ graceful degrade (no enrichment).
 */
export function resolveAiProvider(input: AiProviderResolveInput): AiProviderResolveResult {
  if (input.activeProvider === 'none') {
    return {
      provider: 'none',
      apiKey: null,
      enrichmentAvailable: false,
      reasonNl: 'AI-verrijking is uitgeschakeld.',
    };
  }

  const keyByProvider: Record<Exclude<AiProviderId, 'none'>, string | null | undefined> = {
    openai: input.openaiKey,
    anthropic: input.anthropicKey,
    google: input.googleKey,
  };
  const key = keyByProvider[input.activeProvider];
  if (!hasKey(key)) {
    return {
      provider: input.activeProvider,
      apiKey: null,
      enrichmentAvailable: false,
      reasonNl: `Geen geldige API-sleutel voor ${input.activeProvider}. Scoring draait zonder AI-verrijking.`,
    };
  }

  // OpenAI is the only fully wired enrichment provider today; others store keys
  // and are ready for adapters without breaking the worker.
  if (input.activeProvider === 'openai') {
    return {
      provider: 'openai',
      apiKey: key.trim(),
      enrichmentAvailable: true,
      reasonNl: 'OpenAI is actief voor match-verrijking.',
    };
  }

  return {
    provider: input.activeProvider,
    apiKey: key.trim(),
    enrichmentAvailable: false,
    reasonNl: `${input.activeProvider}-sleutel is gezet; verrijkingsadapter volgt. Scoring draait deterministisch.`,
  };
}
