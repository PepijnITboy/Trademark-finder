import type { RegisteredTrademarkSnapshot } from '../watched-trademark.js';
import type {
  WatchEligibilityDecision,
  WatchEligibilityPolicy,
  WatchEligibilityReasonCode,
} from './types.js';

/**
 * Dutch, customer-facing labels for every {@link WatchEligibilityReasonCode}.
 * Kept as a single lookup table (rather than inline strings scattered across
 * `evaluate`) so every policy version stays consistent and translations
 * never drift. See `docs/product/legal-language.md`.
 */
export const WATCH_ELIGIBILITY_REASON_LABELS_NL: Readonly<
  Record<WatchEligibilityReasonCode, string>
> = {
  eligible: 'Dit merk komt in aanmerking voor bewaking.',
  word_mark_required:
    'Alleen woordmerken komen momenteel in aanmerking voor bewaking; dit merk is een beeld- of gecombineerd merk.',
  active_registration_required:
    'Alleen actief geregistreerde merken komen in aanmerking voor bewaking; de status van dit merk is niet "geregistreerd".',
  registration_status_unknown:
    'De registratiestatus van dit merk kon niet worden vastgesteld, waardoor bewaking nog niet mogelijk is.',
};

/**
 * v1 watch eligibility policy for BOIP-sourced registrations.
 *
 * Only **word marks** with a register status of **`registered`** are
 * eligible to be watched and matched. This is a deliberate scope
 * restriction, not an oversight:
 *
 * - Figurative/combined marks would require image-similarity comparison,
 *   which is out of scope until a later policy version.
 * - `pending`, `opposed`, `refused`, `withdrawn`, and `expired`
 *   registrations are not a valid, currently-enforceable earlier right to
 *   defend against new applications.
 *
 * See `docs/connectors/boip.md` for the full rationale.
 */
export const boipV1WatchEligibilityPolicy: WatchEligibilityPolicy = {
  version: 'boip-v1',
  registerCode: 'BOIP',

  evaluate(snapshot: RegisteredTrademarkSnapshot): WatchEligibilityDecision {
    const warnings: string[] = [];

    let reasonCode: WatchEligibilityReasonCode;

    if (snapshot.registerStatus === 'unknown') {
      reasonCode = 'registration_status_unknown';
    } else if (snapshot.markType !== 'word') {
      reasonCode = 'word_mark_required';
    } else if (snapshot.registerStatus !== 'registered') {
      reasonCode = 'active_registration_required';
    } else {
      reasonCode = 'eligible';
    }

    // A word mark that is registered but has no recorded registration date
    // is still eligible, but worth flagging - it may indicate an
    // incomplete snapshot from the connector.
    if (reasonCode === 'eligible' && snapshot.registrationDate === null) {
      warnings.push('Geen registratiedatum bekend voor dit merk; de momentopname kan onvolledig zijn.');
    }

    return {
      eligible: reasonCode === 'eligible',
      reasonCode,
      reasonLabelNl: WATCH_ELIGIBILITY_REASON_LABELS_NL[reasonCode],
      sourceStatus: snapshot.registerStatus,
      evaluatedAt: new Date().toISOString(),
      policyVersion: 'boip-v1',
      warnings,
    };
  },
};
