/**
 * Unified notification-recipient model: each email address has exactly one trigger mode.
 * Watch-level minScoreThreshold is a visibility floor for Merkbescherming matches —
 * not a second frequency UI.
 */

export const NOTIFY_MODES = ['threshold', 'digest'] as const;
export type NotifyMode = (typeof NOTIFY_MODES)[number];

export const DIGEST_CADENCES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;
export type DigestCadence = (typeof DIGEST_CADENCES)[number];

export interface NotificationRecipientConfig {
  readonly mode: NotifyMode;
  readonly digestCadence: DigestCadence | null;
  readonly minScoreThreshold: number | null;
}

export type RecipientConfigResult =
  | { ok: true; config: NotificationRecipientConfig }
  | { ok: false; message: string };

/** Normalize / validate mode + cadence + threshold into a consistent config. */
export function normalizeRecipientNotifyConfig(input: {
  mode: NotifyMode;
  digestCadence?: DigestCadence | null;
  minScoreThreshold?: number | null;
}): RecipientConfigResult {
  if (input.mode === 'threshold') {
    const raw = input.minScoreThreshold;
    if (raw === null || raw === undefined || Number.isNaN(raw)) {
      return { ok: false, message: 'Kies een minimale score (%) voor drempelmeldingen.' };
    }
    const minScoreThreshold = Math.round(raw);
    if (minScoreThreshold < 0 || minScoreThreshold > 100) {
      return { ok: false, message: 'Meldingsdrempel moet tussen 0 en 100% liggen.' };
    }
    return {
      ok: true,
      config: { mode: 'threshold', digestCadence: null, minScoreThreshold },
    };
  }

  const cadence = input.digestCadence;
  if (!cadence || !(DIGEST_CADENCES as readonly string[]).includes(cadence)) {
    return { ok: false, message: 'Kies een rapportfrequentie (dagelijks, wekelijks of maandelijks).' };
  }
  return {
    ok: true,
    config: { mode: 'digest', digestCadence: cadence, minScoreThreshold: null },
  };
}

/**
 * Watch visibility threshold must not exceed the lowest threshold-mode recipient
 * that covers this watch. Digest-only recipients are ignored for this gate.
 */
export function assertWatchThresholdCompatibleWithRecipients(
  watchThreshold: number,
  coveringThresholdRecipients: readonly number[],
): { ok: true } | { ok: false; message: string; maxAllowed: number } {
  if (coveringThresholdRecipients.length === 0) return { ok: true };
  const maxAllowed = Math.min(...coveringThresholdRecipients);
  if (watchThreshold > maxAllowed) {
    return {
      ok: false,
      maxAllowed,
      message: `Matchdrempel (${watchThreshold}%) mag niet hoger zijn dan de laagste e-maildrempel (${maxAllowed}%).`,
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
      message: `E-maildrempel (${recipientThreshold}%) moet minstens de matchdrempel (${watchThreshold}%) zijn.`,
    };
  }
  return { ok: true };
}

/** Collect % floors from recipients in threshold mode that cover a given watch. */
export function thresholdFloorsForWatch(
  recipients: readonly {
    readonly mode: NotifyMode;
    readonly minScoreThreshold: number | null;
    readonly isActive: boolean;
    readonly allWatches: boolean;
    readonly watchedTrademarkIds: readonly string[];
  }[],
  watchedTrademarkId: string,
): readonly number[] {
  return recipients
    .filter((r) => r.isActive && r.mode === 'threshold' && r.minScoreThreshold != null)
    .filter((r) => r.allWatches || r.watchedTrademarkIds.includes(watchedTrademarkId))
    .map((r) => r.minScoreThreshold!);
}

export const DIGEST_CADENCE_LABELS_NL: Record<DigestCadence, string> = {
  DAILY: 'Dagelijks rapport',
  WEEKLY: 'Wekelijks rapport',
  MONTHLY: 'Maandelijks rapport',
};

export function formatRecipientNotifySummaryNl(config: NotificationRecipientConfig): string {
  if (config.mode === 'threshold') {
    return `Melding vanaf ${config.minScoreThreshold}%`;
  }
  return DIGEST_CADENCE_LABELS_NL[config.digestCadence!];
}
