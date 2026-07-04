export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue | undefined;
}

export interface KvmSummary {
  id: string;
  name: string;
  ip: string;
  notes: string;
  websiteUrl: string;
  hasWolMac: boolean;
}

export interface VideoState extends JsonObject {
  ready?: boolean;
  width?: number;
  height?: number;
  fps?: number;
  error?: string;
}

export interface KvmStatus extends KvmSummary {
  kvmResponds: boolean;
  authenticated: boolean;
  deviceId: string;
  video: VideoState | null;
  usb: JsonValue | undefined;
  keyboardLeds: JsonValue | undefined;
  hostPower: string;
  latencyMs: number | null;
  checkedAt: string;
  error: string;
}

export type ActionPayload = JsonObject;

export interface PanelActionEvent {
  action: string;
  payload: ActionPayload;
}

export interface KvmActionEvent extends PanelActionEvent {
  id: string;
}

export interface KvmsResponse {
  kvms: KvmSummary[];
  pollIntervalMs: number;
}

export interface StatusesResponse {
  kvms: KvmStatus[];
}

export interface ApiSuccess<T = JsonValue | undefined> {
  ok?: true;
  result?: T;
}

export interface ApiFailure {
  ok: false;
  error: string;
  data?: unknown;
}

export interface RawRpcRequest {
  method: string;
  params: ActionPayload;
}

export type KvmStatusMap = Record<string, KvmStatus | undefined>;
export type BusyMap = Record<string, string | undefined>;
