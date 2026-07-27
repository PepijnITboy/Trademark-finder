<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import type { DigestFrequency } from '@merkwacht/validation';
import MwBanner from '../../components/MwBanner.vue';
import MwButton from '../../components/MwButton.vue';
import MwCard from '../../components/MwCard.vue';
import MwField from '../../components/MwField.vue';
import MwPage from '../../components/MwPage.vue';
import SkeletonBlock from '../../components/SkeletonBlock.vue';
import { useSettings, useUpdateSettings } from '../../api/settings';
import { useThemeStore, type ThemeMode } from '../../stores/theme';
import { useToastStore } from '../../stores/toast';

const settingsQuery = useSettings();
const updateSettings = useUpdateSettings();
const themeStore = useThemeStore();
const toast = useToastStore();

const form = reactive({
  locale: 'nl-NL',
  timezone: 'Europe/Amsterdam',
  notificationEmail: '',
  digestFrequency: 'DAILY' as DigestFrequency,
});

watch(
  settingsQuery.data,
  (settings) => {
    if (!settings) return;
    form.locale = settings.locale;
    form.timezone = settings.timezone;
    form.notificationEmail = settings.notificationEmail;
    form.digestFrequency = settings.digestFrequency;
  },
  { immediate: true },
);

const isDirty = computed(() => {
  const current = settingsQuery.data.value;
  if (!current) return false;
  return (
    form.locale !== current.locale ||
    form.timezone !== current.timezone ||
    form.notificationEmail !== current.notificationEmail ||
    form.digestFrequency !== current.digestFrequency
  );
});

function save(): void {
  updateSettings.mutate(
    { ...form },
    {
      onSuccess: () => toast.success('Instellingen opgeslagen'),
      onError: () => toast.error('Opslaan is mislukt. Controleer de velden en probeer opnieuw.'),
    },
  );
}

const DIGEST_LABELS_NL: Record<DigestFrequency, string> = {
  DAILY: 'Dagelijks',
  WEEKLY: 'Wekelijks',
};

const THEME_OPTIONS: ReadonlyArray<{ value: ThemeMode; label: string; description: string }> = [
  { value: 'light', label: 'Licht', description: 'Lichte achtergrond en donkere tekst.' },
  { value: 'dark', label: 'Donker', description: 'Donkere achtergrond voor weinig licht.' },
  { value: 'system', label: 'Systeem', description: 'Volgt de instelling van uw apparaat.' },
];

function setTheme(mode: ThemeMode): void {
  themeStore.setMode(mode);
}
</script>

<template>
  <MwPage title="Instellingen" description="Voorkeuren voor weergave, meldingen, taal en tijdzone.">
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

    <SkeletonBlock v-if="settingsQuery.isLoading.value" height="16rem" />

    <MwBanner v-else-if="settingsQuery.isError.value" tone="danger" title="Instellingen konden niet worden geladen">
      Probeer de pagina te verversen.
    </MwBanner>

    <form v-else @submit.prevent="save">
      <MwCard title="Meldingen en regio">
        <div class="space-y-5">
          <MwField
            label="Meldingen e-mailadres"
            for-id="notification-email"
            hint="Op dit adres ontvangt u samenvattingen en belangrijke meldingen."
            required
          >
            <input
              id="notification-email"
              v-model="form.notificationEmail"
              type="email"
              required
              class="w-full max-w-md rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
          </MwField>

          <MwField label="Frequentie van samenvattingen" for-id="digest-frequency">
            <select
              id="digest-frequency"
              v-model="form.digestFrequency"
              class="w-full max-w-md rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <option v-for="(labelNl, value) in DIGEST_LABELS_NL" :key="value" :value="value">{{ labelNl }}</option>
            </select>
          </MwField>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MwField label="Taal" for-id="locale">
              <select
                id="locale"
                v-model="form.locale"
                class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <option value="nl-NL">Nederlands</option>
                <option value="en-US">Engels</option>
              </select>
            </MwField>
            <MwField label="Tijdzone" for-id="timezone" hint="Bijvoorbeeld Europe/Amsterdam">
              <input
                id="timezone"
                v-model="form.timezone"
                type="text"
                class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
            </MwField>
          </div>
        </div>
        <template #footer>
          <div class="flex items-center gap-3">
            <MwButton type="submit" variant="primary" :disabled="!isDirty" :loading="updateSettings.isPending.value">
              Wijzigingen opslaan
            </MwButton>
            <button
              v-if="isDirty"
              type="button"
              class="text-sm text-text-muted hover:text-text"
              @click="
                form.locale = settingsQuery.data.value!.locale;
                form.timezone = settingsQuery.data.value!.timezone;
                form.notificationEmail = settingsQuery.data.value!.notificationEmail;
                form.digestFrequency = settingsQuery.data.value!.digestFrequency;
              "
            >
              Annuleren
            </button>
          </div>
        </template>
      </MwCard>
    </form>
  </MwPage>
</template>
