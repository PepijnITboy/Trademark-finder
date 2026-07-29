import type { WatchEligibilityDecision } from './watch-eligibility/types.js';
import type { WatchedTrademarkStatus } from './statuses.js';

export interface ProtectionDisplayInput {
  readonly status: WatchedTrademarkStatus;
  readonly eligibility: Pick<WatchEligibilityDecision, 'eligible' | 'reasonLabelNl'>;
  /**
   * True when the watched register is live, enabled for customers, and the last
   * connector probe succeeded. When false/undefined, never show "Beschermd".
   */
  readonly registerMonitoringOk: boolean;
}

export interface ProtectionDisplay {
  readonly labelNl: string;
  readonly tone: 'success' | 'warning' | 'neutral';
  readonly detailNl: string;
  /** True only when the mark is actively watched, eligible, and register monitoring is OK. */
  readonly activelyProtected: boolean;
}

/**
 * UI-facing protection status.
 * "Beschermd" requires: active status + eligibility + register monitoring OK.
 * Connector off / probe red ⇒ never "Beschermd".
 */
export function resolveProtectionDisplay(input: ProtectionDisplayInput): ProtectionDisplay {
  if (input.status === 'paused') {
    return {
      labelNl: 'Gepauzeerd — momenteel niet bewaakt',
      tone: 'warning',
      detailNl: 'Niet beschermd · bewaking gepauzeerd',
      activelyProtected: false,
    };
  }
  if (input.status === 'archived' || input.status === 'expired') {
    return {
      labelNl: 'Niet beschermd',
      tone: 'neutral',
      detailNl: input.eligibility.reasonLabelNl,
      activelyProtected: false,
    };
  }
  if (!input.registerMonitoringOk) {
    return {
      labelNl: 'Niet bewaakt — register offline',
      tone: 'warning',
      detailNl: 'Het register is uitgeschakeld of de verbinding werkt niet. Nieuwe matches worden niet opgehaald.',
      activelyProtected: false,
    };
  }
  if (input.eligibility.eligible) {
    return {
      labelNl: 'Beschermd',
      tone: 'success',
      detailNl: input.eligibility.reasonLabelNl,
      activelyProtected: true,
    };
  }
  return {
    labelNl: 'Niet beschermd',
    tone: 'warning',
    detailNl: input.eligibility.reasonLabelNl,
    activelyProtected: false,
  };
}
