import { DEV_SEED_IDS } from '@merkwacht/database';
import { AppError } from '@merkwacht/shared';
import { describe, expect, it } from 'vitest';
import { createOrgBillingChatStore, DEMO_SECONDARY_ORG_ID } from './org-store.js';

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

    store.createRecipient(ORG_ID, { email: 'extra1@example.nl', mode: 'digest', digestCadence: 'DAILY' }, []);
    expect(() =>
      store.createRecipient(ORG_ID, { email: 'extra2@example.nl', mode: 'digest', digestCadence: 'DAILY' }, []),
    ).toThrow(AppError);
  });

  it('creates threshold and digest recipients with exclusive config', () => {
    const store = createOrgBillingChatStore(ORG_ID);
    const threshold = store.createRecipient(
      ORG_ID,
      { email: 'drempel@example.nl', mode: 'threshold', minScoreThreshold: 70 },
      [],
    );
    expect(threshold.mode).toBe('threshold');
    expect(threshold.minScoreThreshold).toBe(70);
    expect(threshold.digestCadence).toBeNull();

    const digest = store.createRecipient(
      ORG_ID,
      { email: 'digest@example.nl', mode: 'digest', digestCadence: 'MONTHLY' },
      [],
    );
    expect(digest.mode).toBe('digest');
    expect(digest.digestCadence).toBe('MONTHLY');
    expect(digest.minScoreThreshold).toBeNull();
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

  it('lists at least two seeded organizations', () => {
    const store = createOrgBillingChatStore(ORG_ID);
    const orgs = store.listOrganizations();
    expect(orgs.length).toBeGreaterThanOrEqual(2);
    expect(orgs.map((o) => o.id)).toEqual(expect.arrayContaining([ORG_ID, DEMO_SECONDARY_ORG_ID]));
    expect(orgs.find((o) => o.id === ORG_ID)?.openInvoiceCount).toBeGreaterThanOrEqual(1);
  });

  it('disables a plan so it cannot be chosen for changePlan', () => {
    const store = createOrgBillingChatStore(ORG_ID);
    const disabled = store.updatePlanCatalog('enterprise', { isActive: false });
    expect(disabled?.isActive).toBe(false);
    expect(store.listActivePlans().some((p) => p.code === 'enterprise')).toBe(false);
    expect(() => store.changePlan(ORG_ID, 'enterprise', { activeWatchedCount: 0, recipientCount: 0 })).toThrow(
      AppError,
    );
  });

  it('creates research invoice and marks paid with required internal note', () => {
    const store = createOrgBillingChatStore(ORG_ID);
    const invoice = store.createInvoice(ORG_ID, {
      amountCents: 9900,
      description: 'Merkonderzoek: TESTMARK',
    });
    expect(invoice.status).toBe('open');
    expect(store.listCustomerInvoices(ORG_ID).some((i) => i.id === invoice.id)).toBe(true);
    expect(store.listCustomerInvoices(ORG_ID).find((i) => i.id === invoice.id)).not.toHaveProperty('internalNote');

    const paid = store.markInvoicePaid(ORG_ID, invoice.id, {
      internalNote: 'Handmatig geaccordeerd door finance',
    });
    expect(paid?.status).toBe('paid');
    expect(paid?.internalNote).toBe('Handmatig geaccordeerd door finance');
  });

  it('seeds subscriptions with cancelAtPeriodEnd false and nextInvoiceAt from currentPeriodEnd', () => {
    const store = createOrgBillingChatStore(ORG_ID);
    const subscription = store.getSubscription(ORG_ID);
    expect(subscription.cancelAtPeriodEnd).toBe(false);
    expect(subscription.nextInvoiceAt).toBe(subscription.currentPeriodEnd);
  });

  it('requests and undoes cancel-at-period-end, toggling nextInvoiceAt', () => {
    const store = createOrgBillingChatStore(ORG_ID);
    const before = store.getSubscription(ORG_ID);

    const cancelled = store.requestCancelAtPeriodEnd(ORG_ID);
    expect(cancelled.cancelAtPeriodEnd).toBe(true);
    expect(cancelled.nextInvoiceAt).toBeNull();
    expect(cancelled.status).not.toBe('canceled');

    const undone = store.undoCancelAtPeriodEnd(ORG_ID);
    expect(undone.cancelAtPeriodEnd).toBe(false);
    expect(undone.nextInvoiceAt).toBe(before.currentPeriodEnd);
  });

  it('creates invoices with an NL BTW breakdown derived from line items', () => {
    const store = createOrgBillingChatStore(ORG_ID);
    const invoice = store.createInvoice(ORG_ID, {
      description: 'Merkwacht Pro — maandelijks abonnement',
      lineItems: [{ description: 'Merkwacht Pro — maandelijks abonnement', exVatCents: 19900 }],
    });

    expect(invoice.exVatCents).toBe(19900);
    expect(invoice.btwCents).toBe(4179);
    expect(invoice.amountCents).toBe(24079);
    expect(invoice.currency).toBe('EUR');
    expect(invoice.lineItems).toHaveLength(1);
    expect(invoice.lineItems?.[0]).toEqual({
      description: 'Merkwacht Pro — maandelijks abonnement',
      exVatCents: 19900,
      btwCents: 4179,
      incVatCents: 24079,
    });
  });

  it('derives an NL BTW breakdown from a legacy inc-VAT amountCents input', () => {
    const store = createOrgBillingChatStore(ORG_ID);
    const invoice = store.createInvoice(ORG_ID, {
      amountCents: 9900,
      description: 'Merkonderzoek: TESTMARK',
    });

    expect(invoice.amountCents).toBe(9900);
    expect(invoice.exVatCents + invoice.btwCents).toBe(9900);
    expect(invoice.exVatCents).toBeGreaterThan(0);
  });

  it('creates draft invoices without PDF/UBL availability until finalized', () => {
    const store = createOrgBillingChatStore(ORG_ID);
    const draft = store.createInvoice(ORG_ID, {
      description: 'Concept',
      exVatCents: 1000,
      status: 'draft',
    });
    expect(draft.status).toBe('draft');
    expect(draft.pdfAvailable).toBe(false);
    expect(draft.ublXmlAvailable).toBe(false);

    const finalized = store.finalizeInvoice(ORG_ID, draft.id);
    expect(finalized?.status).toBe('open');
    expect(finalized?.pdfAvailable).toBe(true);
    expect(finalized?.ublXmlAvailable).toBe(true);
  });

  it('refuses to finalize a non-draft invoice', () => {
    const store = createOrgBillingChatStore(ORG_ID);
    const openInvoice = store.listInvoices(ORG_ID).find((invoice) => invoice.status === 'open');
    expect(openInvoice).toBeDefined();
    expect(() => store.finalizeInvoice(ORG_ID, openInvoice!.id)).toThrow(AppError);
  });

  it('issues an upcoming invoice from the plan price and rolls the period forward', () => {
    const store = createOrgBillingChatStore(ORG_ID);
    const before = store.getSubscription(ORG_ID);

    const invoice = store.issueUpcomingInvoice(ORG_ID);
    expect(invoice.status).toBe('open');
    expect(invoice.exVatCents).toBe(4900); // starter plan price
    expect(invoice.btwCents).toBe(1029);

    const after = store.getSubscription(ORG_ID);
    expect(after.currentPeriodEnd).not.toBe(before.currentPeriodEnd);
    expect(after.nextInvoiceAt).toBe(after.currentPeriodEnd);
  });

  it('cancels the subscription when issuing the upcoming invoice while cancelAtPeriodEnd is set', () => {
    const store = createOrgBillingChatStore(ORG_ID);
    store.requestCancelAtPeriodEnd(ORG_ID);

    store.issueUpcomingInvoice(ORG_ID);

    const after = store.getSubscription(ORG_ID);
    expect(after.status).toBe('canceled');
    expect(after.cancelAtPeriodEnd).toBe(false);
    expect(after.nextInvoiceAt).toBeNull();
  });

  it('sends and lists in-app notifications per organization', () => {
    const store = createOrgBillingChatStore(ORG_ID);
    const notification = store.sendInAppNotification({
      organizationId: ORG_ID,
      title: 'Test',
      body: 'Hallo klant',
      sentByUserId: DEV_SEED_IDS.userId,
    });
    expect(store.listInAppNotifications(ORG_ID)).toHaveLength(1);
    expect(store.listInAppNotifications(DEMO_SECONDARY_ORG_ID)).toHaveLength(0);
    const read = store.markInAppNotificationRead(ORG_ID, notification.id);
    expect(read?.readAt).toBeTruthy();
  });
});
