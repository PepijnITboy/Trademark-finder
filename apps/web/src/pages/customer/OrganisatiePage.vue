<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { DigestFrequency } from '@merkwacht/validation';
import ConfirmDialog from '../../components/ConfirmDialog.vue';
import DataTable, { type DataTableColumn } from '../../components/DataTable.vue';
import MwBanner from '../../components/MwBanner.vue';
import MwButton from '../../components/MwButton.vue';
import MwCard from '../../components/MwCard.vue';
import MwEmailInput from '../../components/MwEmailInput.vue';
import MwField from '../../components/MwField.vue';
import MwPage from '../../components/MwPage.vue';
import MwPhoneInput from '../../components/MwPhoneInput.vue';
import MwSelect from '../../components/MwSelect.vue';
import SkeletonBlock from '../../components/SkeletonBlock.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import Tabs, { type TabItem } from '../../components/Tabs.vue';
import {
  MEMBER_ROLE_LABELS_NL,
  useCreateMember,
  useOrganizationMembers,
  useOrganizationProfile,
  useParseAddress,
  useRemoveMember,
  useUpdateMember,
  useUpdateOrganizationProfile,
} from '../../api/organization';
import {
  useCreateNotificationRecipient,
  useDeleteNotificationRecipient,
  useNotificationRecipients,
} from '../../api/notification-recipients';
import { useSettings, useUpdateSettings } from '../../api/settings';
import type { NotificationRecipientRecord, OrganizationMemberRecord } from '../../api/types';
import { useWatchedTrademarks } from '../../api/watched-trademarks';
import { useThemeStore, type ThemeMode } from '../../stores/theme';
import { useToastStore } from '../../stores/toast';

const VALID_TABS = ['bedrijf', 'gebruikers', 'weergave', 'meldingen', 'taal'] as const;
type OrgTab = (typeof VALID_TABS)[number];

const TABS: readonly TabItem[] = [
  { key: 'bedrijf', label: 'Bedrijf' },
  { key: 'gebruikers', label: 'Gebruikers' },
  { key: 'weergave', label: 'Weergave' },
  { key: 'meldingen', label: 'Meldingen' },
  { key: 'taal', label: 'Taal' },
];

const route = useRoute();
const router = useRouter();
const toast = useToastStore();
const themeStore = useThemeStore();

const activeTab = computed<OrgTab>({
  get() {
    const tab = String(route.query.tab ?? 'bedrijf');
    return VALID_TABS.includes(tab as OrgTab) ? (tab as OrgTab) : 'bedrijf';
  },
  set(tab) {
    void router.replace({ query: { ...route.query, tab } });
  },
});

const profileQuery = useOrganizationProfile();
const updateProfile = useUpdateOrganizationProfile();
const parseAddress = useParseAddress();

const membersQuery = useOrganizationMembers();
const createMember = useCreateMember();
const updateMember = useUpdateMember();
const removeMember = useRemoveMember();

const recipientsQuery = useNotificationRecipients();
const createRecipient = useCreateNotificationRecipient();
const deleteRecipient = useDeleteNotificationRecipient();

const watchedQuery = useWatchedTrademarks();
const activeWatches = computed(() => (watchedQuery.data.value ?? []).filter((w) => w.status === 'active'));

const settingsQuery = useSettings();
const updateSettings = useUpdateSettings();

const profileForm = reactive({
  legalName: '',
  addressLine: '',
  postalCode: '',
  city: '',
  country: 'NL',
  kvkNumber: '',
  billingEmail: '',
  contactEmail: '',
  phone: '',
});

watch(
  profileQuery.data,
  (profile) => {
    if (!profile) return;
    profileForm.legalName = profile.legalName;
    profileForm.addressLine = profile.addressLine;
    profileForm.postalCode = profile.postalCode;
    profileForm.city = profile.city;
    profileForm.country = profile.country;
    profileForm.kvkNumber = profile.kvkNumber;
    profileForm.billingEmail = profile.billingEmail;
    profileForm.contactEmail = profile.contactEmail ?? '';
    profileForm.phone = profile.phone;
  },
  { immediate: true },
);

