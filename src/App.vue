<template>
  <MatrixBackground />
  <main class="shell">
    <DashboardHeader
      :device-count="kvms.length"
      :kvm-enabled="kvmEnabledCount"
      :kvm-online="kvmOnlineCount"
      :pc-online="pcOnlineCount"
      :poll-seconds="Math.round(pollIntervalMs / 1000)"
      :last-refresh-label="lastRefreshLabel"
      :loading="loading"
      @refresh="refreshStatuses"
    />

    <section v-if="error" class="alert panel" role="alert">
      <strong>Dashboard refresh failed.</strong>
      <span>{{ error }}</span>
    </section>

    <DashboardToolbar
      v-model:search="searchQuery"
      v-model:filter="deviceFilter"
      :result-count="filteredKvms.length"
    />

    <KvmGrid
      v-if="filteredKvms.length"
      :kvms="filteredKvms"
      :statuses="statuses"
      :busy-map="busyMap"
      @refresh="refreshOne"
      @action="handleAction"
    />

    <section v-else class="empty-state panel">
      <div class="empty-state-icon" aria-hidden="true">⌁</div>
      <h2>No devices match this view</h2>
      <p>Clear the search or choose another filter.</p>
      <button class="btn secondary" type="button" @click="resetFilters">Reset filters</button>
    </section>

    <footer class="dashboard-footer">
      <span>LuckFox KVM Matrix</span>
      <span>API and credentials remain on the server.</span>
    </footer>

    <ToastStack :items="toasts" @remove="removeToast" />
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import DashboardHeader from './components/DashboardHeader.vue';
import DashboardToolbar from './components/DashboardToolbar.vue';
import KvmGrid from './components/KvmGrid.vue';
import MatrixBackground from './components/MatrixBackground.vue';
import ToastStack from './components/ToastStack.vue';
import { fetchAllStatuses, fetchKvmStatus, fetchKvms, runKvmAction, runRawRpc } from './services/kvmApi';
import { timeAgo } from './services/formatters';
import type { ActionPayload, BusyMap, KvmActionEvent, KvmStatus, KvmStatusMap, KvmSummary } from './types/kvm';
import type { DeviceFilter, ToastItem, ToastTone } from './types/ui';

const kvms = ref<KvmSummary[]>([]);
const statuses = reactive<KvmStatusMap>({});
const busyMap = reactive<BusyMap>({});
const toasts = ref<ToastItem[]>([]);
const error = ref('');
const loading = ref(false);
const pollIntervalMs = ref(15000);
const lastRefreshedAt = ref<string | null>(null);
const searchQuery = ref('');
const deviceFilter = ref<DeviceFilter>('all');
let intervalId: number | null = null;

const kvmEnabledCount = computed(() => kvms.value.filter((kvm) => kvm.kvmEnabled).length);
const kvmOnlineCount = computed(() => kvms.value.filter((kvm) => kvm.kvmEnabled && statuses[kvm.id]?.kvmResponds).length);
const pcOnlineCount = computed(() => kvms.value.filter((kvm) => statuses[kvm.id]?.pcResponds).length);
const lastRefreshLabel = computed(() => lastRefreshedAt.value ? timeAgo(lastRefreshedAt.value) : 'Not yet');

const filteredKvms = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  return kvms.value.filter((kvm) => {
    const status = statuses[kvm.id];
    const searchable = [kvm.name, kvm.id, kvm.ip, kvm.pcIp, kvm.notes].join(' ').toLowerCase();
    if (query && !searchable.includes(query)) return false;

    switch (deviceFilter.value) {
      case 'online':
        return Boolean(status?.pcResponds || (kvm.kvmEnabled && status?.kvmResponds));
      case 'offline':
        return Boolean(status && (!status.pcResponds || (kvm.kvmEnabled && !status.kvmResponds)));
      case 'agent-only':
        return !kvm.kvmEnabled;
      default:
        return true;
    }
  });
});

function errorMessage(errorLike: unknown): string {
  return errorLike instanceof Error ? errorLike.message : String(errorLike);
}

function asActionPayload(value: unknown): ActionPayload {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as ActionPayload) : {};
}

function upsertStatus(status: KvmStatus): void {
  if (status.id) statuses[status.id] = status;
}

function addToast(message: string, tone: ToastTone = 'good'): void {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  toasts.value = [...toasts.value, { id, message, tone }];
  window.setTimeout(() => removeToast(id), 4500);
}

function removeToast(id: string): void {
  toasts.value = toasts.value.filter((toast) => toast.id !== id);
}

async function loadKvms(): Promise<void> {
  const data = await fetchKvms();
  kvms.value = data.kvms;
  pollIntervalMs.value = data.pollIntervalMs || 15000;
}

async function refreshStatuses(): Promise<void> {
  if (loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    const data = await fetchAllStatuses();
    data.kvms.forEach(upsertStatus);
    lastRefreshedAt.value = new Date().toISOString();
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    loading.value = false;
  }
}

async function refreshOne(id: string): Promise<void> {
  busyMap[id] = 'refresh';
  try {
    const status = await fetchKvmStatus(id);
    upsertStatus(status);
    lastRefreshedAt.value = new Date().toISOString();
  } catch (err) {
    addToast(errorMessage(err), 'bad');
  } finally {
    busyMap[id] = '';
  }
}

function busyKeyFor(action: string, payload: ActionPayload): string {
  if (action === 'hostScript' && typeof payload.scriptId === 'string') {
    return `hostScript:${payload.scriptId}`;
  }
  return action;
}

function actionToastLabel(action: string, payload: ActionPayload): string {
  if (action === 'hostScript' && typeof payload.scriptLabel === 'string') {
    return payload.scriptLabel;
  }
  return action;
}

async function handleAction({ id, action, payload }: KvmActionEvent): Promise<void> {
  busyMap[id] = busyKeyFor(action, payload);
  try {
    if (action === 'rawRpc') {
      const method = typeof payload.method === 'string' ? payload.method : '';
      await runRawRpc(id, method, asActionPayload(payload.params));
    } else {
      await runKvmAction(id, action, payload);
    }
    const toastLabel = actionToastLabel(action, payload);
    addToast(`${id}: ${toastLabel} sent`, action.includes('reset') || action.includes('reboot') || action.includes('power_off') ? 'warn' : 'good');
    await refreshOne(id);
  } catch (err) {
    addToast(`${id}: ${errorMessage(err)}`, 'bad');
  } finally {
    busyMap[id] = '';
  }
}

function resetFilters(): void {
  searchQuery.value = '';
  deviceFilter.value = 'all';
}

onMounted(async () => {
  try {
    await loadKvms();
    await refreshStatuses();
    intervalId = window.setInterval(refreshStatuses, pollIntervalMs.value);
  } catch (err) {
    error.value = errorMessage(err);
  }
});

onBeforeUnmount(() => {
  if (intervalId) window.clearInterval(intervalId);
});
</script>
