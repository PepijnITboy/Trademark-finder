import { boipV1WatchEligibilityPolicy, type CandidateApplication, type WatchedTrademark } from '@merkwacht/domain';
import { calculateOppositionDeadline } from '@merkwacht/opposition-rules';
import { normalizeMarkName } from '@merkwacht/normalization';
import { generatePhoneticRepresentations } from '@merkwacht/phonetics';
import {
  BOIP_FIXTURE_PUBLICATIONS,
  BOIP_FIXTURE_TRADEMARK_REGISTRATIONS,
  getBoipOppositionRuleSet,
  mapBoipPublicationToCandidateApplicationInput,
  mapBoipTrademarkToSnapshot,
} from '@merkwacht/register-connectors';
import type { ScoringContext } from '@merkwacht/scoring';
import { scoreMatch } from '@merkwacht/scoring';
import { createId } from '@merkwacht/shared';
import type {
  NotificationRecord,
  OrganizationSettingsRecord,
  TrademarkMatchRecord,
  WatchedTrademarkRecord,
} from './types.js';

/**
 * Builds a small, fully fictitious (LUMARO-style) demo dataset for a single
 * organization: one eligible watched trademark, one paused watched
 * trademark, and a handful of scored matches computed by the real
 * `@merkwacht/scoring` pipeline against BOIP fixture publications. Used by
 * `DemoStore` so `pnpm dev` shows a realistic, end-to-end product surface
 * without requiring Supabase or live BOIP credentials.
 */
export interface DemoSeed {
  readonly watchedTrademarks: WatchedTrademarkRecord[];
  readonly matches: TrademarkMatchRecord[];
  readonly notifications: NotificationRecord[];
  readonly settings: OrganizationSettingsRecord;
}

function toCandidateApplication(input: ReturnType<typeof mapBoipPublicationToCandidateApplicationInput>): CandidateApplication {
  const ruleSet = getBoipOppositionRuleSet();
  const id = createId();
  return {
    id,
    ...input,
    oppositionDeadline: calculateOppositionDeadline({
      candidateApplicationId: id,
      registryCode: input.registryCode,
      filingDate: input.filingDate,
      publicationDate: input.publicationDate,
      ruleSet,
    }),
  };
}

async function buildScoredMatch(
  watched: WatchedTrademark,
  watchedRecord: WatchedTrademarkRecord,
  candidate: CandidateApplication,
  status: TrademarkMatchRecord['status'],
): Promise<TrademarkMatchRecord> {
  const context: ScoringContext = {
    watched,
    candidate,
    watchedNormalized: normalizeMarkName(watched.snapshot.markText),
    candidateNormalized: normalizeMarkName(candidate.markText),
    watchedPhonetic: generatePhoneticRepresentations(normalizeMarkName(watched.snapshot.markText).normalized),
    candidatePhonetic: generatePhoneticRepresentations(normalizeMarkName(candidate.markText).normalized),
  };

  const result = await scoreMatch(context);
  const now = new Date().toISOString();

  return {
    id: createId(),
    organizationId: watchedRecord.organizationId,
    watchedTrademarkId: watchedRecord.id,
    watchedTrademarkLabel: watchedRecord.label,
    candidate,
    status,
    scores: result.scores,
    totalScore: result.totalScore,
    weightProfileId: result.weightProfile.id,
    reviewedBy: null,
    reviewedAt: null,
    advisorRequestedAt: null,
    notes: [],
    createdAt: now,
    updatedAt: now,
  };
}

