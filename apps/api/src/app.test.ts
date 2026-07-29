import type { ApiEnv } from '@merkwacht/config';
import { DEV_SEED_IDS } from '@merkwacht/database';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MOCK_CHECKOUT_URL, MOCK_WEBHOOK_SECRET } from './billing/mock-provider.js';
import { buildApp } from './app.js';

/**
 * A syntactically valid `ApiEnv`, pointing at unreachable Supabase
 * infrastructure. `createAppStore` probes Postgres reachability at startup
 * and falls back to the in-memory `DemoStore` when it's unreachable (see
 * `src/store/create-store.ts`), so `buildApp` still resolves and the routes
 * below can be exercised without a real Supabase/Postgres instance.
 */
const TEST_ENV: ApiEnv = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'error',
  PORT: 4000,
  HOST: '0.0.0.0',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  INTERNAL_JOB_SECRET: 'a-test-internal-job-secret-value',
  CORS_ORIGIN: 'http://localhost:5173',
  ALLOW_DEMO_STORE: true,
  DEV_DEMO_AUTH: true,
  BOIP_USE_FIXTURES: true,
  EUIPO_USE_FIXTURES: false,
  USPTO_USE_FIXTURES: false,
  WIPO_USE_FIXTURES: false,
};

describe('buildApp', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ env: TEST_ENV });
  }, 15_000);

  afterAll(async () => {
    await app.close();
  });

  it('responds 200 with an ok status on GET /api/v1/health', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toMatchObject({ status: 'ok', service: 'merkwacht-api' });
    expect(typeof body.timestamp).toBe('string');
    expect(() => new Date(body.timestamp).toISOString()).not.toThrow();
  });

  it('responds 200 with the dashboard shape on GET /api/v1/dashboard', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/dashboard' });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty('kpis');
    expect(body).toHaveProperty('recentMatches');
    expect(body).toHaveProperty('upcomingDeadlines');
    expect(Array.isArray(body.recentMatches)).toBe(true);
    expect(Array.isArray(body.upcomingDeadlines)).toBe(true);
  });

  it('responds 404 with the standard error envelope for an unknown route', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/does-not-exist' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: 'ROUTE_NOT_FOUND' });
  });

  it('returns organization profile on GET /api/v1/organization', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/organization' });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.profile.legalName).toBe('Lumaro B.V.');
  });

  it('returns subscription and plan catalog', async () => {
    const subscriptionResponse = await app.inject({ method: 'GET', url: '/api/v1/subscription' });
    expect(subscriptionResponse.statusCode).toBe(200);
    expect(subscriptionResponse.json().subscription.plan).toBe('starter');

    const plansResponse = await app.inject({ method: 'GET', url: '/api/v1/subscription/plans' });
    expect(plansResponse.statusCode).toBe(200);
    expect(plansResponse.json().plans.length).toBeGreaterThanOrEqual(5);
  });

  it('requests and undoes cancel-at-period-end via the subscription API', async () => {
    const cancelResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/subscription/cancel-at-period-end',
    });
    expect(cancelResponse.statusCode).toBe(200);
    expect(cancelResponse.json().subscription.cancelAtPeriodEnd).toBe(true);
    expect(cancelResponse.json().subscription.nextInvoiceAt).toBeNull();

    const undoResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/subscription/undo-cancel-at-period-end',
    });
    expect(undoResponse.statusCode).toBe(200);
    expect(undoResponse.json().subscription.cancelAtPeriodEnd).toBe(false);
    expect(undoResponse.json().subscription.nextInvoiceAt).toBeTruthy();
  });

  it('returns invoices with an NL BTW breakdown and downloadable PDF/UBL', async () => {
    const listResponse = await app.inject({ method: 'GET', url: '/api/v1/invoices' });
    expect(listResponse.statusCode).toBe(200);
    const invoice = listResponse.json().invoices[0];
    expect(invoice).toHaveProperty('exVatCents');
    expect(invoice).toHaveProperty('btwCents');
    expect(invoice.exVatCents + invoice.btwCents).toBe(invoice.amountCents);
    expect(invoice.currency).toBe('EUR');

    const pdfResponse = await app.inject({ method: 'GET', url: `/api/v1/invoices/${invoice.id}/pdf` });
    expect(pdfResponse.statusCode).toBe(200);
    expect(pdfResponse.headers['content-type']).toContain('application/pdf');
    expect(pdfResponse.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');

    const ublResponse = await app.inject({ method: 'GET', url: `/api/v1/invoices/${invoice.id}/ubl` });
    expect(ublResponse.statusCode).toBe(200);
    expect(ublResponse.headers['content-type']).toContain('xml');
    expect(ublResponse.body).toContain('<cbc:Percent>21</cbc:Percent>');
  });

  it('blocks chat thread creation on starter plan with 403', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/chat/threads',
      payload: { subject: 'Vraag over merk', body: 'Kunnen jullie me helpen?' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe('ENTITLEMENT_DENIED');
  });

  it('starts Stripe checkout and returns a session url', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout',
      payload: { purpose: 'add_payment_method' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.configured).toBe(true);
    expect(body.url).toMatch(new RegExp(`^${MOCK_CHECKOUT_URL.replace('.', '\\.')}/`));
  });

  it('marks an invoice paid via legacy mock checkout', async () => {
    const listResponse = await app.inject({ method: 'GET', url: '/api/v1/invoices' });
    const openInvoice = listResponse.json().invoices.find((invoice: { status: string }) => invoice.status === 'open');
    expect(openInvoice).toBeDefined();

    const checkoutResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/invoices/${openInvoice.id}/checkout`,
    });

    expect(checkoutResponse.statusCode).toBe(200);
    expect(checkoutResponse.json().invoice.status).toBe('paid');
  });

  it('rejects billing webhooks with a bad signature', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/webhook',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 'invalid',
      },
      payload: Buffer.from('{}'),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('BILLING_WEBHOOK_INVALID');
  });

  it('marks an invoice paid via billing webhook', async () => {
    const listResponse = await app.inject({ method: 'GET', url: '/api/v1/invoices' });
    const targetInvoice = listResponse.json().invoices[0];
    expect(targetInvoice).toBeDefined();

    const payload = JSON.stringify({
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: {
            organizationId: DEV_SEED_IDS.organizationId,
            invoiceId: targetInvoice.id,
            purpose: 'pay_invoice',
          },
        },
      },
    });

    const webhookResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/webhook',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': MOCK_WEBHOOK_SECRET,
      },
      payload: Buffer.from(payload),
    });
    expect(webhookResponse.statusCode).toBe(200);

    const refreshed = await app.inject({ method: 'GET', url: '/api/v1/invoices' });
    const paid = refreshed.json().invoices.find((invoice: { id: string }) => invoice.id === targetInvoice.id);
    expect(paid.status).toBe('paid');
  });

  it('lists invoices for platform operators', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/platform/org/billing' });
    expect(response.statusCode).toBe(200);
    expect(response.json().invoices.length).toBeGreaterThan(0);
    expect(response.json().invoices[0]).toHaveProperty('organizationName');
  });

  it('rejects creating a watched trademark when the plan limit is reached', async () => {
    await app.inject({
      method: 'POST',
      url: `/api/platform/org/organizations/${DEV_SEED_IDS.organizationId}/subscription/force`,
      payload: { plan: 'basis', status: 'active', pendingPlan: null },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/watched-trademarks',
      payload: {
        label: 'Extra merk',
        registryCode: 'BOIP',
        registrationNumber: '123456',
      },
    });

    expect(response.statusCode).toBe(402);
    expect(response.json().code).toBe('ENTITLEMENT_DENIED');
  });

  it('filters matches by queue on GET /api/v1/matches', async () => {
    const allResponse = await app.inject({ method: 'GET', url: '/api/v1/matches' });
    expect(allResponse.statusCode).toBe(200);
    const allMatches = allResponse.json().matches as Array<{ status: string }>;

    const possibleResponse = await app.inject({ method: 'GET', url: '/api/v1/matches?queue=possible' });
    expect(possibleResponse.statusCode).toBe(200);
    const possibleMatches = possibleResponse.json().matches as Array<{ status: string }>;
    expect(possibleMatches.every((m) => m.status === 'new')).toBe(true);
    expect(possibleMatches.length).toBeGreaterThan(0);
    expect(possibleMatches.length).toBeLessThanOrEqual(allMatches.length);

    const activeResponse = await app.inject({ method: 'GET', url: '/api/v1/matches?queue=active' });
    expect(activeResponse.statusCode).toBe(200);
    const activeMatches = activeResponse.json().matches as Array<{ status: string }>;
    expect(activeMatches.every((m) => ['under_review', 'confirmed_conflict', 'opposition_filed'].includes(m.status))).toBe(
      true,
    );
    expect(activeMatches.length).toBeGreaterThan(0);
  });

  it('accepts and rejects possible matches via POST endpoints', async () => {
    const listResponse = await app.inject({ method: 'GET', url: '/api/v1/matches?queue=possible' });
    const possible = listResponse.json().matches as Array<{ id: string; status: string }>;
    expect(possible.length).toBeGreaterThan(0);

    const acceptTarget = possible[0]!;
    const acceptResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${acceptTarget.id}/accept`,
    });
    expect(acceptResponse.statusCode).toBe(200);
    expect(acceptResponse.json().match.status).toBe('under_review');

    const rejectTarget = possible.find((m) => m.id !== acceptTarget.id);
    expect(rejectTarget).toBeDefined();
    const rejectResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${rejectTarget!.id}/reject`,
      payload: { reason: 'Testafwijzing' },
    });
    expect(rejectResponse.statusCode).toBe(200);
    expect(rejectResponse.json().match.status).toBe('dismissed');
  });

  it('quotes and runs name research with scopes without touching matches', async () => {
    const registers = await app.inject({ method: 'GET', url: '/api/v1/name-research/registers' });
    expect(registers.statusCode).toBe(200);
    const codes = (registers.json().registers as Array<{ code: string }>).map((r) => r.code);
    expect(codes).toContain('BOIP');
    expect(codes).toContain('EUIPO');

    const quote = await app.inject({
      method: 'POST',
      url: '/api/v1/name-research/quotes',
      payload: { scopes: [{ registryCode: 'BOIP', niceClasses: [9, 35] }] },
    });
    expect(quote.statusCode).toBe(200);
    expect(quote.json().quote.totalCents).toBe(7900);
    expect(quote.json().quote.thresholdSurchargeCents).toBeUndefined();

    const quoteHigh = await app.inject({
      method: 'POST',
      url: '/api/v1/name-research/quotes',
      payload: {
        scopes: [{ registryCode: 'BOIP', niceClasses: Array.from({ length: 45 }, (_, i) => i + 1) }],
      },
    });
    expect(quoteHigh.json().quote.totalCents).toBe(7900);

    const matchesBefore = await app.inject({ method: 'GET', url: '/api/v1/matches' });
    const matchCountBefore = matchesBefore.json().matches.length;

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/name-research/orders',
      payload: {
        markText: 'WILLEM P',
        intendedNicheNl: 'Apps en SaaS',
        scopes: [{ registryCode: 'BOIP', niceClasses: [9, 35, 42] }],
        minScoreThreshold: 20,
        useCredit: true,
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().order.status).toBe('completed');
    expect(created.json().order.scopes[0].registryCode).toBe('BOIP');
    expect(created.json().order.hits.length).toBeGreaterThan(0);
    expect(created.json().order.hits[0].applicantName).toBeTruthy();
    expect(created.json().order).not.toHaveProperty('watchedTrademarkId');
    expect(created.json().checkoutUrl).toBeNull();

    const matchesAfter = await app.inject({ method: 'GET', url: '/api/v1/matches' });
    expect(matchesAfter.json().matches.length).toBe(matchCountBefore);

    const priceBefore = await app.inject({
      method: 'POST',
      url: '/api/v1/name-research/quotes',
      payload: { scopes: [{ registryCode: 'BOIP', niceClasses: [9] }] },
    });
    const patchedPrice = await app.inject({
      method: 'PATCH',
      url: '/api/platform/register-catalog/BOIP',
      payload: { basePriceCents: 12300 },
    });
    expect(patchedPrice.statusCode).toBe(200);
    const priceAfter = await app.inject({
      method: 'POST',
      url: '/api/v1/name-research/quotes',
      payload: { scopes: [{ registryCode: 'BOIP', niceClasses: [9] }] },
    });
    expect(priceAfter.json().quote.totalCents).toBe(12300);
    expect(priceAfter.json().quote.totalCents).not.toBe(priceBefore.json().quote.totalCents);

    const catalog = await app.inject({ method: 'GET', url: '/api/platform/register-catalog' });
    expect(catalog.statusCode).toBe(200);
    expect(catalog.json().registers.length).toBeGreaterThanOrEqual(6);

    const patched = await app.inject({
      method: 'PATCH',
      url: '/api/platform/register-catalog/EUIPO',
      payload: {
        enabledForNameResearch: false,
        connectorStatus: 'disabled',
        disableReason: 'Test: tijdelijk uit voor name-research scope',
      },
    });
    expect(patched.statusCode).toBe(200);

    const registersAfter = await app.inject({ method: 'GET', url: '/api/v1/name-research/registers' });
    const codesAfter = (registersAfter.json().registers as Array<{ code: string }>).map((r) => r.code);
    expect(codesAfter).not.toContain('EUIPO');

    const platformOrders = await app.inject({ method: 'GET', url: '/api/platform/name-research' });
    expect(platformOrders.statusCode).toBe(200);
    expect(platformOrders.json().orders.length).toBeGreaterThan(0);
    expect(platformOrders.json().orders[0].scopes).toBeDefined();
  });

  it('rejects confirmed_conflict status change on already-active matches', async () => {
    const activeResponse = await app.inject({ method: 'GET', url: '/api/v1/matches?queue=active' });
    const active = activeResponse.json().matches as Array<{ id: string; status: string }>;
    const target = active.find((m) => m.status === 'under_review') ?? active[0];
    if (!target) return;

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/matches/${target.id}/status`,
      payload: { status: 'confirmed_conflict' },
    });
    expect(response.statusCode).toBe(409);
  });
});
