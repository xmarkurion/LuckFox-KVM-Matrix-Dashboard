<template>
  <section class="host-stats">
    <div class="host-stats-header">
      <div>
        <p class="eyebrow">Host telemetry</p>
        <h3>{{ stats?.hostname || 'Waiting for host agent' }}</h3>
      </div>
      <span class="tiny">{{ stats?.collectedAt ? timeAgo(stats.collectedAt) : 'Not available' }}</span>
    </div>

    <p v-if="error" class="inline-error compact-error">{{ error }}</p>

    <div v-if="stats" class="metric-grid">
      <article class="metric-card">
        <div class="metric-card-top"><span>CPU</span><strong>{{ percentLabel(stats.cpu?.percent) }}</strong></div>
        <div class="meter"><span :style="meterWidth(stats.cpu?.percent)" /></div>
        <small>{{ cpuDetails }}</small>
      </article>
      <article class="metric-card">
        <div class="metric-card-top"><span>Memory</span><strong>{{ percentLabel(stats.memory?.percent) }}</strong></div>
        <div class="meter"><span :style="meterWidth(stats.memory?.percent)" /></div>
        <small>{{ bytesLabel(stats.memory?.usedBytes) }} of {{ bytesLabel(stats.memory?.totalBytes) }}</small>
      </article>
      <article class="metric-card">
        <div class="metric-card-top"><span>Disk</span><strong>{{ percentLabel(primaryDisk?.percent) }}</strong></div>
        <div class="meter"><span :style="meterWidth(primaryDisk?.percent)" /></div>
        <small>{{ bytesLabel(primaryDisk?.usedBytes) }} of {{ bytesLabel(primaryDisk?.totalBytes) }}</small>
      </article>
      <article class="metric-card">
        <div class="metric-card-top"><span>Uptime</span><strong>{{ uptimeLabel(stats.uptimeSeconds) }}</strong></div>
        <div class="metric-divider" />
        <small>{{ stats.platform?.osName || stats.platform?.system || 'Host OS unknown' }}</small>
      </article>
    </div>

    <details v-if="stats" class="stats-details">
      <summary>More host telemetry</summary>
      <div class="detail-list host-lines">
        <div><span>Host</span><strong>{{ stats.hostname || 'unknown' }}</strong></div>
        <div><span>Operating system</span><strong>{{ stats.platform?.osName || 'unknown' }}</strong></div>
        <div><span>Kernel</span><strong>{{ stats.platform?.release || 'unknown' }}</strong></div>
        <div><span>Architecture</span><strong>{{ stats.platform?.machine || 'unknown' }}</strong></div>
        <div><span>Swap</span><strong>{{ percentLabel(stats.swap?.percent) }} · {{ bytesLabel(stats.swap?.usedBytes) }} used</strong></div>
        <div><span>Runtime view</span><strong>{{ dockerLabel }}</strong></div>
        <div><span>Load average</span><strong>{{ loadAverageLabel }}</strong></div>
        <div><span>Disk mounts</span><strong>{{ diskCountLabel }}</strong></div>
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
  if (!cpu) return 'CPU details unavailable';
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

function meterWidth(value: number | null | undefined): Record<string, string> {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return { width: `${safe}%` };
}
</script>
