import type { JsonObject, JsonValue, KvmStatus, VideoState } from '../types/kvm';
import type { StatusTone } from '../types/ui';

export function statusTone(status: Pick<KvmStatus, 'kvmResponds' | 'authenticated' | 'error'> | null | undefined): StatusTone {
  if (!status) return 'unknown';
  if (status.error) return 'bad';
  if (status.kvmResponds) return 'good';
  if (status.authenticated) return 'warn';
  return 'bad';
}

export function videoLabel(video: VideoState | null | undefined): string {
  if (!video) return 'video unknown';
  if (video.ready) return `${video.width || '?'}×${video.height || '?'} @ ${video.fps || '?'} fps`;
  return video.error ? `no video: ${video.error}` : 'no video signal';
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function usbLabel(usb: JsonValue | undefined): string {
  if (usb === null || usb === undefined) return 'USB unknown';
  if (typeof usb === 'string') return usb;
  if (isJsonObject(usb) && typeof usb.state === 'string') return usb.state;
  return JSON.stringify(usb);
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (Number.isNaN(seconds)) return 'unknown';
  if (seconds < 5) return 'now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

export function bytesLabel(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let size = Math.abs(value);
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const signed = value < 0 ? -size : size;
  const precision = unitIndex === 0 || size >= 100 ? 0 : 1;
  return `${signed.toFixed(precision)} ${units[unitIndex]}`;
}

export function percentLabel(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${Math.round(value * 10) / 10}%`;
}

export function uptimeLabel(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
