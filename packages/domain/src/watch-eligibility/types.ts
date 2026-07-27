import type { RegisteredTrademarkSnapshot } from '../watched-trademark.js';

export const WATCH_ELIGIBILITY_REASON_CODES = [
  'eligible',
  'word_mark_required',
  'active_registration_required',
  'registration_status_unknown',
] as const;
export type WatchEligibilityReasonCode = (typeof WATCH_ELIGIBILITY_REASON_CODES)[number];

/**
 * Outcome of evaluating a {@link RegisteredTrademarkSnapshot} against a
 * {@link WatchEligibilityPolicy}. Field names and shape are aligned with the
 * product spec (`docs/product`) so the API/UI can surface a decision
 * verbatim without any remapping layer.
 */
export interface WatchEligibilityDecision {
  /** Whether the snapshot may be watched/matched under this policy. */
  readonly eligible: boolean;
  /**
   * Primary, machine-readable reason for the decision. Always
   * `'eligible'` when `eligible` is `true`, so callers never have to
   * special-case a missing reason.
   */
  readonly reasonCode: WatchEligibilityReasonCode;
  /** Dutch, customer-facing label for `reasonCode`. Never AI-generated — see `docs/product/legal-language.md`. */
  readonly reasonLabelNl: string;
  /** The register-reported status the decision was evaluated against, or `null` if unknown/unavailable. */
  readonly sourceStatus: string | null;
  /** ISO timestamp the decision was computed at. */
  readonly evaluatedAt: string;
  /** Identifier + version of the policy that produced this decision, e.g. `boip-v1`. */
  readonly policyVersion: string;
  /**
   * Additional, non-blocking observations surfaced alongside the primary
   * decision (e.g. secondary concerns that didn't affect eligibility).
   * Empty when there is nothing to flag.
   */
  readonly warnings: readonly string[];
}

/**
 * A versioned policy describing which registrations are eligible to be
 * watched and matched. Kept as a pluggable object (rather than inline
 * conditionals in the worker) so a new policy version (e.g. one that adds
 * figurative mark support) can be introduced without touching call sites.
 * See `docs/connectors/boip.md` for the rationale behind the v1 policy.
 */
export interface WatchEligibilityPolicy {
  /** Policy version identifier, e.g. `boip-v1`. Included verbatim in every decision's `policyVersion`. */
  readonly version: string;
  /** The register this policy evaluates snapshots for, e.g. `BOIP`. Kept as a plain string (rather than `RegisterCode`) so `@merkwacht/domain` has no dependency on `@merkwacht/register-connectors`. */
  readonly registerCode: string;
  evaluate(snapshot: RegisteredTrademarkSnapshot): WatchEligibilityDecision;
}
