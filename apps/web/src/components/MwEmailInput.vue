<script setup lang="ts">
import { isValidBusinessEmail, suggestEmailFixes } from '@merkwacht/validation';
import { computed, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    id?: string;
    placeholder?: string;
    disabled?: boolean;
  }>(),
  { id: undefined, placeholder: 'naam@bedrijf.nl', disabled: false },
);

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const touched = ref(false);
const focused = ref(false);

const trimmed = computed(() => props.modelValue.trim());

const isValid = computed(() => trimmed.value.length === 0 || isValidBusinessEmail(trimmed.value));

const suggestions = computed(() => {
  if (trimmed.value.length === 0 || isValid.value) return [];
  return suggestEmailFixes(props.modelValue);
});

const showSuggestions = computed(() => focused.value && suggestions.value.length > 0);

const errorMessage = computed(() => {
  if (!touched.value || trimmed.value.length === 0 || isValid.value) return undefined;
  return 'Voer een geldig zakelijk e-mailadres in (bijv. naam@bedrijf.nl).';
});

const inputClass =
  'w-full rounded-md border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

function onInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).value);
}

function onBlur(): void {
  focused.value = false;
  touched.value = true;
}

function onFocus(): void {
  focused.value = true;
}

function applySuggestion(value: string): void {
  emit('update:modelValue', value);
  touched.value = true;
}

watch(
  () => props.modelValue,
  () => {
    if (isValid.value) touched.value = true;
  },
);

defineExpose({ isValid, errorMessage });
</script>

<template>
  <div class="relative">
    <input
      :id="id"
      type="email"
      autocomplete="email"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :class="[inputClass, errorMessage ? 'border-danger' : 'border-border']"
      :aria-invalid="errorMessage ? true : undefined"
      :aria-describedby="errorMessage && id ? `${id}-error` : undefined"
      @input="onInput"
      @blur="onBlur"
      @focus="onFocus"
    />
    <ul
      v-if="showSuggestions"
      class="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-surface py-1 shadow-lg"
      role="listbox"
    >
      <li
        v-for="suggestion in suggestions"
        :key="suggestion"
        role="option"
        class="cursor-pointer px-3 py-2 text-sm text-text-muted hover:bg-surface-hover hover:text-text"
        @mousedown.prevent="applySuggestion(suggestion)"
      >
        {{ suggestion }}
      </li>
    </ul>
    <p v-if="errorMessage" :id="id ? `${id}-error` : undefined" class="mt-1.5 text-sm text-danger" role="alert">
      {{ errorMessage }}
    </p>
  </div>
</template>
