import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { apiRequest } from './client';
import { queryKeys } from './keys';
import type {
  OrganizationMemberRecord,
  OrganizationMemberRole,
  OrganizationProfileRecord,
  ParsedAddressResult,
} from './types';

async function fetchOrganizationProfile(): Promise<OrganizationProfileRecord> {
  const { profile } = await apiRequest<{ profile: OrganizationProfileRecord }>('/api/v1/organization');
  return profile;
}

async function fetchOrganizationMembers(): Promise<readonly OrganizationMemberRecord[]> {
  const { members } = await apiRequest<{ members: readonly OrganizationMemberRecord[] }>(
    '/api/v1/organization/members',
  );
  return members;
}

export function useOrganizationProfile() {
  return useQuery({ queryKey: queryKeys.organization.profile, queryFn: fetchOrganizationProfile });
}

export function useOrganizationMembers() {
  return useQuery({ queryKey: queryKeys.organization.members, queryFn: fetchOrganizationMembers });
}

export function useUpdateOrganizationProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Omit<OrganizationProfileRecord, 'organizationId' | 'updatedAt'>>) =>
      apiRequest<{ profile: OrganizationProfileRecord }>('/api/v1/organization', {
        method: 'PATCH',
        body: patch,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.organization.profile });
    },
  });
}

export function useParseAddress() {
  return useMutation({
    mutationFn: (addressLine: string) =>
      apiRequest<{ parsed: ParsedAddressResult }>('/api/v1/organization/parse-address', {
        method: 'POST',
        body: { addressLine },
      }),
  });
}

export interface CreateMemberInput {
  readonly email: string;
  readonly displayName: string;
  readonly role?: Exclude<OrganizationMemberRole, 'owner'>;
  readonly jobTitle?: string;
  readonly phone?: string;
}

export interface UpdateMemberInput {
  readonly displayName?: string;
  readonly role?: Exclude<OrganizationMemberRole, 'owner'>;
  readonly jobTitle?: string | null;
  readonly phone?: string | null;
}

export function useCreateMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMemberInput) =>
      apiRequest<{ member: OrganizationMemberRecord }>('/api/v1/organization/members', {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.organization.members });
    },
  });
}

export function useUpdateMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateMemberInput }) =>
      apiRequest<{ member: OrganizationMemberRecord }>(`/api/v1/organization/members/${id}`, {
        method: 'PATCH',
        body: patch,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.organization.members });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/api/v1/organization/members/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.organization.members });
    },
  });
}

export const MEMBER_ROLE_LABELS_NL: Readonly<Record<OrganizationMemberRole, string>> = {
  owner: 'Eigenaar',
  admin: 'Beheerder',
  jurist: 'Jurist',
};
