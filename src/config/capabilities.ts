import type { CapabilityGroup } from '../types/ui';

export const CAPABILITY_GROUPS: CapabilityGroup[] = [
  {
    title: 'Host power',
    description: 'Physical front-panel actions through the PicoKVM Ext / GPIO wiring.',
    actions: [
      { id: 'power', label: 'Power press', kind: 'primary' },
      { id: 'reset', label: 'Reset press', kind: 'danger' },
      { id: 'usbWakeup', label: 'USB wakeup', kind: 'secondary' },
      { id: 'wol', label: 'Wake-on-LAN', kind: 'secondary', needsMac: true }
    ]
  },
  {
    title: 'Keyboard',
    description: 'USB HID keyboard reports sent to the attached host.',
    actions: [
      { id: 'arrowUp', label: 'Arrow Up', kind: 'primary' },
      { id: 'ctrlAltDel', label: 'Ctrl+Alt+Del', kind: 'danger' },
      { id: 'keyPress', label: 'Single key', kind: 'secondary' },
      { id: 'keyCombo', label: 'Combo', kind: 'secondary' },
      { id: 'typeText', label: 'Type text', kind: 'secondary' }
    ]
  },
  {
    title: 'Mouse',
    description: 'Absolute, relative, click, and wheel mouse reports.',
    actions: [
      { id: 'click', label: 'Click', kind: 'secondary' },
      { id: 'absMouseReport', label: 'Absolute move', kind: 'secondary' },
      { id: 'relMouseReport', label: 'Relative move', kind: 'secondary' },
      { id: 'wheelReport', label: 'Wheel', kind: 'secondary' }
    ]
  },
  {
    title: 'Virtual media',
    description: 'Mount, unmount, and boot installation images.',
    actions: [
      { id: 'mountWithHTTP', label: 'Mount HTTP image', kind: 'secondary' },
      { id: 'mountWithStorage', label: 'Mount stored image', kind: 'secondary' },
      { id: 'mountBuiltInImage', label: 'Mount built-in image', kind: 'secondary' },
      { id: 'unmountImage', label: 'Unmount image', kind: 'danger' }
    ]
  },
  {
    title: 'KVM device',
    description: 'Operations that affect the KVM itself, not the attached host.',
    actions: [
      { id: 'rebootKvm', label: 'Reboot KVM', kind: 'danger' },
      { id: 'rawRpc', label: 'Raw RPC', kind: 'secondary' }
    ]
  }
];

export const QUICK_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Esc', 'F2', 'F10', 'Delete'] as const;
export type QuickKey = (typeof QUICK_KEYS)[number];
