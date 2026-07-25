import { JSON_HEADERS, parseJsonResponse } from './apiClient';
import type {
  BackupsResponse,
  ConfigMutationResponse,
  ConfigResponse,
  DashboardConfig
} from '../types/config';

export async function fetchDashboardConfig(): Promise<ConfigResponse> {
  const response = await fetch('/api/config', { cache: 'no-store' });
  return parseJsonResponse<ConfigResponse>(response);
}

export async function saveDashboardConfig(config: DashboardConfig): Promise<ConfigMutationResponse> {
  const response = await fetch('/api/config', {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({ config })
  });
  return parseJsonResponse<ConfigMutationResponse>(response);
}

export async function fetchConfigBackups(): Promise<BackupsResponse> {
  const response = await fetch('/api/config/backups', { cache: 'no-store' });
  return parseJsonResponse<BackupsResponse>(response);
}

export async function createConfigBackup(): Promise<ConfigMutationResponse> {
  const response = await fetch('/api/config/backups', { method: 'POST' });
  return parseJsonResponse<ConfigMutationResponse>(response);
}

export async function deleteConfigBackup(name: string): Promise<BackupsResponse> {
  const response = await fetch(`/api/config/backups/${encodeURIComponent(name)}`, { method: 'DELETE' });
  return parseJsonResponse<BackupsResponse>(response);
}

export async function restoreConfigBackup(name: string): Promise<ConfigMutationResponse> {
  const response = await fetch(`/api/config/backups/${encodeURIComponent(name)}/restore`, { method: 'POST' });
  return parseJsonResponse<ConfigMutationResponse>(response);
}

export function configBackupDownloadUrl(name: string): string {
  return `/api/config/backups/${encodeURIComponent(name)}/download`;
}
