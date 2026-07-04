<template>
  <aside class="toast-stack" aria-live="polite">
    <button
      v-for="item in items"
      :key="item.id"
      class="toast"
      :class="item.tone"
      @click="$emit('remove', item.id)"
    >
      {{ item.message }}
    </button>
  </aside>
</template>

<script setup lang="ts">
import type { ToastItem } from '../types/ui';

defineProps<{
  items: ToastItem[];
}>();

defineEmits<{
  remove: [id: string];
}>();
</script>
