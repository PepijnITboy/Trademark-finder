<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import MwButton from '../../components/MwButton.vue';
import MwCard from '../../components/MwCard.vue';
import MwPage from '../../components/MwPage.vue';
import { ApiError } from '../../api/client';
import { useCreateWatchedTrademark, useLookupWatchedTrademark } from '../../api/watched-trademarks';
import { useToastStore } from '../../stores/toast';
import type { LookupCandidate } from '../../api/types';
import Step1Register from './wizard/Step1Register.vue';
import Step2Number from './wizard/Step2Number.vue';
import Step3Fetching from './wizard/Step3Fetching.vue';
import Step4Preview from './wizard/Step4Preview.vue';
import Step5Eligibility from './wizard/Step5Eligibility.vue';
import Step6Settings from './wizard/Step6Settings.vue';
import Step7Confirm from './wizard/Step7Confirm.vue';
import WizardSteps from '../../components/motion/WizardSteps.vue';

const STEP_LABELS = ['Register', 'Nummer', 'Ophalen', 'Voorbeeld', 'Geschiktheid', 'Instellingen', 'Bevestigen'];

const router = useRouter();
const toast = useToastStore();
const step = ref(1);
const registryCode = ref<string | null>(null);
const registrationNumber = ref('');
const label = ref('');
const notes = ref('');
const lookupResult = ref<LookupCandidate | null>(null);
const lookupErrorMessage = ref<string | null>(null);
const submitErrorMessage = ref<string | null>(null);

const lookupMutation = useLookupWatchedTrademark();
const createMutation = useCreateWatchedTrademark();

const niceClasses = computed(() => lookupResult.value?.niceClasses ?? []);

function cancel(): void {
  void router.push({ name: 'app-bewaakte-merken' });
}

async function runLookup(): Promise<void> {
  lookupErrorMessage.value = null;
  step.value = 3;
  try {
    const response = await lookupMutation.mutateAsync(registrationNumber.value.trim());
    const first = response.results[0];
    if (!first) {
      lookupErrorMessage.value = `Geen registratie gevonden bij ${registryCode.value} met nummer "${registrationNumber.value}".`;
      step.value = 2;
      return;
    }
    lookupResult.value = first;
    if (!label.value) label.value = first.markText;
    step.value = 4;
  } catch (error) {
    lookupErrorMessage.value =
      error instanceof ApiError ? error.message : 'Het ophalen van de officiële gegevens is mislukt. Probeer het opnieuw.';
    step.value = 2;
  }
}

async function confirmCreate(): Promise<void> {
  if (!lookupResult.value) return;
  submitErrorMessage.value = null;
  try {
    const { watchedTrademark } = await createMutation.mutateAsync({
      label: label.value.trim(),
      notes: notes.value.trim() || undefined,
      registryCode: lookupResult.value.registryCode,
      registrationNumber: lookupResult.value.registrationNumber,
    });
    toast.success('Bewaakt merk toegevoegd');
    void router.push({ name: 'app-watched-trademark-detail', params: { id: watchedTrademark.id } });
  } catch (error) {
    submitErrorMessage.value =
      error instanceof ApiError ? error.message : 'Het toevoegen van het merk is mislukt. Probeer het opnieuw.';
    toast.error(submitErrorMessage.value);
  }
}
</script>

<template>
  <MwPage title="Merk toevoegen" description="Voeg een geregistreerd merk toe voor automatische bewaking.">
    <template #actions>
      <MwButton variant="tertiary" @click="cancel">Annuleren</MwButton>
    </template>

    <WizardSteps :current="step" :labels="STEP_LABELS" />

    <MwCard>
      <Transition name="mw-step" mode="out-in">
      <Step1Register
        v-if="step === 1"
        key="aw-1"
        v-model="registryCode"
        @next="step = 2"
        @cancel="cancel"
      />
      <Step2Number
        v-else-if="step === 2"
        key="aw-2"
        v-model="registrationNumber"
        :registry-code="registryCode"
        :error-message="lookupErrorMessage"
        @next="runLookup"
        @back="step = 1"
      />
      <Step3Fetching v-else-if="step === 3" key="aw-3" :registration-number="registrationNumber" />
      <Step4Preview
        v-else-if="step === 4 && lookupResult"
        key="aw-4"
        :candidate="lookupResult"
        @next="step = 5"
        @back="step = 2"
      />
      <Step5Eligibility
        v-else-if="step === 5 && lookupResult"
        key="aw-5"
        :eligibility="lookupResult.eligibility"
        @next="step = 6"
        @back="step = 4"
      />
      <Step6Settings
        v-else-if="step === 6"
        key="aw-6"
        v-model:label="label"
        v-model:notes="notes"
        :nice-classes="niceClasses"
        @next="step = 7"
        @back="step = 5"
      />
      <Step7Confirm
        v-else-if="step === 7 && lookupResult"
        key="aw-7"
        :candidate="lookupResult"
        :label="label"
        :notes="notes"
        :submitting="createMutation.isPending.value"
        :error-message="submitErrorMessage"
        @confirm="confirmCreate"
        @back="step = 6"
      />
      </Transition>
    </MwCard>
  </MwPage>
</template>
