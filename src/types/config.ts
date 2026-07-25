export interface DashboardServerConfig {
  host?: string;
  port?: number;
  requestTimeoutMs?: number;
  pollIntervalMs?: number;
}

export interface DashboardScriptConfig {
  id: string;
  label: string;
  description?: string;
  timeoutMs?: number;
  enabled?: boolean;
}

export interface DashboardHostAgentConfig {
  enabled?: boolean;
  url: string;
  token?: string;
  timeoutMs?: number;
  scripts?: DashboardScriptConfig[];
}

export interface DashboardKvmEndpointConfig {
  enabled?: boolean;
  ip?: string;
  password?: string;
  protocol?: 'http' | 'https';
  hostMacAddress?: string;
}

export interface DashboardNodeConfig {
  id: string;
  name: string;
  notes?: string;
  kvm?: DashboardKvmEndpointConfig | false;
  hostAgent?: DashboardHostAgentConfig;
  [key: string]: unknown;
}

export interface DashboardConfig {
  server?: DashboardServerConfig;
  kvms: DashboardNodeConfig[];
  [key: string]: unknown;
}

export interface ConfigBackupSummary {
  name: string;
  createdAt: string;
  sizeBytes: number;
}

export interface ConfigResponse {
  ok: true;
  config: DashboardConfig;
  configPath: string;
  backupPath: string;
  writable: boolean;
  maxBackups: number;
  restartRequiredFields: string[];
}

export interface BackupsResponse {
  ok: true;
  backups: ConfigBackupSummary[];
  maxBackups?: number;
}

export interface ConfigMutationResponse extends BackupsResponse {
  config?: DashboardConfig;
  backup?: ConfigBackupSummary;
  restartRequiredFields?: string[];
}
