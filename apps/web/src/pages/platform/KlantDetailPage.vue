<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { DIGEST_CADENCE_LABELS_NL, formatRecipientNotifySummaryNl } from '@merkwacht/domain';
import ConfirmDialog from '../../components/ConfirmDialog.vue';
import DataTable, { type DataTableColumn } from '../../components/DataTable.vue';
import MwBanner from '../../components/MwBanner.vue';
import MwButton from '../../components/MwButton.vue';
import MwCard from '../../components/MwCard.vue';
import MwEmailInput from '../../components/MwEmailInput.vue';
import MwField from '../../components/MwField.vue';
import MwSelect from '../../components/MwSelect.vue';
import SkeletonBlock from '../../components/SkeletonBlock.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import Tabs, { type TabItem } from '../../components/Tabs.vue';
import {
  useCreatePlatformMember,
  useCreatePlatformRecipient,
  useDeletePlatformRecipient,
  useForceOrganizationSubscription,
  useMarkPlatformInvoicePaid,
  usePlatformOrganization,
  usePlatformOrgThread,
  useRemovePlatformMember,
  useSendPlatformChatMessage,
  useSetPlatformWatchStatus,
  useUpdatePlatformMember,
  useUpdatePlatformOrganizationProfile,
  useUpdatePlatformRecipient,
  useUpdatePlatformWatchSettings,
  type PlatformOrganizationDetail,
} from '../../api/platform-org';
import { formatEuroCents, formatScopeSummary } from '../../api/name-research';
import { invoicePdfUrl, invoiceUblUrl } from '../../api/invoices';
import { formatDate } from '../../lib/format';
import { useToastStore } from '../../stores/toast';
import PlatformPageHeader from './PlatformPageHeader.vue';

const route = useRoute();
const router = useRouter();
const toast = useToastStore();

const orgId = computed(() => String(route.params.orgId ?? ''));
const detailQuery = usePlatformOrganization(() => orgId.value);
const markPaid = useMarkPlatformInvoicePaid();
const forceSub = useForceOrganizationSubscription();
const updateProfile = useUpdatePlatformOrganizationProfile();
const createMember = useCreatePlatformMember();
const updateMember = useUpdatePlatformMember();
const removeMember = useRemovePlatformMember();
const createRecipient = useCreatePlatformRecipient();
const updateRecipient = useUpdatePlatformRecipient();
const deleteRecipient = useDeletePlatformRecipient();
const updateWatchSettings = useUpdatePlatformWatchSettings();
const setWatchStatus = useSetPlatformWatchStatus();
const sendChat = useSendPlatformChatMessage();

const TABS: readonly TabItem[] = [
  { key: 'profiel', label: 'Profiel' },
  { key: 'accounts', label: 'Accounts' },
  { key: 'abonnement', label: 'Abonnement' },
  { key: 'meldingen', label: 'Meldingen' },
  { key: 'merken', label: 'Merken' },
  { key: 'onderzoek', label: 'Merkonderzoek' },
  { key: 'facturen', label: 'Facturen' },
  { key: 'chat', label: 'Chat' },
  { key: 'audit', label: 'Audit' },
];

const activeTab = computed({
  get: () => {
    const tab = String(route.query.tab ?? 'profiel');
    return TABS.some((t) => t.key === tab) ? tab : 'profiel';
  },
  set: (tab: string) => {
    void router.replace({ query: { ...route.query, tab } });
  },
});

const org = computed(() => detailQuery.data.value);
const markPaidTarget = ref<{ id: string; number: string } | null>(null);
const markPaidNote = ref('');
const markPaidError = ref('');

const forceForm = reactive({ plan: 'starter', status: 'active' });
const planOptions = [
  { value: 'basis', label: 'basis' },
  { value: 'starter', label: 'starter' },
  { value: 'pro', label: 'pro' },
  { value: 'enterprise', label: 'enterprise' },
];
const statusOptions = [
  { value: 'active', label: 'active' },
  { value: 'trialing', label: 'trialing' },
  { value: 'past_due', label: 'past_due' },
  { value: 'canceled', label: 'canceled' },
];

