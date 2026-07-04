<template>
  <span class="status-badge" :class="tone">
    <span class="dot" />
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import type { StatusTone } from '../types/ui';

withDefaults(
  defineProps<{
    tone?: StatusTone;
    label?: string;
  }>(),
  {
    tone: 'unknown',
    label: 'unknown'
  }
);
</script>
