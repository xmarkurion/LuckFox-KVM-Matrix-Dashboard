<template>
  <button class="btn" :class="kind" :disabled="disabled" @click="$emit('click')">
    <span v-if="busy" class="spinner" />
    {{ busy ? busyLabel : label }}
  </button>
</template>

<script setup lang="ts">
import type { ButtonKind } from '../types/ui';

withDefaults(
  defineProps<{
    label: string;
    kind?: ButtonKind;
    disabled?: boolean;
    busy?: boolean;
    busyLabel?: string;
  }>(),
  {
    kind: 'secondary',
    disabled: false,
    busy: false,
    busyLabel: 'Sending…'
  }
);

defineEmits<{
  click: [];
}>();
</script>
