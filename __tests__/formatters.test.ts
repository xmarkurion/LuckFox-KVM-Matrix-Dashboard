import { bytesLabel, percentLabel, statusTone, uptimeLabel, usbLabel, videoLabel } from '../src/services/formatters';

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

  test('bytesLabel formats binary units', () => {
    expect(bytesLabel(1073741824)).toBe('1.0 GB');
  });

  test('percentLabel formats one decimal place when needed', () => {
    expect(percentLabel(12.55)).toBe('12.6%');
  });

  test('uptimeLabel formats days and hours', () => {
    expect(uptimeLabel(90000)).toBe('1d 1h');
  });
});
