import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLAN_CATALOG,
  canAddNotificationRecipient,
  canAddWatchedTrademark,
  evaluatePlanChange,
  requireFeature,
  resolveEntitlements,
} from './subscriptions.js';

const orgId = 'org-1';

function ents(plan: keyof typeof DEFAULT_PLAN_CATALOG = 'basis') {
  return resolveEntitlements({
    organizationId: orgId,
    plan,
    status: 'active',
    limits: DEFAULT_PLAN_CATALOG[plan],
  });
}

describe('entitlement enforcement', () => {
  it('blocks adding watches beyond plan limit', () => {
    expect(canAddWatchedTrademark(ents('basis'), 1)).toBe('watched_trademark_limit');
    expect(canAddWatchedTrademark(ents('basis'), 0)).toBeNull();
  });

  it('blocks notification recipients beyond plan and hard-caps at 100', () => {
    expect(canAddNotificationRecipient(ents('basis'), 2)).toBe('notification_email_limit');
    const enterprise = ents('enterprise');
    expect(enterprise.maxNotificationEmails).toBe(100);
    expect(canAddNotificationRecipient(enterprise, 100)).toBe('notification_email_limit');
  });

  it('gates pdf and chat features', () => {
    expect(requireFeature(ents('basis'), 'pdf_export')).toBe('feature_disabled');
    expect(requireFeature(ents('plus'), 'pdf_export')).toBeNull();
    expect(requireFeature(ents('starter'), 'merkrechten_chat')).toBe('feature_disabled');
    expect(requireFeature(ents('pro'), 'merkrechten_chat')).toBeNull();
  });
});

describe('evaluatePlanChange', () => {
  it('upgrades immediately', () => {
    const result = evaluatePlanChange({
      current: ents('basis'),
      targetPlan: 'pro',
      targetLimits: DEFAULT_PLAN_CATALOG.pro,
      activeWatchedCount: 1,
      recipientCount: 1,
    });
    expect(result).toEqual({ ok: true, immediate: true });
  });

  it('schedules downgrade when usage fits', () => {
    const result = evaluatePlanChange({
      current: ents('pro'),
      targetPlan: 'starter',
      targetLimits: DEFAULT_PLAN_CATALOG.starter,
      activeWatchedCount: 2,
      recipientCount: 2,
    });
    expect(result).toEqual({ ok: true, immediate: false });
  });

  it('blocks downgrade when too many watches', () => {
    const result = evaluatePlanChange({
      current: ents('pro'),
      targetPlan: 'basis',
      targetLimits: DEFAULT_PLAN_CATALOG.basis,
      activeWatchedCount: 5,
      recipientCount: 1,
    });
    expect(result).toEqual({ ok: false, reason: 'downgrade_exceeds_watches' });
  });
});