const profileDirty = computed(() => {
  const current = profileQuery.data.value;
  if (!current) return false;
  return (
    profileForm.legalName !== current.legalName ||
    profileForm.addressLine !== current.addressLine ||
    profileForm.postalCode !== current.postalCode ||
    profileForm.city !== current.city ||
    profileForm.country !== current.country ||
    profileForm.kvkNumber !== current.kvkNumber ||
    profileForm.billingEmail !== current.billingEmail ||
    profileForm.contactEmail !== (current.contactEmail ?? '') ||
    profileForm.phone !== current.phone
  );
});

function saveProfile(): void {
  updateProfile.mutate(
    { ...profileForm },
    {
      onSuccess: () => toast.success('Bedrijfsgegevens opgeslagen'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Opslaan mislukt'),
    },
  );
}

function parseAddressLine(): void {
  if (!profileForm.addressLine.trim()) return;
  parseAddress.mutate(profileForm.addressLine, {
    onSuccess: ({ parsed }) => {
      profileForm.addressLine = parsed.addressLine;
      profileForm.postalCode = parsed.postalCode;
      profileForm.city = parsed.city;
      profileForm.country = parsed.country;
      toast.success('Adres herkend');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Adres kon niet worden herkend'),
  });
}

const memberColumns: readonly DataTableColumn<OrganizationMemberRecord>[] = [
  { key: 'displayName', label: 'Naam' },
  { key: 'email', label: 'E-mail' },
  { key: 'role', label: 'Rol', width: '10rem' },
  { key: 'actions', label: '', width: '12rem', align: 'right' },
];

const showAddMember = ref(false);
const memberForm = reactive({ email: '', displayName: '', role: 'jurist' as 'admin' | 'jurist' });
const removeMemberTarget = ref<OrganizationMemberRecord | null>(null);

function openAddMember(): void {
  memberForm.email = '';
  memberForm.displayName = '';
  memberForm.role = 'jurist';
  showAddMember.value = true;
}

function submitAddMember(): void {
  createMember.mutate(
    { ...memberForm },
    {
      onSuccess: () => {
        showAddMember.value = false;
        toast.success('Gebruiker toegevoegd');
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Toevoegen mislukt'),
    },
  );
}

function changeMemberRole(member: OrganizationMemberRecord, role: 'admin' | 'jurist'): void {
  if (member.role === 'owner' || member.role === role) return;
  updateMember.mutate(
    { id: member.id, patch: { role } },
    {
      onSuccess: () => toast.success('Rol bijgewerkt'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Rol wijzigen mislukt'),
    },
  );
}

function confirmRemoveMember(): void {
  if (!removeMemberTarget.value) return;
  removeMember.mutate(removeMemberTarget.value.id, {
    onSuccess: () => {
      removeMemberTarget.value = null;
      toast.success('Gebruiker verwijderd');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Verwijderen mislukt'),
  });
}

const THEME_OPTIONS: ReadonlyArray<{ value: ThemeMode; label: string; description: string }> = [
  { value: 'light', label: 'Licht', description: 'Lichte achtergrond en donkere tekst.' },
  { value: 'dark', label: 'Donker', description: 'Donkere achtergrond voor weinig licht.' },
  { value: 'system', label: 'Systeem', description: 'Volgt de instelling van uw apparaat.' },
];

function setTheme(mode: ThemeMode): void {
  themeStore.setMode(mode);
}

const recipientColumns: readonly DataTableColumn<NotificationRecipientRecord>[] = [
  { key: 'email', label: 'E-mail' },
  { key: 'digestFrequency', label: 'Frequentie', width: '10rem' },
  { key: 'minScoreThreshold', label: 'Vanaf score', width: '8rem' },
  { key: 'watches', label: 'Merken', width: '8rem' },
  { key: 'actions', label: '', width: '8rem', align: 'right' },
];

const showAddRecipient = ref(false);
const recipientForm = reactive({
  email: '',
  digestFrequency: 'DAILY' as DigestFrequency,
  minScoreThreshold: 50,
  watchesExpanded: true,
  selectedWatchIds: [] as string[],
});

const DIGEST_LABELS_NL: Record<DigestFrequency, string> = {
  DAILY: 'Dagelijks',
  WEEKLY: 'Wekelijks',
};

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Beheerder' },
  { value: 'jurist', label: 'Jurist' },
] as const;

const LOCALE_OPTIONS = [
  { value: 'nl-NL', label: 'Nederlands' },
  { value: 'en-US', label: 'Engels' },
] as const;

const DIGEST_OPTIONS = Object.entries(DIGEST_LABELS_NL).map(([value, label]) => ({
  value,
  label,
}));

function openAddRecipient(): void {
  recipientForm.email = '';
  recipientForm.digestFrequency = 'DAILY';
  recipientForm.minScoreThreshold = 50;
  recipientForm.watchesExpanded = true;
  recipientForm.selectedWatchIds = activeWatches.value.map((w) => w.id);
  showAddRecipient.value = true;
}

watch(activeWatches, (watches) => {
  if (showAddRecipient.value && recipientForm.selectedWatchIds.length === 0) {
    recipientForm.selectedWatchIds = watches.map((w) => w.id);
  }
});

function toggleWatchSelection(id: string): void {
  const idx = recipientForm.selectedWatchIds.indexOf(id);
  if (idx >= 0) recipientForm.selectedWatchIds.splice(idx, 1);
  else recipientForm.selectedWatchIds.push(id);
}

function submitAddRecipient(): void {
  const allSelected =
    activeWatches.value.length > 0 &&
    recipientForm.selectedWatchIds.length === activeWatches.value.length;
  createRecipient.mutate(
    {
      email: recipientForm.email,
      digestFrequency: recipientForm.digestFrequency,
      minScoreThreshold: recipientForm.minScoreThreshold,
      allWatches: allSelected,
      watchedTrademarkIds: allSelected ? undefined : [...recipientForm.selectedWatchIds],
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

const removeRecipientTarget = ref<NotificationRecipientRecord | null>(null);

function confirmRemoveRecipient(): void {
  if (!removeRecipientTarget.value) return;
  deleteRecipient.mutate(removeRecipientTarget.value.id, {
    onSuccess: () => {
      removeRecipientTarget.value = null;
      toast.success('Meldingsadres verwijderd');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Verwijderen mislukt'),
  });
}

const localeForm = reactive({ locale: 'nl-NL', timezone: 'Europe/Amsterdam' });

watch(
  settingsQuery.data,
  (settings) => {
    if (!settings) return;
    localeForm.locale = settings.locale;
    localeForm.timezone = settings.timezone;
  },
  { immediate: true },
);

const localeDirty = computed(() => {
  const current = settingsQuery.data.value;
  if (!current) return false;
  return localeForm.locale !== current.locale || localeForm.timezone !== current.timezone;
});

function saveLocale(): void {
  updateSettings.mutate(
    { locale: localeForm.locale, timezone: localeForm.timezone },
    {
      onSuccess: () => toast.success('Taal en tijdzone opgeslagen'),
      onError: () => toast.error('Opslaan is mislukt'),
    },
  );
}
</script>

<template>
  <MwPage
    title="Organisatie en gebruikers"
    description="Beheer bedrijfsgegevens, gebruikers, weergave, meldingen en taalinstellingen."
  >
    <Tabs v-model="activeTab" :tabs="TABS" />

    <!-- Bedrijf -->
    <template v-if="activeTab === 'bedrijf'">
      <SkeletonBlock v-if="profileQuery.isLoading.value" height="20rem" />
      <MwBanner v-else-if="profileQuery.isError.value" tone="danger" title="Gegevens konden niet worden geladen">
        Probeer de pagina te verversen.
      </MwBanner>
      <form v-else @submit.prevent="saveProfile">
        <MwCard title="Bedrijfsgegevens">
          <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <MwField label="Juridische naam" for-id="legal-name" required>
              <input
                id="legal-name"
                v-model="profileForm.legalName"
                type="text"
                required
                class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
            </MwField>
            <div class="sm:col-span-2">
            <MwField label="Adres" for-id="address-line">
              <div class="flex gap-2">
                <input
                  id="address-line"
                  v-model="profileForm.addressLine"
                  type="text"
                  class="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                />
                <MwButton
                  type="button"
                  variant="secondary"
                  :loading="parseAddress.isPending.value"
                  @click="parseAddressLine"
                >
                  Herken
                </MwButton>
              </div>
            </MwField>
            </div>
            <MwField label="Postcode" for-id="postal-code">
              <input
                id="postal-code"
                v-model="profileForm.postalCode"
                type="text"
                class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
            </MwField>
            <MwField label="Plaats" for-id="city">
              <input
                id="city"
                v-model="profileForm.city"
                type="text"
                class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
            </MwField>
            <MwField label="Land (ISO)" for-id="country">
              <input
                id="country"
                v-model="profileForm.country"
                type="text"
                maxlength="2"
                class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
            </MwField>
            <MwField label="KVK-nummer" for-id="kvk">
              <input
                id="kvk"
                v-model="profileForm.kvkNumber"
                type="text"
                maxlength="8"
                class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
            </MwField>
            <MwField label="Facturatie-e-mail" for-id="billing-email">
              <MwEmailInput id="billing-email" v-model="profileForm.billingEmail" />
            </MwField>
            <MwField label="Contact-e-mail" for-id="contact-email">
              <MwEmailInput id="contact-email" v-model="profileForm.contactEmail" />
            </MwField>
            <MwField label="Telefoon" for-id="phone">
              <MwPhoneInput id="phone" v-model="profileForm.phone" />
            </MwField>
          </div>
          <template #footer>
            <MwButton type="submit" variant="primary" :disabled="!profileDirty" :loading="updateProfile.isPending.value">
              Wijzigingen opslaan
            </MwButton>
          </template>
        </MwCard>
      </form>
    </template>

    <!-- Gebruikers -->
    <template v-else-if="activeTab === 'gebruikers'">
      <MwCard :padding="false">
        <template #header>
          <div class="flex items-center justify-between gap-4 px-5 py-4">
            <h2 class="text-base font-semibold text-text">Gebruikers</h2>
            <MwButton variant="primary" size="sm" @click="openAddMember">Gebruiker toevoegen</MwButton>
          </div>
        </template>
        <DataTable
          embedded
          :columns="memberColumns"
          :rows="membersQuery.data.value ?? []"
          :row-key="(row) => row.id"
          :loading="membersQuery.isLoading.value"
          empty-title="Nog geen gebruikers"
          empty-description="Voeg een collega toe met een e-mailadres en rol."
        >
          <template #cell-displayName="{ row }">
            <span class="font-medium">{{ row.displayName }}</span>
          </template>
          <template #cell-role="{ row }">
            <StatusBadge :label="MEMBER_ROLE_LABELS_NL[row.role]" :tone="row.role === 'owner' ? 'accent' : 'neutral'" />
          </template>
          <template #cell-actions="{ row }">
            <div v-if="row.role !== 'owner'" class="flex justify-end gap-2">
              <select
                :value="row.role"
                class="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
                @change="changeMemberRole(row, ($event.target as HTMLSelectElement).value as 'admin' | 'jurist')"
              >
                <option value="admin">Beheerder</option>
                <option value="jurist">Jurist</option>
              </select>
              <MwButton variant="tertiary" size="sm" @click="removeMemberTarget = row">Verwijderen</MwButton>
            </div>
          </template>
        </DataTable>
      </MwCard>
    </template>

    <!-- Weergave -->
    <template v-else-if="activeTab === 'weergave'">
      <MwCard title="Weergave">
        <p class="mb-4 text-sm text-text-muted">Kies hoe Merkwacht eruitziet op dit apparaat.</p>
        <div class="grid gap-2" role="radiogroup" aria-label="Weergave">
          <label
            v-for="option in THEME_OPTIONS"
            :key="option.value"
            class="flex cursor-pointer items-start gap-3 rounded-md border border-border px-4 py-3 transition-colors hover:bg-surface-muted/60"
            :class="themeStore.mode === option.value && 'border-accent bg-accent-soft/40'"
          >
            <input
              class="mt-1 h-4 w-4 accent-[var(--mw-color-accent-strong)]"
              type="radio"
              name="theme-mode"
              :value="option.value"
              :aria-label="option.label"
              :checked="themeStore.mode === option.value"
              @change="setTheme(option.value)"
            />
            <span class="min-w-0">
              <span class="block text-sm font-medium text-text">{{ option.label }}</span>
              <span class="mt-0.5 block text-sm text-text-muted">{{ option.description }}</span>
            </span>
          </label>
        </div>
      </MwCard>
    </template>

    <!-- Meldingen -->
    <template v-else-if="activeTab === 'meldingen'">
      <MwCard :padding="false">
        <template #header>
          <div class="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <h2 class="text-base font-semibold text-text">Meldingsadressen</h2>
              <p class="mt-0.5 text-sm text-text-muted">E-mailadressen die samenvattingen ontvangen per bewaakt merk.</p>
            </div>
            <MwButton variant="primary" size="sm" @click="openAddRecipient">Adres toevoegen</MwButton>
          </div>
        </template>
        <DataTable
          embedded
          :columns="recipientColumns"
          :rows="recipientsQuery.data.value ?? []"
          :row-key="(row) => row.id"
          :loading="recipientsQuery.isLoading.value"
          empty-title="Nog geen meldingsadressen"
          empty-description="Voeg een e-mailadres toe om meldingen te ontvangen."
        >
          <template #cell-digestFrequency="{ row }">{{ DIGEST_LABELS_NL[row.digestFrequency] }}</template>
          <template #cell-minScoreThreshold="{ row }">{{ row.minScoreThreshold }}%</template>
          <template #cell-watches="{ row }">{{ row.watchedTrademarkIds.length }}</template>
          <template #cell-actions="{ row }">
            <div class="flex justify-end">
              <MwButton variant="tertiary" size="sm" @click="removeRecipientTarget = row">Verwijderen</MwButton>
            </div>
          </template>
        </DataTable>
      </MwCard>
    </template>

    <!-- Taal -->
    <template v-else-if="activeTab === 'taal'">
      <SkeletonBlock v-if="settingsQuery.isLoading.value" height="10rem" />
      <form v-else @submit.prevent="saveLocale">
        <MwCard title="Taal en tijdzone">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MwField label="Taal" for-id="locale">
              <MwSelect id="locale" v-model="localeForm.locale" :options="LOCALE_OPTIONS" />
            </MwField>
            <MwField label="Tijdzone" for-id="timezone" hint="Bijvoorbeeld Europe/Amsterdam">
              <input
                id="timezone"
                v-model="localeForm.timezone"
                type="text"
                class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
            </MwField>
          </div>
          <template #footer>
            <MwButton type="submit" variant="primary" :disabled="!localeDirty" :loading="updateSettings.isPending.value">
              Wijzigingen opslaan
            </MwButton>
          </template>
        </MwCard>
      </form>
    </template>

    <!-- Add member dialog -->
    <ConfirmDialog
      :open="showAddMember"
      title="Gebruiker toevoegen"
      confirm-label="Toevoegen"
      :busy="createMember.isPending.value"
      @confirm="submitAddMember"
      @cancel="showAddMember = false"
    >
      <div class="space-y-4">
        <MwField label="E-mail" for-id="member-email" required>
          <input
            id="member-email"
            v-model="memberForm.email"
            type="email"
            required
            class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
        </MwField>
        <MwField label="Naam" for-id="member-name" required>
          <input
            id="member-name"
            v-model="memberForm.displayName"
            type="text"
            required
            class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
        </MwField>
        <MwField label="Rol" for-id="member-role">
          <MwSelect id="member-role" v-model="memberForm.role" :options="ROLE_OPTIONS" />
        </MwField>
      </div>
    </ConfirmDialog>

    <ConfirmDialog
      :open="removeMemberTarget !== null"
      title="Gebruiker verwijderen"
      :description="removeMemberTarget ? `${removeMemberTarget.displayName} verliest toegang tot Merkwacht.` : undefined"
      tone="danger"
      confirm-label="Verwijderen"
      :busy="removeMember.isPending.value"
      @confirm="confirmRemoveMember"
      @cancel="removeMemberTarget = null"
    />

    <!-- Add recipient dialog -->
    <ConfirmDialog
      :open="showAddRecipient"
      title="Meldingsadres toevoegen"
      confirm-label="Toevoegen"
      :busy="createRecipient.isPending.value"
      @confirm="submitAddRecipient"
      @cancel="showAddRecipient = false"
    >
      <div class="space-y-4">
        <MwField label="E-mail" for-id="recipient-email" required>
          <input
            id="recipient-email"
            v-model="recipientForm.email"
            type="email"
            required
            class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
        </MwField>
        <MwField label="Frequentie" for-id="recipient-frequency">
          <MwSelect
            id="recipient-frequency"
            v-model="recipientForm.digestFrequency"
            :options="DIGEST_OPTIONS"
          />
        </MwField>
        <MwField :label="`Melding vanaf score: ${recipientForm.minScoreThreshold}%`" for-id="recipient-threshold">
          <input
            id="recipient-threshold"
            v-model.number="recipientForm.minScoreThreshold"
            type="range"
            min="0"
            max="100"
            step="1"
            class="w-full accent-[var(--mw-color-accent-strong)]"
          />
        </MwField>
        <div v-if="activeWatches.length > 0" class="rounded-md border border-border">
          <button
            type="button"
            class="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium text-text"
            @click="recipientForm.watchesExpanded = !recipientForm.watchesExpanded"
          >
            Bewaakte merken
            <span class="text-xs text-text-muted">{{ recipientForm.watchesExpanded ? 'inklappen' : 'uitklappen' }}</span>
          </button>
          <div v-if="recipientForm.watchesExpanded" class="max-h-44 space-y-1 border-t border-border px-3 py-2">
            <label
              v-for="watch in activeWatches"
              :key="watch.id"
              class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-surface-muted"
            >
              <input
                type="checkbox"
                class="h-4 w-4 rounded border-border text-accent-strong focus:ring-accent"
                :checked="recipientForm.selectedWatchIds.includes(watch.id)"
                @change="toggleWatchSelection(watch.id)"
              />
              <span class="text-text">{{ watch.label }}</span>
            </label>
          </div>
        </div>
        <p v-else class="text-sm text-text-muted">Er zijn nog geen actieve bewaakte merken.</p>
      </div>
    </ConfirmDialog>

    <ConfirmDialog
      :open="removeRecipientTarget !== null"
      title="Meldingsadres verwijderen"
      :description="removeRecipientTarget ? `${removeRecipientTarget.email} ontvangt geen meldingen meer.` : undefined"
      tone="danger"
      confirm-label="Verwijderen"
      :busy="deleteRecipient.isPending.value"
      @confirm="confirmRemoveRecipient"
      @cancel="removeRecipientTarget = null"
    />
  </MwPage>
</template>
