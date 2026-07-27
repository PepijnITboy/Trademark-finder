/**
 * Declares what a specific {@link TrademarkRegisterConnector} implementation
 * supports, so generic worker/scoring code can adapt behavior (e.g. skip
 * figurative-mark scoring for a register that doesn't support it) without a
 * hard-coded per-register `switch`.
 */
export interface RegisterConnectorCapabilities {
  /** Whether `fetchPublications` supports resuming from a `SourceCheckpoint`. */
  readonly supportsIncrementalFetch: boolean;
  /** Whether the register publishes figurative/combined marks with usable data (vs. word-only). */
  readonly supportsFigurativeMarks: boolean;
  /** Whether `fetchTrademarkByNumber` is implemented. */
  readonly supportsTrademarkLookup: boolean;
  /** Whether the connector can be notified of/poll for opposition status changes on a filing. */
  readonly supportsOppositionStatusTracking: boolean;
}
