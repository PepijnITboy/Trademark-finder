import {
  adviceBandFromRisk,
  adviceTextNl,
  clampNameResearchThreshold,
  clearanceRiskScore,
  DEFAULT_REGISTER_CATALOG,
  quoteNameResearch,
  validateNameResearchScopes,
  type NameResearchHit,
  type NameResearchOrder,
  type NameResearchProgressStep,
  type NameResearchRegisterScope,
  type RegisterCatalogEntry,
} from '@merkwacht/domain';
import { createId } from '@merkwacht/shared';
import { BOIP_FIXTURE_PUBLICATIONS, BOIP_FIXTURE_TRADEMARK_REGISTRATIONS } from '@merkwacht/register-connectors';

export interface NameResearchCreditState {
  readonly organizationId: string;
  balance: number;
  usedThisPeriod: number;
}

/**
 * In-memory Merkonderzoek store (DemoStore companion). Kept separate from
 * TrademarkMatch persistence so the two product surfaces never share rows.
 */
export class NameResearchStore {
  private readonly catalog: Map<string, RegisterCatalogEntry>;
  private readonly orders = new Map<string, NameResearchOrder>();
  private readonly credits = new Map<string, NameResearchCreditState>();

  constructor(seedCreditsByOrg: Record<string, number> = {}) {
    this.catalog = new Map(DEFAULT_REGISTER_CATALOG.map((r) => [r.code, { ...r }]));
    for (const [orgId, balance] of Object.entries(seedCreditsByOrg)) {
      this.credits.set(orgId, { organizationId: orgId, balance, usedThisPeriod: 0 });
    }
  }

  listCatalog(): readonly RegisterCatalogEntry[] {
    return [...this.catalog.values()].sort((a, b) => a.displayNameNl.localeCompare(b.displayNameNl));
  }

  updateCatalogEntry(code: string, patch: Partial<RegisterCatalogEntry>): RegisterCatalogEntry | null {
    const existing = this.catalog.get(code);
    if (!existing) return null;
    const updated: RegisterCatalogEntry = { ...existing, ...patch, code: existing.code };
    this.catalog.set(code, updated);
    return updated;
  }

  getCredits(organizationId: string): NameResearchCreditState {
    const existing = this.credits.get(organizationId);
    if (existing) return existing;
    const created: NameResearchCreditState = { organizationId, balance: 1, usedThisPeriod: 0 };
    this.credits.set(organizationId, created);
    return created;
  }

  consumeCredit(organizationId: string): boolean {
    const state = this.getCredits(organizationId);
    if (state.balance <= 0) return false;
    state.balance -= 1;
    state.usedThisPeriod += 1;
    return true;
  }

