import { statusTone, usbLabel, videoLabel } from '../src/services/formatters';

describe('formatters', () => {
  test('statusTone returns good when KVM responds', () => {
    expect(statusTone({ kvmResponds: true, authenticated: true, error: '' })).toBe('good');
  });

  test('statusTone returns bad on error', () => {
    expect(statusTone({ kvmResponds: false, authenticated: false, error: 'offline' })).toBe('bad');
  });

  test('videoLabel describes active HDMI', () => {
    expect(videoLabel({ ready: true, width: 1920, height: 1080, fps: 60 })).toContain('1920×1080');
  });

  test('usbLabel handles raw string states', () => {
    expect(usbLabel('configured')).toBe('configured');
  });
});
