import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { apiRequest } from './client';
import { queryKeys } from './keys';

export interface RegisterCatalogRecord {
  readonly code: string;
  readonly displayNameNl: string;
  readonly regionNl: string;
  readonly continent?: string;
  readonly classificationSchemeId?: string;
  readonly authMode?: string;
  readonly connectorStatus: 'live' | 'coming_soon' | 'disabled';
  readonly basePriceCents: number;
  readonly enabledForWatch: boolean;
  readonly enabledForNameResearch: boolean;
}

export interface NameResearchCredits {
  readonly organizationId: string;
  readonly balance: number;
  readonly usedThisPeriod: number;
}

export interface NameResearchScopeRecord {
  readonly registryCode: string;
  readonly niceClasses: readonly number[];
}

export interface NameResearchHitRecord {
  readonly id: string;
  readonly orderId: string;
  readonly priorMarkText: string;
  readonly registryCode: string;
  readonly niceClasses: readonly number[];
  readonly scores: {
    readonly textualSimilarity: number;
    readonly phoneticSimilarity: number;
    readonly visualSimilarity: number;
    readonly niceClassOverlap: number;
  };
  readonly totalRiskScore: number;
  readonly priorMarkNumber: string | null;
  readonly applicantName: string | null;
  readonly filingDate: string | null;
  readonly registrationOrPublicationDate: string | null;
  readonly markType: string | null;
  readonly statusNl: string | null;
}

export interface NameResearchOrderRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly markText: string;
  readonly intendedNicheNl: string | null;
  readonly scopes: readonly NameResearchScopeRecord[];
  readonly minScoreThreshold: number;
  readonly status: string;
  readonly priceCents: number;
  readonly currency: 'eur';
  readonly creditUsed: boolean;
  readonly progressSteps: readonly {
    readonly id: string;
    readonly labelNl: string;
    readonly registryCode: string | null;
    readonly status: string;
  }[];
  readonly overallRiskScore: number | null;
  readonly adviceBand: 'low' | 'medium' | 'high' | null;
  readonly adviceTextNl: string | null;
  readonly hits: readonly NameResearchHitRecord[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt: string | null;
}

export interface NameResearchQuote {
  readonly registerSubtotalCents: number;
  readonly totalCents: number;
  readonly currency: 'eur';
  readonly lineItems: readonly { code: string; labelNl: string; amountCents: number }[];
}

export function useNameResearchRegisters() {
  return useQuery({
    queryKey: queryKeys.nameResearch.registers,
    queryFn: async () => {
      const { registers } = await apiRequest<{ registers: readonly RegisterCatalogRecord[] }>(
        '/api/v1/name-research/registers',
      );
      return registers;
    },
  });
}

export function useNameResearchCredits() {
  return useQuery({
    queryKey: queryKeys.nameResearch.credits,
    queryFn: async () => {
      const { credits } = await apiRequest<{ credits: NameResearchCredits }>('/api/v1/name-research/credits');
      return credits;
    },
  });
}

export function useNameResearchOrders() {
  return useQuery({
    queryKey: queryKeys.nameResearch.orders,
    queryFn: async () => {
      const { orders } = await apiRequest<{ orders: readonly NameResearchOrderRecord[] }>(
        '/api/v1/name-research/orders',
      );
      return orders;
    },
  });
}

export function useNameResearchOrder(id: () => string) {
  return useQuery({
    queryKey: ['name-research', 'order', id()],
    queryFn: async () => {
      const { order } = await apiRequest<{ order: NameResearchOrderRecord }>(
        `/api/v1/name-research/orders/${id()}`,
      );
      return order;
    },
    enabled: () => Boolean(id()),
  });
}

export function useNameResearchQuote() {
  return useMutation({
    mutationFn: (body: { scopes: readonly NameResearchScopeRecord[] }) =>
      apiRequest<{ quote: NameResearchQuote }>('/api/v1/name-research/quotes', { method: 'POST', body }),
  });
}

export function useCreateNameResearchOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      markText: string;
      intendedNicheNl?: string | null;
      scopes: readonly NameResearchScopeRecord[];
      minScoreThreshold: number;
      useCredit: boolean;
    }) =>
      apiRequest<{ order: NameResearchOrderRecord; checkoutUrl: string | null }>(
        '/api/v1/name-research/orders',
        { method: 'POST', body },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['name-research'] });
      void queryClient.invalidateQueries({ queryKey: ['platform', 'name-research'] });
    },
  });
}

export function usePlatformRegisterCatalog() {
  return useQuery({
    queryKey: ['platform', 'register-catalog'],
    queryFn: async () => {
      const { registers } = await apiRequest<{ registers: readonly RegisterCatalogRecord[] }>(
        '/api/platform/register-catalog',
      );
      return registers;
    },
  });
}

export function usePlatformNameResearchOrders() {
  return useQuery({
    queryKey: ['platform', 'name-research'],
    queryFn: async () => {
      const { orders } = await apiRequest<{ orders: readonly NameResearchOrderRecord[] }>(
        '/api/platform/name-research',
      );
      return orders;
    },
  });
}

export function formatEuroCents(cents: number): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

export function formatScopeSummary(scopes: readonly NameResearchScopeRecord[]): string {
  return scopes
    .map((s) => {
      const classes =
        s.niceClasses.length >= 45 ? 'alle klassen' : s.niceClasses.join(', ');
      return `${s.registryCode} (${classes})`;
    })
    .join(' · ');
}