  listOrders(organizationId: string): readonly NameResearchOrder[] {
    return [...this.orders.values()]
      .filter((o) => o.organizationId === organizationId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  listAllOrders(): readonly NameResearchOrder[] {
    return [...this.orders.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getOrder(organizationId: string, id: string): NameResearchOrder | null {
    const order = this.orders.get(id);
    if (!order || order.organizationId !== organizationId) return null;
    return order;
  }

  getOrderById(id: string): NameResearchOrder | null {
    return this.orders.get(id) ?? null;
  }

  createQuote(input: { scopes: readonly NameResearchRegisterScope[] }) {
    return quoteNameResearch({
      scopes: input.scopes,
      catalog: this.listCatalog(),
    });
  }

  createOrder(input: {
    organizationId: string;
    markText: string;
    intendedNicheNl?: string | null;
    scopes: readonly NameResearchRegisterScope[];
    minScoreThreshold: number;
    useCredit: boolean;
  }): { order: NameResearchOrder; checkoutRequired: boolean; totalCents: number } {
    validateNameResearchScopes(input.scopes);
    const threshold = clampNameResearchThreshold(input.minScoreThreshold);
    const quote = this.createQuote({ scopes: input.scopes });

    let creditUsed = false;
    let checkoutRequired = true;
    if (input.useCredit && this.consumeCredit(input.organizationId)) {
      creditUsed = true;
      checkoutRequired = false;
    }

    const now = new Date().toISOString();
    const id = createId();
    const progressSteps: NameResearchProgressStep[] = input.scopes.map((scope) => {
      const entry = this.catalog.get(scope.registryCode);
      const live = entry?.connectorStatus === 'live';
      return {
        id: createId(),
        labelNl: live
          ? `Zoeken in ${entry?.displayNameNl ?? scope.registryCode}`
          : `${entry?.displayNameNl ?? scope.registryCode} (connector volgt)`,
        registryCode: scope.registryCode,
        status: live ? 'pending' : 'pending_connector',
      };
    });

    const order: NameResearchOrder = {
      id,
      organizationId: input.organizationId,
      markText: input.markText.trim(),
      intendedNicheNl: input.intendedNicheNl?.trim() ? input.intendedNicheNl.trim() : null,
      scopes: input.scopes.map((s) => ({
        registryCode: s.registryCode,
        niceClasses: [...s.niceClasses].sort((a, b) => a - b),
      })),
      minScoreThreshold: threshold,
      status: checkoutRequired ? 'awaiting_payment' : 'queued',
      priceCents: creditUsed ? 0 : quote.totalCents,
      currency: 'eur',
      creditUsed,
      stripeSessionId: null,
      progressSteps,
      overallRiskScore: null,
      adviceBand: null,
      adviceTextNl: null,
      hits: [],
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
    this.orders.set(id, order);

    if (!checkoutRequired) {
      this.runOrder(id);
    }

    return { order: this.orders.get(id)!, checkoutRequired, totalCents: quote.totalCents };
  }

  markPaid(orderId: string, stripeSessionId: string): NameResearchOrder | null {
    const order = this.orders.get(orderId);
    if (!order) return null;
    const updated: NameResearchOrder = {
      ...order,
      status: 'queued',
      stripeSessionId,
      updatedAt: new Date().toISOString(),
    };
    this.orders.set(orderId, updated);
    this.runOrder(orderId);
    return this.orders.get(orderId) ?? null;
  }

  /** Synchronously execute a queued research order (demo/worker stand-in). */
  runOrder(orderId: string): NameResearchOrder | null {
    const order = this.orders.get(orderId);
    if (!order) return null;
    if (order.status !== 'queued' && order.status !== 'running') return order;

    let working: NameResearchOrder = {
      ...order,
      status: 'running',
      updatedAt: new Date().toISOString(),
    };
    this.orders.set(orderId, working);

    const hits: NameResearchHit[] = [];
    const steps: NameResearchProgressStep[] = working.progressSteps.map((step) => {
      if (step.status === 'pending_connector') return step;
      const registryCode = step.registryCode ?? 'BOIP';
      const scope = working.scopes.find((s) => s.registryCode === registryCode);
      if (!scope) return { ...step, status: 'failed' };
      if (registryCode === 'BOIP') {
        hits.push(...this.searchBoip(working, scope));
        return { ...step, status: 'completed' };
      }
      return { ...step, status: 'pending_connector' };
    });

    const filtered = hits.filter((h) => h.totalRiskScore >= working.minScoreThreshold);
    filtered.sort((a, b) => b.totalRiskScore - a.totalRiskScore);
    const overall = filtered[0]?.totalRiskScore ?? 0;
    const band = adviceBandFromRisk(overall);

    working = {
      ...working,
      status: 'completed',
      progressSteps: steps,
      hits: filtered,
      overallRiskScore: overall,
      adviceBand: band,
      adviceTextNl: adviceTextNl(band, working.markText),
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    this.orders.set(orderId, working);
    return working;
  }

  private searchBoip(
    order: NameResearchOrder,
    scope: NameResearchRegisterScope,
  ): NameResearchHit[] {
    const selected = new Set(scope.niceClasses);
    const allClasses = scope.niceClasses.length >= 45;

    const priors = [
      ...BOIP_FIXTURE_TRADEMARK_REGISTRATIONS.map((r) => ({
        markText: r.markText,
        niceClasses: r.niceClasses,
        priorMarkNumber: r.registrationNumber,
        applicantName: r.applicantName,
        filingDate: r.filingDate,
        registrationOrPublicationDate: r.registrationDate,
        markType: r.markType,
        statusNl: r.registerStatus === 'REGISTERED' ? 'Geregistreerd' : r.registerStatus,
      })),
      ...BOIP_FIXTURE_PUBLICATIONS.map((p) => ({
        markText: p.markText,
        niceClasses: p.niceClasses,
        priorMarkNumber: p.applicationNumber,
        applicantName: p.applicantName,
        filingDate: p.filingDate,
        registrationOrPublicationDate: p.publicationDate,
        markType: p.markType,
        statusNl: p.proceduralStatus === 'PUBLISHED' ? 'Gepubliceerd' : p.proceduralStatus,
      })),
    ];

    return priors
      .filter((prior) => allClasses || prior.niceClasses.some((c) => selected.has(c)))
      .map((prior) => {
        const overlap = allClasses || prior.niceClasses.some((c) => selected.has(c));
        const scored = clearanceRiskScore(order.markText, prior.markText, overlap);
        return {
          id: createId(),
          orderId: order.id,
          priorMarkText: prior.markText,
          registryCode: 'BOIP',
          niceClasses: prior.niceClasses,
          scores: {
            textualSimilarity: scored.textualSimilarity,
            phoneticSimilarity: scored.phoneticSimilarity,
            visualSimilarity: scored.visualSimilarity,
            niceClassOverlap: scored.niceClassOverlap,
          },
          totalRiskScore: scored.totalRiskScore,
          priorMarkNumber: prior.priorMarkNumber,
          applicantName: prior.applicantName,
          filingDate: prior.filingDate,
          registrationOrPublicationDate: prior.registrationOrPublicationDate,
          markType: prior.markType,
          statusNl: prior.statusNl,
        } satisfies NameResearchHit;
      });
  }
}
