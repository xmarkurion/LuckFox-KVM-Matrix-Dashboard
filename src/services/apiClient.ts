import type { ApiFailure } from '../types/kvm';

export const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

function isApiFailure(value: unknown): value is ApiFailure {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'ok' in value &&
      (value as ApiFailure).ok === false
  );
}

export async function parseJsonResponse<T>(response: Response): Promise<T> {
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
    const maybeError = data && typeof data === 'object' && 'error' in data
      ? (data as { error?: unknown }).error
      : undefined;
    const message = isApiFailure(data)
      ? data.error
      : typeof maybeError === 'string'
        ? maybeError
        : response.status === 502
          ? 'API proxy returned HTTP 502. Make sure the Node backend is running on port 8787 and can reach the configured LAN addresses.'
          : rawText.trim() || `Request failed with HTTP ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}
