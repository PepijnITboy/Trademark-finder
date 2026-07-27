<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import PageHeader from '../../components/PageHeader.vue';
import SkeletonBlock from '../../components/SkeletonBlock.vue';
import { useSettings, useUpdateSettings } from '../../api/settings';
import type { DigestFrequency } from '@merkwacht/validation';

const settingsQuery = useSettings();
const updateSettings = useUpdateSettings();

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
  updateSettings.mutate({ ...form });
}

const DIGEST_LABELS_NL: Record<DigestFrequency, string> = {
  DAILY: 'Dagelijks',
  WEEKLY: 'Wekelijks',
  IMMEDIATE: 'Direct bij elke gebeurtenis',
};
</script>

<template>
  <div class="max-w-2xl space-y-6">
    <PageHeader title="Instellingen" description="Voorkeuren voor meldingen, taal en tijdzone van uw organisatie." />

    <SkeletonBlock v-if="settingsQuery.isLoading.value" height="16rem" />

    <form v-else class="space-y-5 rounded-lg border border-border bg-surface p-5" @submit.prevent="save">
      <div>
        <label for="notification-email" class="mb-1.5 block text-sm font-medium text-text">Meldingen e-mailadres</label>
        <input
          id="notification-email"
          v-model="form.notificationEmail"
          type="email"
          required
          class="w-full max-w-md rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </div>

      <div>
        <label for="digest-frequency" class="mb-1.5 block text-sm font-medium text-text">Frequentie van samenvattingen</label>
        <select
          id="digest-frequency"
          v-model="form.digestFrequency"
          class="w-full max-w-md rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <option v-for="(labelNl, value) in DIGEST_LABELS_NL" :key="value" :value="value">{{ labelNl }}</option>
        </select>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label for="locale" class="mb-1.5 block text-sm font-medium text-text">Taal</label>
          <select
            id="locale"
            v-model="form.locale"
            class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <option value="nl-NL">Nederlands</option>
            <option value="en-US">Engels</option>
          </select>
        </div>
        <div>
          <label for="timezone" class="mb-1.5 block text-sm font-medium text-text">Tijdzone</label>
          <input
            id="timezone"
            v-model="form.timezone"
            type="text"
            class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </div>
      </div>

      <div class="flex items-center gap-3 border-t border-border pt-4">
        <button
          type="submit"
          class="rounded-md bg-accent-strong px-3.5 py-2 text-sm font-medium text-white hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!isDirty || updateSettings.isPending.value"
        >
          {{ updateSettings.isPending.value ? 'Opslaan…' : 'Wijzigingen opslaan' }}
        </button>
        <p v-if="updateSettings.isSuccess.value && !isDirty" class="text-xs text-success">Opgeslagen.</p>
      </div>
    </form>
  </div>
</template>
