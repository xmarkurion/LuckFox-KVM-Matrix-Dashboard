<template>
  <header class="dashboard-header panel">
    <div class="brand-block">
      <div class="brand-mark" aria-hidden="true">K</div>
      <div>
        <p class="eyebrow">LuckFox control plane</p>
        <h1>KVM Matrix</h1>
        <p class="header-copy">One place for KVM access, host health and maintenance scripts.</p>
      </div>
    </div>

    <div class="summary-strip" aria-label="Dashboard summary">
      <div class="summary-item">
        <span>Devices</span>
        <strong>{{ deviceCount }}</strong>
      </div>
      <div class="summary-item">
        <span>KVM online</span>
        <strong>{{ kvmOnline }}/{{ kvmEnabled }}</strong>
      </div>
      <div class="summary-item">
        <span>PC online</span>
        <strong>{{ pcOnline }}/{{ deviceCount }}</strong>
      </div>
      <div class="summary-item">
        <span>Last refresh</span>
        <strong>{{ lastRefreshLabel }}</strong>
      </div>
    </div>

    <div class="header-actions">
      <div class="header-button-row">
        <button class="btn secondary" type="button" @click="$emit('settings')">Settings</button>
        <button class="btn primary refresh-all" type="button" :disabled="loading" @click="$emit('refresh')">
        <span v-if="loading" class="spinner" />
          {{ loading ? 'Refreshing' : 'Refresh all' }}
        </button>
      </div>
      <span class="tiny">Automatic refresh every {{ pollSeconds }}s</span>
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  deviceCount: number;
  kvmEnabled: number;
  kvmOnline: number;
  pcOnline: number;
  pollSeconds: number;
  lastRefreshLabel: string;
  loading: boolean;
}>();

defineEmits<{
  refresh: [];
  settings: [];
}>();
</script>
