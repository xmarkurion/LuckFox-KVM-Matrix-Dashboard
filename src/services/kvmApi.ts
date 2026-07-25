import type {
  ActionPayload,
  ApiSuccess,
  HostStats,
  KvmStatus,
  PcReachability,
  KvmsResponse,
  StatusesResponse
} from '../types/kvm';

import { JSON_HEADERS, parseJsonResponse } from './apiClient';

export async function fetchKvms(): Promise<KvmsResponse> {
  const response = await fetch('/api/kvms');
  return parseJsonResponse<KvmsResponse>(response);
}

export async function fetchActions(): Promise<{ actions: unknown[] }> {
  const response = await fetch('/api/actions');
  return parseJsonResponse<{ actions: unknown[] }>(response);
}

export async function fetchAllStatuses(): Promise<StatusesResponse> {
  const response = await fetch('/api/kvms/status');
  return parseJsonResponse<StatusesResponse>(response);
}

export async function fetchKvmStatus(id: string): Promise<KvmStatus> {
  const response = await fetch(`/api/kvms/${encodeURIComponent(id)}/status`);
  return parseJsonResponse<KvmStatus>(response);
}


export async function fetchPcStatus(id: string): Promise<PcReachability> {
  const response = await fetch(`/api/kvms/${encodeURIComponent(id)}/pc-status`);
  const data = await parseJsonResponse<{ ok: true; pc: PcReachability }>(response);
  return data.pc;
}

export async function fetchHostStats(id: string): Promise<HostStats | null> {
  const response = await fetch(`/api/kvms/${encodeURIComponent(id)}/host-stats`);
  const data = await parseJsonResponse<{ ok: true; stats: HostStats | null }>(response);
  return data.stats;
}

export async function runKvmAction<T = unknown>(id: string, action: string, payload: ActionPayload = {}): Promise<ApiSuccess<T>> {
  const response = await fetch(`/api/kvms/${encodeURIComponent(id)}/action/${encodeURIComponent(action)}`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload)
  });
  return parseJsonResponse<ApiSuccess<T>>(response);
}

export async function runRawRpc<T = unknown>(id: string, method: string, params: ActionPayload = {}): Promise<ApiSuccess<T>> {
  const response = await fetch(`/api/kvms/${encodeURIComponent(id)}/rpc`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ method, params })
  });
  return parseJsonResponse<ApiSuccess<T>>(response);
}
