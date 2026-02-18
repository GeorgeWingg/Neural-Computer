import { describe, expect, it } from 'vitest';
import { normalizeRuntimeBootstrapStatus } from '../services/runtimeBootstrapService';

describe('runtime bootstrap service', () => {
  it('normalizes camelCase payload fields', () => {
    const result = normalizeRuntimeBootstrapStatus({
      available: true,
      status: 'ready',
      launchMode: 'sidecar',
      checkedAtMs: 1700000000000,
    });

    expect(result.available).toBe(true);
    expect(result.status).toBe('ready');
    expect(result.launchMode).toBe('sidecar');
    expect(result.checkedAtMs).toBe(1700000000000);
  });

  it('normalizes snake_case payload fields', () => {
    const result = normalizeRuntimeBootstrapStatus({
      available: false,
      status: 'error',
      launch_mode: 'fallback-node',
      checked_at_ms: 1700000001111,
      message: 'runtime unavailable',
    });

    expect(result.available).toBe(false);
    expect(result.status).toBe('error');
    expect(result.launchMode).toBe('fallback-node');
    expect(result.checkedAtMs).toBe(1700000001111);
    expect(result.message).toBe('runtime unavailable');
  });

  it('uses fallback message and safe defaults for malformed input', () => {
    const result = normalizeRuntimeBootstrapStatus({ available: false }, 'fallback runtime error');

    expect(result.available).toBe(false);
    expect(result.status).toBe('error');
    expect(result.launchMode).toBe('unknown');
    expect(result.message).toBe('fallback runtime error');
    expect(Number.isFinite(result.checkedAtMs)).toBe(true);
  });
});
