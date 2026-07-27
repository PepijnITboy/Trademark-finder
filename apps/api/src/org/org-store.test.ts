import { DEV_SEED_IDS } from '@merkwacht/database';
import { AppError } from '@merkwacht/shared';
import { describe, expect, it } from 'vitest';
import { createOrgBillingChatStore } from './org-store.js';

const ORG_ID = DEV_SEED_IDS.organizationId;

describe('OrgBillingChatStore', () => {
  it('blocks a jurist from removing an admin member', () => {
    const store = createOrgBillingChatStore(ORG_ID);
    const admin = store.listMembers(ORG_ID).find((member) => member.role === 'owner');
    expect(admin).toBeDefined();

    expect(() => store.removeMember(ORG_ID, admin!.id, 'jurist', 'jurist-user')).toThrow(AppError);
    try {
      store.removeMember(ORG_ID, admin!.id, 'jurist', 'jurist-user');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('ROLE_MUTATION_DENIED');
    }
  });

  it('blocks removing the last admin', () => {
    const store = createOrgBillingChatStore(ORG_ID);
    const admin = store.listMembers(ORG_ID).find((member) => member.role === 'owner');
    expect(admin).toBeDefined();

    expect(() => store.removeMember(ORG_ID, admin!.id, 'admin', admin!.id)).toThrow(AppError);
  });

  it('enforces watched trademark limit on the basis plan', () => {
    const store = createOrgBillingChatStore(ORG_ID);
    store.forceSubscription(ORG_ID, { plan: 'basis', status: 'active', pendingPlan: null });

    expect(() => store.assertCanAddWatchedTrademark(ORG_ID, 1)).toThrow(AppError);
    try {
      store.assertCanAddWatchedTrademark(ORG_ID, 1);
    } catch (error) {
      expect((error as AppError).httpStatus).toBe(402);
    }
  });

  it('enforces notification recipient limit on the basis plan', () => {
    const store = createOrgBillingChatStore(ORG_ID);
    store.forceSubscription(ORG_ID, { plan: 'basis', status: 'active', pendingPlan: null });

    store.createRecipient(ORG_ID, { email: 'extra1@example.nl', digestFrequency: 'DAILY' }, []);
    expect(() =>
      store.createRecipient(ORG_ID, { email: 'extra2@example.nl', digestFrequency: 'DAILY' }, []),
    ).toThrow(AppError);
  });

  it('applies upgrades immediately and schedules downgrades as pending', () => {
    const store = createOrgBillingChatStore(ORG_ID);

    const upgraded = store.changePlan(ORG_ID, 'pro', { activeWatchedCount: 1, recipientCount: 1 });
    expect(upgraded.plan).toBe('pro');
    expect(upgraded.status).toBe('active');
    expect(upgraded.pendingPlan).toBeNull();

    const downgraded = store.changePlan(ORG_ID, 'starter', { activeWatchedCount: 1, recipientCount: 1 });
    expect(downgraded.status).toBe('pending_downgrade');
    expect(downgraded.pendingPlan).toBe('starter');
    expect(downgraded.plan).toBe('pro');
  });

  it('gates merkrechten_chat on starter vs pro plans', () => {
    const store = createOrgBillingChatStore(ORG_ID);

    const starterEntitlements = store.getEntitlements(ORG_ID);
    expect(starterEntitlements.plan).toBe('starter');
    expect(starterEntitlements.features.merkrechten_chat).toBe(false);

    store.changePlan(ORG_ID, 'pro', { activeWatchedCount: 1, recipientCount: 1 });
    const proEntitlements = store.getEntitlements(ORG_ID);
    expect(proEntitlements.features.merkrechten_chat).toBe(true);
  });

  it('marks an open invoice as paid via checkout', () => {
    const store = createOrgBillingChatStore(ORG_ID);
    const openInvoice = store.listInvoices(ORG_ID).find((invoice) => invoice.status === 'open');
    expect(openInvoice).toBeDefined();

    const paid = store.markInvoicePaid(ORG_ID, openInvoice!.id);
    expect(paid?.status).toBe('paid');
    expect(paid?.paidAt).toBeTruthy();
  });
});
