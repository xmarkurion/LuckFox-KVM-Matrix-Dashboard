<template>
  <section class="grid" aria-label="KVM list">
    <KvmCard
      v-for="kvm in kvms"
      :key="kvm.id"
      :kvm="kvm"
      :status="statuses[kvm.id]"
      :busy="busyMap[kvm.id] || ''"
      @refresh="$emit('refresh', kvm.id)"
      @action="$emit('action', $event)"
    />
  </section>
</template>

<script setup lang="ts">
import KvmCard from './KvmCard.vue';
import type { BusyMap, KvmActionEvent, KvmStatusMap, KvmSummary } from '../types/kvm';

defineProps<{
  kvms: KvmSummary[];
  statuses: KvmStatusMap;
  busyMap: BusyMap;
}>();

defineEmits<{
  refresh: [id: string];
  action: [event: KvmActionEvent];
}>();
</script>
