export type StatusTone = 'good' | 'warn' | 'bad' | 'unknown';
export type ButtonKind = 'primary' | 'secondary' | 'danger';
export type ToastTone = 'good' | 'warn' | 'bad';
export type MountMode = 'CDROM' | 'Disk';
export type MouseButton = 'left' | 'right' | 'middle';

export interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
}

export interface CapabilityAction {
  id: string;
  label: string;
  kind: ButtonKind;
  needsMac?: boolean;
}

export interface CapabilityGroup {
  title: string;
  description: string;
  actions: CapabilityAction[];
}
