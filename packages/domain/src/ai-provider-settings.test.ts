import { describe, expect, it } from 'vitest';
import { resolveAiProvider } from './ai-provider-settings.js';

describe('resolveAiProvider', () => {
  it('returns enrichment when openai key is present', () => {
    const result = resolveAiProvider({
      activeProvider: 'openai',
      openaiKey: 'sk-test-12345678',
    });
    expect(result.enrichmentAvailable).toBe(true);
    expect(result.apiKey).toBe('sk-test-12345678');
  });

  it('gracefully degrades when openai key is missing', () => {
    const result = resolveAiProvider({
      activeProvider: 'openai',
      openaiKey: null,
    });
    expect(result.enrichmentAvailable).toBe(false);
    expect(result.apiKey).toBeNull();
    expect(result.reasonNl.toLowerCase()).toContain('geen geldige');
  });

  it('honours none without requiring keys', () => {
    const result = resolveAiProvider({ activeProvider: 'none', openaiKey: 'sk-x' });
    expect(result.provider).toBe('none');
    expect(result.enrichmentAvailable).toBe(false);
  });

  it('stores anthropic key but does not claim enrichment yet', () => {
    const result = resolveAiProvider({
      activeProvider: 'anthropic',
      anthropicKey: 'ant-key-12345678',
    });
    expect(result.apiKey).toBe('ant-key-12345678');
    expect(result.enrichmentAvailable).toBe(false);
  });
});
