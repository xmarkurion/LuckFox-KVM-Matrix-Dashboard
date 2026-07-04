<template>
  <MatrixBackground />
  <main class="shell">
    <header class="hero panel glow">
      <div>
        <p class="eyebrow">LuckFox PicoKVM Control</p>
        <h1>KVM Matrix</h1>
        <p class="muted">
          Local dashboard for LMDE, AM4, NAS, and PCMAIN. Passwords stay server-side in <code>kvm.config.json</code>.
        </p>
      </div>
      <div class="hero-actions">
        <button class="btn primary" :disabled="loading" @click="refreshStatuses">
          {{ loading ? 'Scanning…' : 'Refresh all' }}
        </button>
        <span class="tiny">Auto refresh: {{ Math.round(pollIntervalMs / 1000) }}s</span>
      </div>
    </header>

    <section v-if="error" class="alert panel">{{ error }}</section>

    <KvmGrid
      :kvms="kvms"
      :statuses="statuses"
      :busy-map="busyMap"
      @refresh="refreshOne"
      @action="handleAction"
    />

    <ToastStack :items="toasts" @remove="removeToast" />
  </main>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import MatrixBackground from './components/MatrixBackground.vue';
import KvmGrid from './components/KvmGrid.vue';
import ToastStack from './components/ToastStack.vue';
import { fetchAllStatuses, fetchKvmStatus, fetchKvms, runKvmAction, runRawRpc } from './services/kvmApi';
import type { ActionPayload, BusyMap, KvmActionEvent, KvmStatus, KvmStatusMap, KvmSummary } from './types/kvm';
import type { ToastItem, ToastTone } from './types/ui';

const kvms = ref<KvmSummary[]>([]);
const statuses = reactive<KvmStatusMap>({});
const busyMap = reactive<BusyMap>({});
const toasts = ref<ToastItem[]>([]);
const error = ref('');
const loading = ref(false);
const pollIntervalMs = ref(15000);
let intervalId: number | null = null;

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
  loading.value = true;
  error.value = '';
  try {
    const data = await fetchAllStatuses();
    data.kvms.forEach(upsertStatus);
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
  } catch (err) {
    addToast(errorMessage(err), 'bad');
  } finally {
    busyMap[id] = '';
  }
}

async function handleAction({ id, action, payload }: KvmActionEvent): Promise<void> {
  busyMap[id] = action;
  try {
    if (action === 'rawRpc') {
      const method = typeof payload.method === 'string' ? payload.method : '';
      await runRawRpc(id, method, asActionPayload(payload.params));
    } else {
      await runKvmAction(id, action, payload);
    }
    addToast(`${id}: ${action} sent`, action.includes('reset') || action.includes('reboot') ? 'warn' : 'good');
    await refreshOne(id);
  } catch (err) {
    addToast(`${id}: ${errorMessage(err)}`, 'bad');
  } finally {
    busyMap[id] = '';
  }
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
