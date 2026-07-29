import { createId } from '@merkwacht/shared';
import type { AiProviderId } from '@merkwacht/domain';
import { resolveAiProvider } from '@merkwacht/domain';

export interface AiProviderRuntime {
  provider: Exclude<AiProviderId, 'none'>;
  configured: boolean;
  last4: string | null;
  lastTestStatus: 'ok' | 'fail' | null;
  lastTestMessageNl: string | null;
  lastTestAt: string | null;
}

export interface AiProviderSettingsView {
  activeProvider: AiProviderId;
  providers: readonly AiProviderRuntime[];
  resolve: ReturnType<typeof resolveAiProvider>;
}

/**
 * Server-side AI provider key store. Secrets never leave this process
 * except via getApiKey for worker/probe use.
 */
export class AiProviderStore {
  private activeProvider: AiProviderId = 'openai';
  private readonly secrets = new Map<string, string>();
  private readonly runtime = new Map<string, AiProviderRuntime>();

  constructor() {
    for (const provider of ['openai', 'anthropic', 'google'] as const) {
      const envKey =
        provider === 'openai'
          ? process.env['OPENAI_API_KEY']
          : provider === 'anthropic'
            ? process.env['ANTHROPIC_API_KEY']
            : process.env['GOOGLE_AI_API_KEY'];
      const configured = Boolean(envKey && envKey.length >= 8);
      if (configured && envKey) this.secrets.set(provider, envKey);
      this.runtime.set(provider, {
        provider,
        configured,
        last4: configured && envKey ? envKey.slice(-4) : null,
        lastTestStatus: null,
        lastTestMessageNl: null,
        lastTestAt: null,
      });
    }
    const fromEnv = process.env['AI_ACTIVE_PROVIDER'];
    if (fromEnv === 'openai' || fromEnv === 'anthropic' || fromEnv === 'google' || fromEnv === 'none') {
      this.activeProvider = fromEnv;
    }
  }

  getView(): AiProviderSettingsView {
    const keys = {
      openaiKey: this.secrets.get('openai') ?? null,
      anthropicKey: this.secrets.get('anthropic') ?? null,
      googleKey: this.secrets.get('google') ?? null,
    };
    const resolve = resolveAiProvider({ activeProvider: this.activeProvider, ...keys });
    return {
      activeProvider: this.activeProvider,
      providers: ['openai', 'anthropic', 'google'].map((p) => this.runtime.get(p)!),
      resolve: {
        provider: resolve.provider,
        apiKey: null,
        enrichmentAvailable: resolve.enrichmentAvailable,
        reasonNl: resolve.reasonNl,
      },
    };
  }

  setActiveProvider(provider: AiProviderId): AiProviderSettingsView {
    this.activeProvider = provider;
    return this.getView();
  }

  upsertKey(provider: Exclude<AiProviderId, 'none'>, apiKey: string): AiProviderRuntime | null {
    const trimmed = apiKey.trim();
    if (trimmed.length < 8) return null;
    const rt = this.runtime.get(provider);
    if (!rt) return null;
    this.secrets.set(provider, trimmed);
    rt.configured = true;
    rt.last4 = trimmed.slice(-4);
    return rt;
  }

  getApiKey(provider: Exclude<AiProviderId, 'none'>): string | null {
    return this.secrets.get(provider) ?? null;
  }

  recordTest(
    provider: Exclude<AiProviderId, 'none'>,
    status: 'ok' | 'fail',
    messageNl: string,
  ): AiProviderRuntime | null {
    const rt = this.runtime.get(provider);
    if (!rt) return null;
    rt.lastTestStatus = status;
    rt.lastTestMessageNl = messageNl;
    rt.lastTestAt = new Date().toISOString();
    return rt;
  }

  /** Audit helper id — not a secret. */
  nextAuditId(): string {
    return createId();
  }
}

export function createAiProviderStore(): AiProviderStore {
  return new AiProviderStore();
}
