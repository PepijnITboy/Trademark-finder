<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{ modelValue: string; registryCode: string | null; errorMessage: string | null }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void; (e: 'next'): void; (e: 'back'): void }>();

const touched = ref(false);

function submit(): void {
  touched.value = true;
  if (props.modelValue.trim().length === 0) return;
  emit('next');
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-base font-semibold text-text">Officieel depotnummer</h2>
      <p class="mt-1 text-sm text-text-muted">
        Voer het officiële depot- of aanvraagnummer in zoals vermeld bij
        <span class="font-medium text-text">{{ registryCode }}</span>.
      </p>
    </div>

    <div class="max-w-sm">
      <label for="registration-number" class="mb-1.5 block text-sm font-medium text-text">Depotnummer</label>
      <input
        id="registration-number"
        :value="modelValue"
        type="text"
        placeholder="Bijv. 1234567"
        class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @keydown.enter="submit"
      />
      <p v-if="touched && modelValue.trim().length === 0" class="mt-1.5 text-xs text-danger">
        Voer een depotnummer in.
      </p>
      <p v-else-if="errorMessage" class="mt-1.5 text-xs text-danger">{{ errorMessage }}</p>
    </div>

    <div class="flex justify-end gap-2 border-t border-border pt-4">
      <button type="button" class="rounded-md border border-border px-3.5 py-2 text-sm font-medium text-text hover:bg-surface-muted" @click="emit('back')">
        Terug
      </button>
      <button
        type="button"
        class="rounded-md bg-accent-strong px-3.5 py-2 text-sm font-medium text-white hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="modelValue.trim().length === 0"
        @click="submit"
      >
        Merk opzoeken
      </button>
    </div>
  </div>
</template>
