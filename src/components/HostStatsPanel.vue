<template>
  <section class="host-stats">
    <div class="host-stats-header">
      <div>
        <p class="eyebrow">Host agent</p>
        <h3>{{ stats?.hostname || 'No host stats yet' }}</h3>
      </div>
      <span class="tiny">{{ stats?.collectedAt ? timeAgo(stats.collectedAt) : 'not checked' }}</span>
    </div>

    <p v-if="error" class="inline-error compact-error">{{ error }}</p>

    <div v-if="stats" class="metric-grid">
      <div class="metric-card">
        <span>CPU</span>
        <strong>{{ percentLabel(stats.cpu?.percent) }}</strong>
        <small>{{ cpuDetails }}</small>
      </div>
      <div class="metric-card">
        <span>Memory</span>
        <strong>{{ percentLabel(stats.memory?.percent) }}</strong>
        <small>{{ bytesLabel(stats.memory?.usedBytes) }} / {{ bytesLabel(stats.memory?.totalBytes) }}</small>
      </div>
      <div class="metric-card">
        <span>Disk</span>
        <strong>{{ percentLabel(primaryDisk?.percent) }}</strong>
        <small>{{ bytesLabel(primaryDisk?.usedBytes) }} / {{ bytesLabel(primaryDisk?.totalBytes) }}</small>
      </div>
      <div class="metric-card">
        <span>Uptime</span>
        <strong>{{ uptimeLabel(stats.uptimeSeconds) }}</strong>
        <small>{{ stats.platform?.osName || stats.platform?.system || 'host OS unknown' }}</small>
      </div>
    </div>

    <details v-if="stats" class="stats-details">
      <summary>More host stats</summary>
      <div class="status-lines host-lines">
        <div><span>Host:</span><strong>{{ stats.hostname || 'unknown' }}</strong></div>
        <div><span>OS:</span><strong>{{ stats.platform?.osName || 'unknown' }}</strong></div>
        <div><span>Kernel:</span><strong>{{ stats.platform?.release || 'unknown' }}</strong></div>
        <div><span>Arch:</span><strong>{{ stats.platform?.machine || 'unknown' }}</strong></div>
        <div><span>Swap:</span><strong>{{ percentLabel(stats.swap?.percent) }} · {{ bytesLabel(stats.swap?.usedBytes) }} used</strong></div>
        <div><span>Docker:</span><strong>{{ dockerLabel }}</strong></div>
        <div><span>Load avg:</span><strong>{{ loadAverageLabel }}</strong></div>
        <div><span>Disks:</span><strong>{{ diskCountLabel }}</strong></div>
      </div>
    </details>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { bytesLabel, percentLabel, timeAgo, uptimeLabel } from '../services/formatters';
import type { HostStats, HostStatsDisk } from '../types/kvm';

const props = defineProps<{
  stats?: HostStats | null;
  error?: string;
}>();

const primaryDisk = computed<HostStatsDisk | undefined>(() => {
  const disks = props.stats?.disks || [];
  return disks.find((disk) => disk.device === 'host-root') || disks.find((disk) => disk.mountpoint === '/') || disks[0];
});

const cpuDetails = computed(() => {
  const cpu = props.stats?.cpu;
  if (!cpu) return 'CPU unknown';
  const logical = cpu.countLogical ? `${cpu.countLogical} threads` : 'threads unknown';
  const physical = cpu.countPhysical ? `${cpu.countPhysical} cores` : 'cores unknown';
  return `${physical} · ${logical}`;
});

const loadAverageLabel = computed(() => {
  const load = props.stats?.cpu?.loadAverage;
  return Array.isArray(load) ? load.map((value) => value.toFixed(2)).join(' / ') : 'not available';
});

const dockerLabel = computed(() => {
  const docker = props.stats?.docker;
  if (!docker) return 'unknown';
  const view = docker.hostProcMounted ? 'host view' : 'container view';
  return `${docker.containerized ? 'containerized' : 'native'} · ${view}`;
});

const diskCountLabel = computed(() => {
  const count = props.stats?.disks?.length || 0;
  return count === 1 ? '1 mount' : `${count} mounts`;
});
</script>
