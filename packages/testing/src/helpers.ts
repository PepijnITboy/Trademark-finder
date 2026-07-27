import { SAMPLE_TRADEMARK_NAMES, type SampleTrademarkName } from './fixtures';

/** Deterministic, non-cryptographic id generator for test fixtures. */
export function createTestCorrelationId(): string {
  return `test-${Math.random().toString(36).slice(2, 10)}`;
}

export function pickSampleTrademarkName(index = 0): SampleTrademarkName {
  const name = SAMPLE_TRADEMARK_NAMES[index % SAMPLE_TRADEMARK_NAMES.length];
  if (!name) {
    throw new Error('SAMPLE_TRADEMARK_NAMES is onverwacht leeg.');
  }
  return name;
}

/** Flushes pending microtasks/timers; useful when asserting on async stubs. */
export async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
