<template>
  <section class="settings-card backup-card">
    <div class="settings-card-title split">
      <div>
        <h4>Configuration backups</h4>
        <p>The dashboard keeps the newest {{ maxBackups }} backups. Older files are removed automatically.</p>
      </div>
      <button class="btn secondary compact" type="button" :disabled="busy" @click="$emit('create')">
        Create backup
      </button>
    </div>

    <div v-if="busy && !backups.length" class="settings-loading">Loading backups…</div>
    <div v-else-if="!backups.length" class="settings-empty-inline">No backups yet. A backup is created automatically before every save.</div>
    <div v-else class="backup-list">
      <article v-for="backup in backups" :key="backup.name" class="backup-row">
        <div class="backup-copy">
          <strong>{{ backup.name }}</strong>
          <span>{{ formatDate(backup.createdAt) }} · {{ bytesLabel(backup.sizeBytes) }}</span>
        </div>
        <div class="backup-actions">
          <a class="btn ghost compact" :href="configBackupDownloadUrl(backup.name)" download>Download</a>
          <button class="btn secondary compact" type="button" :disabled="busy" @click="$emit('restore', backup.name)">Restore</button>
          <button class="btn danger compact" type="button" :disabled="busy" @click="$emit('delete', backup.name)">Delete</button>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { configBackupDownloadUrl } from '../services/configApi';
import { bytesLabel } from '../services/formatters';
import type { ConfigBackupSummary } from '../types/config';

defineProps<{
  backups: ConfigBackupSummary[];
  maxBackups: number;
  busy: boolean;
}>();

defineEmits<{
  create: [];
  restore: [name: string];
  delete: [name: string];
}>();

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
</script>
