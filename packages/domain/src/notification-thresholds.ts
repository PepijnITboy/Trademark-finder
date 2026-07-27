/**
 * Ensures the watch-level score threshold is not higher than the lowest
 * recipient threshold that covers this watch.
 */
export function assertWatchThresholdCompatibleWithRecipients(
  watchThreshold: number,
  recipientThresholds: readonly number[],
): { ok: true } | { ok: false; message: string; maxAllowed: number } {
  if (recipientThresholds.length === 0) return { ok: true };
  const maxAllowed = Math.min(...recipientThresholds);
  if (watchThreshold > maxAllowed) {
    return {
      ok: false,
      maxAllowed,
      message: `Algemene meldingsdrempel (${watchThreshold}%) mag niet hoger zijn dan de laagste e-maildrempel (${maxAllowed}%).`,
    };
  }
  return { ok: true };
}

export function assertRecipientThresholdCompatibleWithWatch(
  recipientThreshold: number,
  watchThreshold: number,
): { ok: true } | { ok: false; message: string } {
  if (watchThreshold > recipientThreshold) {
    return {
      ok: false,
      message: `E-maildrempel (${recipientThreshold}%) moet minstens de algemene drempel (${watchThreshold}%) zijn.`,
    };
  }
  return { ok: true };
}
