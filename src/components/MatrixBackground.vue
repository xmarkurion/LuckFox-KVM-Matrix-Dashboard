<template>
  <div class="matrix-bg" aria-hidden="true">
    <span v-for="column in columns" :key="column" :style="styleFor(column)">10110 01101 11001 00101</span>
  </div>
</template>

<script setup lang="ts">
import type { CSSProperties } from 'vue';

const columns = Array.from({ length: 32 }, (_, index) => index);

function styleFor(index: number): CSSProperties {
  return {
    left: `${index * 3.2}%`,
    animationDelay: `${(index % 11) * -0.7}s`,
    animationDuration: `${7 + (index % 8)}s`
  };
}
</script>