export async function buildDemoSeed(organizationId: string): Promise<DemoSeed> {
  const now = new Date().toISOString();

  const [lumaroFixture, novexaFixture] = BOIP_FIXTURE_TRADEMARK_REGISTRATIONS;
  if (!lumaroFixture || !novexaFixture) {
    throw new Error('expected at least two BOIP fixture trademark registrations for demo seeding');
  }

  const lumaroSnapshot = mapBoipTrademarkToSnapshot(lumaroFixture);
  const lumaroEligibility = boipV1WatchEligibilityPolicy.evaluate(lumaroSnapshot);

  const lumaroRecord: WatchedTrademarkRecord = {
    id: createId(),
    organizationId,
    label: 'LUMARO (hoofdmerk)',
    notes: 'Belangrijkste woordmerk van de organisatie.',
    status: 'active',
    registryCode: lumaroSnapshot.registryCode,
    registrationNumber: lumaroSnapshot.registrationNumber,
    markText: lumaroSnapshot.markText,
    niceClasses: lumaroSnapshot.niceClasses,
    eligibility: lumaroEligibility,
    watchSettings: {
      minScoreThreshold: 25,
      classMode: 'eigen',
      selectedNiceClasses: [...lumaroSnapshot.niceClasses],
      watchedRegisters: ['BOIP'],
    },
    createdAt: now,
    updatedAt: now,
  };

  const novexaSnapshot = mapBoipTrademarkToSnapshot(novexaFixture);
  const novexaRecord: WatchedTrademarkRecord = {
    id: createId(),
    organizationId,
    label: 'NOVEXA (gepauzeerd)',
    notes: null,
    status: 'paused',
    registryCode: novexaSnapshot.registryCode,
    registrationNumber: novexaSnapshot.registrationNumber,
    markText: novexaSnapshot.markText,
    niceClasses: novexaSnapshot.niceClasses,
    eligibility: boipV1WatchEligibilityPolicy.evaluate(novexaSnapshot),
    watchSettings: {
      minScoreThreshold: 40,
      classMode: 'eigen',
      selectedNiceClasses: [...novexaSnapshot.niceClasses],
      watchedRegisters: ['BOIP'],
    },
    createdAt: now,
    updatedAt: now,
  };

  const lumaroWatched: WatchedTrademark = {
    id: lumaroRecord.id,
    organizationId,
    label: lumaroRecord.label,
    status: lumaroRecord.status,
    eligibility: lumaroRecord.eligibility,
    snapshot: lumaroSnapshot,
    createdAt: now,
    updatedAt: now,
  };

  const matchStatusByMarkText: Record<string, TrademarkMatchRecord['status']> = {
    LUMAROO: 'new',
    LUMERO: 'under_review',
    BRENTIQ: 'dismissed',
    VELORA: 'new',
    NOVAFORM: 'opposition_deadline_passed',
  };

  const matches = await Promise.all(
    BOIP_FIXTURE_PUBLICATIONS.map(async (publication) => {
      let candidate = toCandidateApplication(mapBoipPublicationToCandidateApplicationInput(publication));
      const status = matchStatusByMarkText[publication.markText] ?? 'new';
      // Past opposition window — archive example ("niet meer aan te vechten").
      if (status === 'opposition_deadline_passed' && candidate.oppositionDeadline) {
        candidate = {
          ...candidate,
          oppositionDeadline: {
            ...candidate.oppositionDeadline,
            startDate: '2026-02-10',
            deadlineDate: '2026-04-10',
          },
        };
      }
      return buildScoredMatch(lumaroWatched, lumaroRecord, candidate, status);
    }),
  );

  matches.sort((a, b) => b.totalScore - a.totalScore);

  const topMatch = matches[0];
  const notifications: NotificationRecord[] = topMatch
    ? [
        {
          id: createId(),
          organizationId,
          payload: {
            type: 'new_match',
            organizationId,
            watchedTrademarkId: lumaroRecord.id,
            trademarkMatchId: topMatch.id,
            totalScore: topMatch.totalScore,
          },
          channel: 'in_app',
          sentAt: now,
          createdAt: now,
        },
      ]
    : [];

  const settings: OrganizationSettingsRecord = {
    organizationId,
    locale: 'nl-NL',
    timezone: 'Europe/Amsterdam',
    notificationEmail: 'merkbewaking@voorbeeld-merkenbureau.nl',
    digestFrequency: 'DAILY',
    updatedAt: now,
  };

  return {
    watchedTrademarks: [lumaroRecord, novexaRecord],
    matches,
    notifications,
    settings,
  };
}