const profileForm = reactive({
  legalName: '',
  addressLine: '',
  postalCode: '',
  city: '',
  country: 'NL',
  kvkNumber: '',
  contactEmail: '',
  billingEmail: '',
  phone: '',
});

watch(
  () => org.value?.profile,
  (profile) => {
    if (!profile) return;
    profileForm.legalName = profile.legalName;
    profileForm.addressLine = profile.addressLine;
    profileForm.postalCode = profile.postalCode;
    profileForm.city = profile.city;
    profileForm.country = profile.country;
    profileForm.kvkNumber = profile.kvkNumber;
    profileForm.contactEmail = profile.contactEmail;
    profileForm.billingEmail = profile.billingEmail;
    profileForm.phone = profile.phone;
  },
  { immediate: true },
);

watch(
  () => org.value?.subscription,
  (sub) => {
    if (!sub) return;
    forceForm.plan = sub.plan;
    forceForm.status = sub.status;
  },
  { immediate: true },
);

const profileDirty = computed(() => {
  const current = org.value?.profile;
  if (!current) return false;
  return (
    profileForm.legalName !== current.legalName ||
    profileForm.addressLine !== current.addressLine ||
    profileForm.postalCode !== current.postalCode ||
    profileForm.city !== current.city ||
    profileForm.country !== current.country ||
    profileForm.kvkNumber !== current.kvkNumber ||
    profileForm.contactEmail !== current.contactEmail ||
    profileForm.billingEmail !== current.billingEmail ||
    profileForm.phone !== current.phone
  );
});

