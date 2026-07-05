import type {
  ActionPayload,
  ApiFailure,
  ApiSuccess,
  HostStats,
  KvmStatus,
  KvmsResponse,
  StatusesResponse
} from '../types/kvm';

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

function isApiFailure(value: unknown): value is ApiFailure {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'ok' in value &&
      (value as ApiFailure).ok === false
  );
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const rawText = await response.text();
  let data: unknown = {};

  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = {};
    }
  }

  if (!response.ok || isApiFailure(data)) {
    const maybeError = data && typeof data === 'object' && 'error' in data ? (data as { error?: unknown }).error : undefined;
    const message = isApiFailure(data)
      ? data.error
      : typeof maybeError === 'string'
        ? maybeError
        : response.status === 502
          ? 'API proxy returned HTTP 502. Make sure the Node backend is running on port 8787 and can reach the KVM LAN addresses.'
          : rawText.trim() || `Request failed with HTTP ${response.status}`;
    throw new Error(message);
  }
  return data as T;
}

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
