import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { API_BASE_URL, apiRequest } from './client';
import { queryKeys } from './keys';
import type { InvoiceRecord } from './types';

async function fetchInvoices(): Promise<readonly InvoiceRecord[]> {
  const { invoices } = await apiRequest<{ invoices: readonly InvoiceRecord[] }>('/api/v1/invoices');
  return invoices;
}

export function useInvoices() {
  return useQuery({ queryKey: queryKeys.invoices, queryFn: fetchInvoices });
}

export function useInvoiceCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ invoice: InvoiceRecord; checkoutStatus: string }>(`/api/v1/invoices/${id}/checkout`, {
        method: 'POST',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.invoices });
    },
  });
}

export function invoicePdfUrl(id: string): string {
  return `${API_BASE_URL}/api/v1/invoices/${id}/pdf`;
}

export function invoiceUblUrl(id: string): string {
  return `${API_BASE_URL}/api/v1/invoices/${id}/ubl`;
}

export const INVOICE_STATUS_LABELS_NL = {
  draft: 'Concept',
  open: 'Open',
  paid: 'Betaald',
  void: 'Geannuleerd',
} as const satisfies Record<InvoiceRecord['status'], string>;