function saveProfile(): void {
  updateProfile.mutate(
    { organizationId: orgId.value, patch: { ...profileForm } },
    {
      onSuccess: () => toast.success('Profiel opgeslagen'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Opslaan mislukt'),
    },
  );
}

const showAddMember = ref(false);
const memberForm = reactive({ email: '', displayName: '', role: 'jurist' as 'admin' | 'jurist' });
const removeMemberId = ref<string | null>(null);

function submitAddMember(): void {
  createMember.mutate(
    { organizationId: orgId.value, input: { ...memberForm } },
    {
      onSuccess: () => {
        showAddMember.value = false;
        toast.success('Account toegevoegd');
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Toevoegen mislukt'),
    },
  );
}

function changeMemberRole(memberId: string, role: string): void {
  if (role !== 'admin' && role !== 'jurist') return;
  updateMember.mutate(
    { organizationId: orgId.value, memberId, patch: { role } },
    {
      onSuccess: () => toast.success('Rol bijgewerkt'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Rol wijzigen mislukt'),
    },
  );
}

function confirmRemoveMember(): void {
  if (!removeMemberId.value) return;
  removeMember.mutate(
    { organizationId: orgId.value, memberId: removeMemberId.value },
    {
      onSuccess: () => {
        removeMemberId.value = null;
        toast.success('Account verwijderd');
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Verwijderen mislukt'),
    },
  );
}

const showAddRecipient = ref(false);
const editingRecipientId = ref<string | null>(null);
const recipientForm = reactive({
  email: '',
  mode: 'digest' as 'threshold' | 'digest',
  digestCadence: 'DAILY' as 'DAILY' | 'WEEKLY' | 'MONTHLY',
  minScoreThreshold: 50,
});
const deleteRecipientId = ref<string | null>(null);

function openEditRecipient(r: {
  id: string;
  email: string;
  mode: string;
  digestCadence: string | null;
  minScoreThreshold: number | null;
}): void {
  editingRecipientId.value = r.id;
  recipientForm.email = r.email;
  recipientForm.mode = (r.mode as 'threshold' | 'digest') || 'digest';
  recipientForm.digestCadence = (r.digestCadence as 'DAILY' | 'WEEKLY' | 'MONTHLY') || 'DAILY';
  recipientForm.minScoreThreshold = r.minScoreThreshold ?? 50;
  showAddRecipient.value = true;
}

function submitAddRecipient(): void {
  if (editingRecipientId.value) {
    updateRecipient.mutate(
      {
        organizationId: orgId.value,
        recipientId: editingRecipientId.value,
        patch: {
          mode: recipientForm.mode,
          digestCadence: recipientForm.mode === 'digest' ? recipientForm.digestCadence : null,
          minScoreThreshold: recipientForm.mode === 'threshold' ? recipientForm.minScoreThreshold : null,
        },
      },
      {
        onSuccess: () => {
          showAddRecipient.value = false;
          editingRecipientId.value = null;
          toast.success('Meldingsadres bijgewerkt');
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Bijwerken mislukt'),
      },
    );
    return;
  }
  createRecipient.mutate(
    {
      organizationId: orgId.value,
      input: {
        email: recipientForm.email,
        mode: recipientForm.mode,
        digestCadence: recipientForm.mode === 'digest' ? recipientForm.digestCadence : null,
        minScoreThreshold: recipientForm.mode === 'threshold' ? recipientForm.minScoreThreshold : null,
        allWatches: true,
      },
    },
    {
      onSuccess: () => {
        showAddRecipient.value = false;
        toast.success('Meldingsadres toegevoegd');
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Toevoegen mislukt'),
    },
  );
}

function toggleRecipientActive(id: string, isActive: boolean): void {
  updateRecipient.mutate(
    { organizationId: orgId.value, recipientId: id, patch: { isActive: !isActive } },
    {
      onSuccess: () => toast.success('Status bijgewerkt'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Bijwerken mislukt'),
    },
  );
}

function confirmDeleteRecipient(): void {
  if (!deleteRecipientId.value) return;
  deleteRecipient.mutate(
    { organizationId: orgId.value, recipientId: deleteRecipientId.value },
    {
      onSuccess: () => {
        deleteRecipientId.value = null;
        toast.success('Meldingsadres verwijderd');
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Verwijderen mislukt'),
    },
  );
}

const thresholdDrafts = reactive<Record<string, number>>({});
watch(
  () => org.value?.watchedTrademarks,
  (watches) => {
    if (!watches) return;
    for (const w of watches) {
      thresholdDrafts[w.id] = w.watchSettings?.minScoreThreshold ?? 50;
    }
  },
  { immediate: true },
);

function saveWatchThreshold(watchId: string): void {
  updateWatchSettings.mutate(
    {
      organizationId: orgId.value,
      watchId,
      patch: { minScoreThreshold: thresholdDrafts[watchId] ?? 50 },
    },
    {
      onSuccess: () => toast.success('Drempel opgeslagen'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Opslaan mislukt'),
    },
  );
}

function changeWatchStatus(watchId: string, status: 'active' | 'paused' | 'archived'): void {
  setWatchStatus.mutate(
    { organizationId: orgId.value, watchId, status },
    {
      onSuccess: () => toast.success('Status bijgewerkt'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Status wijzigen mislukt'),
    },
  );
}

const selectedThreadId = ref<string | null>(null);
const chatBody = ref('');
const threadQuery = usePlatformOrgThread(
  () => orgId.value,
  () => selectedThreadId.value,
);

function openThread(id: string): void {
  selectedThreadId.value = id;
}

function sendReply(): void {
  if (!selectedThreadId.value || !chatBody.value.trim()) return;
  sendChat.mutate(
    { threadId: selectedThreadId.value, body: chatBody.value.trim() },
    {
      onSuccess: () => {
        chatBody.value = '';
        void threadQuery.refetch();
        toast.success('Antwoord verzonden');
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Verzenden mislukt'),
    },
  );
}

const invoiceColumns = [
  { key: 'number', label: 'Nummer', width: '9rem' },
  { key: 'status', label: 'Status', width: '8rem' },
  { key: 'exVatCents', label: 'Excl. BTW', width: '8rem', align: 'right' as const },
  { key: 'btwCents', label: 'BTW 21%', width: '8rem', align: 'right' as const },
  { key: 'amountCents', label: 'Incl. BTW', width: '8rem', align: 'right' as const },
  { key: 'description', label: 'Omschrijving' },
  { key: 'internalNote', label: 'Interne notitie' },
  { key: 'actions', label: '', width: '13rem', align: 'right' as const },
];

const memberColumns: readonly DataTableColumn<PlatformOrganizationDetail['members'][number]>[] = [
  { key: 'displayName', label: 'Naam' },
  { key: 'email', label: 'E-mail' },
  { key: 'role', label: 'Rol', width: '10rem' },
  { key: 'actions', label: '', width: '10rem', align: 'right' },
];

function openMarkPaid(invoice: { id: string; number: string }): void {
  markPaidTarget.value = invoice;
  markPaidNote.value = '';
  markPaidError.value = '';
}

function confirmMarkPaid(): void {
  if (!markPaidTarget.value) return;
  const note = markPaidNote.value.trim();
  if (!note) {
    markPaidError.value = 'Interne notitie is verplicht.';
    return;
  }
  markPaid.mutate(
    { organizationId: orgId.value, invoiceId: markPaidTarget.value.id, internalNote: note },
    {
      onSuccess: () => {
        markPaidTarget.value = null;
        toast.success('Factuur gemarkeerd als betaald');
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Markeren mislukt'),
    },
  );
}

function saveForceSubscription(): void {
  forceSub.mutate(
    {
      organizationId: orgId.value,
      patch: { plan: forceForm.plan as 'starter' | 'pro' | 'basis' | 'enterprise', status: forceForm.status },
    },
    {
      onSuccess: () => toast.success('Abonnement bijgewerkt'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Opslaan mislukt'),
    },
  );
}

function formatAmount(cents: number): string {
  return formatEuroCents(cents);
}

const cadenceOptions = Object.entries(DIGEST_CADENCE_LABELS_NL).map(([value, label]) => ({ value, label }));
</script>

<template>
  <PlatformPageHeader
    :title="org?.profile.legalName ?? 'Klantprofiel'"
    description="Bewerkbaar klantprofiel: accounts, abonnement, meldingen, merken, facturen en chat. Elke mutatie wordt geaudit."
  >
    <template #actions>
      <MwButton variant="secondary" @click="router.push({ name: 'platform-klanten' })">Terug naar lijst</MwButton>
    </template>

    <SkeletonBlock v-if="detailQuery.isLoading.value" height="12rem" />
    <MwBanner v-else-if="detailQuery.isError.value" tone="danger" title="Klant kon niet worden geladen" />

    <template v-else-if="org">
      <Tabs v-model="activeTab" :tabs="TABS" />

      <template v-if="activeTab === 'profiel'">
        <MwCard title="Organisatieprofiel">
          <form class="grid gap-3 sm:grid-cols-2" @submit.prevent="saveProfile">
            <MwField label="Naam" for-id="p-name" required>
              <input id="p-name" v-model="profileForm.legalName" class="mw-input" />
            </MwField>
            <MwField label="KVK" for-id="p-kvk">
              <input id="p-kvk" v-model="profileForm.kvkNumber" class="mw-input" />
            </MwField>
            <MwField label="Contact-e-mail" for-id="p-contact">
              <MwEmailInput id="p-contact" v-model="profileForm.contactEmail" />
            </MwField>
            <MwField label="Facturatie-e-mail" for-id="p-billing">
              <MwEmailInput id="p-billing" v-model="profileForm.billingEmail" />
            </MwField>
            <MwField label="Telefoon" for-id="p-phone">
              <input id="p-phone" v-model="profileForm.phone" class="mw-input" />
            </MwField>
            <MwField label="Land" for-id="p-country">
              <input id="p-country" v-model="profileForm.country" class="mw-input" maxlength="2" />
            </MwField>
            <MwField label="Adres" for-id="p-address" class="sm:col-span-2">
              <input id="p-address" v-model="profileForm.addressLine" class="mw-input" />
            </MwField>
            <MwField label="Postcode" for-id="p-postal">
              <input id="p-postal" v-model="profileForm.postalCode" class="mw-input" />
            </MwField>
            <MwField label="Plaats" for-id="p-city">
              <input id="p-city" v-model="profileForm.city" class="mw-input" />
            </MwField>
            <div class="sm:col-span-2">
              <MwButton
                type="submit"
                variant="primary"
                :disabled="!profileDirty"
                :loading="updateProfile.isPending.value"
              >
                Profiel opslaan
              </MwButton>
            </div>
          </form>
        </MwCard>
      </template>

      <template v-else-if="activeTab === 'accounts'">
        <MwCard title="Accounts">
          <template #actions>
            <MwButton variant="primary" size="sm" @click="showAddMember = true">Toevoegen</MwButton>
          </template>
          <DataTable
            embedded
            :columns="memberColumns"
            :rows="org.members"
            :row-key="(row) => row.id"
            empty-title="Geen accounts"
            empty-description="Nog geen gebruikers voor deze organisatie."
          >
            <template #cell-role="{ row }">
              <MwSelect
                v-if="row.role !== 'owner'"
                :model-value="row.role"
                :options="[
                  { value: 'admin', label: 'admin' },
                  { value: 'jurist', label: 'jurist' },
                ]"
                @update:model-value="(v) => changeMemberRole(row.id, v)"
              />
              <StatusBadge v-else :label="row.role" tone="neutral" />
            </template>
            <template #cell-actions="{ row }">
              <MwButton
                v-if="row.role !== 'owner'"
                variant="danger"
                size="sm"
                @click="removeMemberId = row.id"
              >
                Verwijder
              </MwButton>
            </template>
          </DataTable>
        </MwCard>
      </template>

      <template v-else-if="activeTab === 'abonnement'">
        <MwCard title="Abonnement van deze klant">
          <p class="text-sm text-text">
            Plan: <span class="font-semibold capitalize">{{ org.subscription.plan }}</span>
            · Status: {{ org.subscription.status }}
          </p>
          <p class="mt-1 text-xs text-text-muted">
            Limiet merken: {{ org.entitlements.maxWatchedTrademarks }} · Actief:
            {{ org.watchedTrademarks.filter((w) => w.status === 'active').length }}
          </p>
          <form class="mt-4 grid gap-3 sm:grid-cols-3" @submit.prevent="saveForceSubscription">
            <MwField label="Plan forceren" for-id="force-plan">
              <MwSelect id="force-plan" v-model="forceForm.plan" :options="planOptions" />
            </MwField>
            <MwField label="Status" for-id="force-status">
              <MwSelect id="force-status" v-model="forceForm.status" :options="statusOptions" />
            </MwField>
            <div class="flex items-end">
              <MwButton type="submit" variant="primary" :loading="forceSub.isPending.value">Opslaan</MwButton>
            </div>
          </form>
        </MwCard>
      </template>

      <template v-else-if="activeTab === 'meldingen'">
        <MwCard title="Meldingsadressen">
          <template #actions>
            <MwButton
              variant="primary"
              size="sm"
              @click="
                editingRecipientId = null;
                recipientForm.email = '';
                showAddRecipient = true;
              "
            >
              Toevoegen
            </MwButton>
          </template>
          <ul v-if="org.recipients.length" class="divide-y divide-border">
            <li
              v-for="r in org.recipients"
              :key="r.id"
              class="flex items-start justify-between gap-2 py-2.5 text-sm"
            >
              <span>
                <span class="font-medium text-text">{{ r.email }}</span>
                <span class="mt-0.5 block text-xs text-text-muted">
                  {{
                    formatRecipientNotifySummaryNl({
                      mode: r.mode as 'threshold' | 'digest',
                      digestCadence: r.digestCadence as 'DAILY' | 'WEEKLY' | 'MONTHLY' | null,
                      minScoreThreshold: r.minScoreThreshold,
                    })
                  }}
                </span>
              </span>
              <div class="flex items-center gap-2">
                <MwButton variant="secondary" size="sm" @click="openEditRecipient(r)">Bewerken</MwButton>
                <MwButton variant="secondary" size="sm" @click="toggleRecipientActive(r.id, r.isActive)">
                  {{ r.isActive ? 'Deactiveren' : 'Activeren' }}
                </MwButton>
                <MwButton variant="danger" size="sm" @click="deleteRecipientId = r.id">Verwijder</MwButton>
              </div>
            </li>
          </ul>
          <p v-else class="text-sm text-text-muted">Geen meldingsadressen.</p>
        </MwCard>
      </template>

      <template v-else-if="activeTab === 'merken'">
        <MwCard title="Bewaakte merken — bescherming, drempel en status">
          <ul v-if="org.watchedTrademarks.length" class="divide-y divide-border">
            <li
              v-for="w in org.watchedTrademarks"
              :key="w.id"
              class="grid gap-3 py-3 sm:grid-cols-[minmax(0,1.4fr)_8rem_auto]"
            >
              <span class="text-sm">
                <span class="font-medium text-text">{{ w.label }}</span>
                <span class="block text-xs text-text-muted">
                  {{ w.registryCode }} · {{ w.markText }}
                </span>
                <span class="mt-1 block text-xs text-text-muted">
                  Bescherming:
                  {{
                    w.status === 'active' && w.eligibility?.eligible
                      ? 'actief (afhankelijk van register-status)'
                      : w.status === 'paused'
                        ? 'Gepauzeerd — niet bewaakt'
                        : 'Niet beschermd'
                  }}
                </span>
              </span>
              <div>
                <p class="text-xs text-text-muted">Drempel %</p>
                <input
                  v-model.number="thresholdDrafts[w.id]"
                  type="number"
                  min="0"
                  max="100"
                  class="mw-input w-20"
                  aria-label="Drempel"
                />
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <MwButton variant="secondary" size="sm" @click="saveWatchThreshold(w.id)">Opslaan</MwButton>
                <MwSelect
                  :model-value="w.status"
                  :options="[
                    { value: 'active', label: 'Actief' },
                    { value: 'paused', label: 'Gepauzeerd' },
                    { value: 'archived', label: 'Archief' },
                  ]"
                  @update:model-value="(v) => changeWatchStatus(w.id, v as 'active' | 'paused' | 'archived')"
                />
              </div>
            </li>
          </ul>
            </li>
          </ul>
          <p v-else class="text-sm text-text-muted">Geen bewaakte merken.</p>
          <p class="mt-3 text-xs text-text-muted">Matches: {{ org.matchCount }}</p>
        </MwCard>
      </template>

      <template v-else-if="activeTab === 'onderzoek'">
        <MwCard title="Merkonderzoek-rapporten">
          <ul v-if="org.nameResearchOrders.length" class="divide-y divide-border">
            <li
              v-for="order in org.nameResearchOrders"
              :key="order.id"
              class="flex items-center justify-between gap-2 py-2 text-sm"
            >
              <span>
                <span class="font-medium">{{ order.markText }}</span>
                <span class="block text-xs text-text-muted">
                  {{ formatScopeSummary(order.scopes) }} · {{ order.status }}
                </span>
              </span>
              <StatusBadge :label="formatAmount(order.priceCents)" tone="neutral" />
            </li>
          </ul>
          <p v-else class="text-sm text-text-muted">Nog geen merkonderzoek-orders voor deze klant.</p>
        </MwCard>
      </template>

      <template v-else-if="activeTab === 'facturen'">
        <MwCard :padding="false" title="Facturen">
          <DataTable
            embedded
            :columns="invoiceColumns"
            :rows="org.invoices"
            :row-key="(row) => row.id"
            empty-title="Geen facturen"
            empty-description="Deze organisatie heeft nog geen facturen."
          >
            <template #cell-status="{ row }">
              <StatusBadge
                :label="row.status"
                :tone="row.status === 'paid' ? 'success' : row.status === 'open' ? 'warning' : 'neutral'"
              />
            </template>
            <template #cell-exVatCents="{ row }">{{ formatAmount(row.exVatCents ?? 0) }}</template>
            <template #cell-btwCents="{ row }">{{ formatAmount(row.btwCents ?? 0) }}</template>
            <template #cell-amountCents="{ row }">{{ formatAmount(row.amountCents) }}</template>
            <template #cell-internalNote="{ row }">
              <span class="text-xs text-text-muted">{{ row.internalNote || '—' }}</span>
            </template>
            <template #cell-actions="{ row }">
              <div class="flex justify-end gap-2">
                <MwButton
                  v-if="row.status === 'open'"
                  variant="primary"
                  size="sm"
                  @click="openMarkPaid(row)"
                >
                  Markeer betaald
                </MwButton>
                <a
                  v-if="row.pdfAvailable"
                  :href="invoicePdfUrl(row.id)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center justify-center rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text shadow-sm transition-colors hover:bg-surface-muted"
                >
                  PDF
                </a>
                <a
                  v-if="row.ublXmlAvailable"
                  :href="invoiceUblUrl(row.id)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center justify-center rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text shadow-sm transition-colors hover:bg-surface-muted"
                >
                  UBL
                </a>
              </div>
            </template>
          </DataTable>
        </MwCard>
      </template>

      <template v-else-if="activeTab === 'chat'">
        <div class="grid gap-4 lg:grid-cols-2">
          <MwCard title="Threads">
            <ul v-if="org.threads.length" class="divide-y divide-border">
              <li v-for="t in org.threads" :key="t.id">
                <button
                  type="button"
                  class="w-full py-2 text-left text-sm hover:bg-surface-muted/50"
                  :class="selectedThreadId === t.id && 'bg-accent-soft/30'"
                  @click="openThread(t.id)"
                >
                  <span class="font-medium text-text">{{ t.subject }}</span>
                  <span class="block text-xs text-text-muted">{{ t.status }} · {{ formatDate(t.updatedAt) }}</span>
                </button>
              </li>
            </ul>
            <p v-else class="text-sm text-text-muted">Geen chatthreads voor deze klant.</p>
          </MwCard>
          <MwCard title="Gesprek">
            <template v-if="selectedThreadId && threadQuery.data.value">
              <ul class="mb-3 max-h-64 space-y-2 overflow-y-auto text-sm">
                <li
                  v-for="m in threadQuery.data.value.messages"
                  :key="m.id"
                  class="rounded-md border border-border px-2 py-1.5"
                >
                  {{ m.body }}
                  <span class="mt-0.5 block text-[10px] text-text-muted">{{ formatDate(m.createdAt) }}</span>
                </li>
              </ul>
              <form class="flex gap-2" @submit.prevent="sendReply">
                <input v-model="chatBody" class="mw-input flex-1" placeholder="Antwoord als Merkwacht Support…" />
                <MwButton type="submit" variant="primary" :loading="sendChat.isPending.value">Stuur</MwButton>
              </form>
            </template>
            <p v-else class="text-sm text-text-muted">Selecteer een thread om te beantwoorden.</p>
          </MwCard>
        </div>
      </template>

      <template v-else-if="activeTab === 'audit'">
        <MwCard title="Audit-snippet">
          <ul v-if="org.auditSnippet.length" class="divide-y divide-border">
            <li v-for="entry in org.auditSnippet" :key="entry.id" class="py-2 text-sm">
              <span class="font-medium text-text">{{ entry.action }}</span>
              <span class="block text-xs text-text-muted">{{ formatDate(entry.occurredAt) }}</span>
            </li>
          </ul>
          <p v-else class="text-sm text-text-muted">Nog geen auditregels voor deze klant.</p>
        </MwCard>
      </template>
    </template>

    <ConfirmDialog
      :open="markPaidTarget !== null"
      title="Factuur markeren als betaald"
      confirm-label="Markeer betaald"
      :busy="markPaid.isPending.value"
      @confirm="confirmMarkPaid"
      @cancel="markPaidTarget = null"
    >
      <p class="mb-3 text-sm text-text-muted">
        Factuur {{ markPaidTarget?.number }} — de interne notitie is verplicht en blijft verborgen voor de klant.
      </p>
      <MwField label="Interne notitie" for-id="paid-note" required :error="markPaidError">
        <textarea
          id="paid-note"
          v-model="markPaidNote"
          rows="3"
          class="mw-input w-full"
          @input="markPaidError = ''"
        />
      </MwField>
    </ConfirmDialog>

    <ConfirmDialog
      :open="showAddMember"
      title="Account toevoegen"
      confirm-label="Toevoegen"
      :busy="createMember.isPending.value"
      @confirm="submitAddMember"
      @cancel="showAddMember = false"
    >
      <div class="grid gap-3">
        <MwField label="Naam" for-id="m-name" required>
          <input id="m-name" v-model="memberForm.displayName" class="mw-input" />
        </MwField>
        <MwField label="E-mail" for-id="m-email" required>
          <MwEmailInput id="m-email" v-model="memberForm.email" />
        </MwField>
        <MwField label="Rol" for-id="m-role">
          <MwSelect
            id="m-role"
            v-model="memberForm.role"
            :options="[
              { value: 'admin', label: 'admin' },
              { value: 'jurist', label: 'jurist' },
            ]"
          />
        </MwField>
      </div>
    </ConfirmDialog>

    <ConfirmDialog
      :open="removeMemberId !== null"
      title="Account verwijderen?"
      confirm-label="Verwijder"
      tone="danger"
      :busy="removeMember.isPending.value"
      @confirm="confirmRemoveMember"
      @cancel="removeMemberId = null"
    />

    <ConfirmDialog
      :open="showAddRecipient"
      :title="editingRecipientId ? 'Meldingsadres bewerken' : 'Meldingsadres toevoegen'"
      :confirm-label="editingRecipientId ? 'Opslaan' : 'Toevoegen'"
      :busy="createRecipient.isPending.value || updateRecipient.isPending.value"
      @confirm="submitAddRecipient"
      @cancel="
        showAddRecipient = false;
        editingRecipientId = null;
      "
    >
      <div class="grid gap-3">
        <MwField label="E-mail" for-id="r-email" required>
          <MwEmailInput id="r-email" v-model="recipientForm.email" :disabled="Boolean(editingRecipientId)" />
        </MwField>
        <MwField label="Modus" for-id="r-mode">
          <MwSelect
            id="r-mode"
            v-model="recipientForm.mode"
            :options="[
              { value: 'digest', label: 'Digest' },
              { value: 'threshold', label: 'Drempel' },
            ]"
          />
        </MwField>
        <MwField v-if="recipientForm.mode === 'digest'" label="Frequentie" for-id="r-cadence">
          <MwSelect id="r-cadence" v-model="recipientForm.digestCadence" :options="cadenceOptions" />
        </MwField>
        <MwField v-else label="Minimale score %" for-id="r-thr">
          <input
            id="r-thr"
            v-model.number="recipientForm.minScoreThreshold"
            type="number"
            min="0"
            max="100"
            class="mw-input"
          />
        </MwField>
      </div>
    </ConfirmDialog>

    <ConfirmDialog
      :open="deleteRecipientId !== null"
      title="Meldingsadres verwijderen?"
      confirm-label="Verwijder"
      tone="danger"
      :busy="deleteRecipient.isPending.value"
      @confirm="confirmDeleteRecipient"
      @cancel="deleteRecipientId = null"
    />
  </PlatformPageHeader>
</template>

<style scoped>
.mw-input {
  width: 100%;
  border-radius: 0.375rem;
  border: 1px solid var(--color-border, #e5e7eb);
  background: var(--color-surface, #fff);
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
}
</style>
