<script setup lang="ts">
import { computed, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    id?: string;
    disabled?: boolean;
  }>(),
  { id: undefined, disabled: false },
);

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const touched = ref(false);
const draft = ref(props.modelValue);

watch(
  () => props.modelValue,
  (value) => {
    draft.value = value;
  },
);

const digits = computed(() => draft.value.replace(/\D/g, ''));

const isValid = computed(() => {
  if (digits.value.length === 0) return true;
  // NL mobile/landline-ish, or international E.164-ish length.
  if (draft.value.trim().startsWith('+')) return digits.value.length >= 8 && digits.value.length <= 15;
  return digits.value.length >= 9 && digits.value.length <= 14;
});

const errorMessage = computed(() => {
  if (!touched.value || isValid.value) return undefined;
  return 'Voer een geldig telefoonnummer in (bijv. +31 6 12345678).';
});

function onInput(event: Event): void {
  draft.value = (event.target as HTMLInputElement).value;
  emit('update:modelValue', draft.value);
}

function onBlur(): void {
  touched.value = true;
}

defineExpose({ isValid, errorMessage });
</script>

<template>
  <div>
    <input
      :id="id"
      type="tel"
      autocomplete="tel"
      :value="draft"
      :disabled="disabled"
      placeholder="+31 6 12345678"
      class="w-full rounded-md border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
      :class="errorMessage ? 'border-danger' : 'border-border'"
      :aria-invalid="errorMessage ? true : undefined"
      :aria-describedby="errorMessage && id ? `${id}-error` : undefined"
      @input="onInput"
      @blur="onBlur"
    />
    <p v-if="errorMessage" :id="id ? `${id}-error` : undefined" class="mt-1.5 text-sm text-danger" role="alert">
      {{ errorMessage }}
    </p>
  </div>
</template>
