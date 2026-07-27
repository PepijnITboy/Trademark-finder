import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { apiRequest } from './client';
import { queryKeys } from './keys';
import type { PlatformInvoiceRecord } from './types';

export interface BillingCheckoutInput {
  readonly purpose: 'add_payment_method' | 'pay_invoice';
  readonly invoiceId?: string;
  readonly plan?: string;
}

export interface BillingCheckoutResponse {
  readonly url: string;
  readonly configured: boolean;
}

async function startBillingCheckout(input: BillingCheckoutInput): Promise<BillingCheckoutResponse> {
  return apiRequest<BillingCheckoutResponse>('/api/v1/billing/checkout', {
    method: 'POST',
    body: input,
  });
}

export function useBillingCheckout() {
  return useMutation({
    mutationFn: startBillingCheckout,
  });
}

async function fetchPlatformBillingInvoices(): Promise<readonly PlatformInvoiceRecord[]> {
  const { invoices } = await apiRequest<{ invoices: readonly PlatformInvoiceRecord[] }>(
    '/api/platform/org/billing',
  );
  return invoices;
}

export function usePlatformBillingInvoices() {
  return useQuery({ queryKey: queryKeys.platformBilling, queryFn: fetchPlatformBillingInvoices });
}
