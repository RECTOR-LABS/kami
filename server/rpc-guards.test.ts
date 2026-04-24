import { describe, it, expect } from 'vitest';
import {
  deniedMethodIn,
  oversizedParamsIn,
  MAX_BATCH_SIZE,
  MAX_PARAMS_ARRAY_LENGTH,
} from './rpc-guards';

describe('deniedMethodIn', () => {
  it('returns the method name when a single call uses a denied method', () => {
    expect(deniedMethodIn({ jsonrpc: '2.0', id: 1, method: 'getProgramAccounts' })).toBe(
      'getProgramAccounts',
    );
  });

  it('returns null for allowed methods', () => {
    expect(deniedMethodIn({ jsonrpc: '2.0', id: 1, method: 'getHealth' })).toBeNull();
  });

  it('scans batch arrays and flags the first denied method', () => {
    const batch = [
      { jsonrpc: '2.0', id: 1, method: 'getHealth' },
      { jsonrpc: '2.0', id: 2, method: 'getBlock' },
    ];
    expect(deniedMethodIn(batch)).toBe('getBlock');
  });

  it('returns null for batches of allowed methods', () => {
    const batch = [
      { jsonrpc: '2.0', id: 1, method: 'getHealth' },
      { jsonrpc: '2.0', id: 2, method: 'getBalance' },
    ];
    expect(deniedMethodIn(batch)).toBeNull();
  });

  it('tolerates malformed payloads', () => {
    expect(deniedMethodIn(null)).toBeNull();
    expect(deniedMethodIn(undefined)).toBeNull();
    expect(deniedMethodIn('not an object')).toBeNull();
    expect(deniedMethodIn({ method: 42 })).toBeNull();
  });
});

describe('oversizedParamsIn', () => {
  it('returns null for small single calls', () => {
    expect(oversizedParamsIn({ method: 'getBalance', params: ['addr'] })).toBeNull();
  });

  it('returns null when the params array is exactly at the limit', () => {
    const params = [new Array(MAX_PARAMS_ARRAY_LENGTH).fill('addr')];
    expect(oversizedParamsIn({ method: 'getMultipleAccounts', params })).toBeNull();
  });

  it('flags params arrays over the limit', () => {
    const params = [new Array(MAX_PARAMS_ARRAY_LENGTH + 1).fill('addr')];
    const result = oversizedParamsIn({ method: 'getMultipleAccounts', params });
    expect(result).toBe(
      `params array length ${MAX_PARAMS_ARRAY_LENGTH + 1} exceeds limit of ${MAX_PARAMS_ARRAY_LENGTH}`,
    );
  });

  it('flags batches over the size limit before scanning params', () => {
    const batch = new Array(MAX_BATCH_SIZE + 1).fill({ method: 'getBalance' });
    const result = oversizedParamsIn(batch);
    expect(result).toBe(
      `batch of ${MAX_BATCH_SIZE + 1} calls exceeds limit of ${MAX_BATCH_SIZE}`,
    );
  });

  it('returns null for batches at the size limit with well-formed params', () => {
    const batch = new Array(MAX_BATCH_SIZE).fill({ method: 'getBalance', params: ['addr'] });
    expect(oversizedParamsIn(batch)).toBeNull();
  });

  it('scans params inside a batch for oversize arrays', () => {
    const batch = [
      { method: 'getBalance', params: ['addr'] },
      { method: 'getMultipleAccounts', params: [new Array(MAX_PARAMS_ARRAY_LENGTH + 5).fill('addr')] },
    ];
    const result = oversizedParamsIn(batch);
    expect(result).toContain('exceeds limit');
  });

  it('tolerates malformed payloads', () => {
    expect(oversizedParamsIn(null)).toBeNull();
    expect(oversizedParamsIn(undefined)).toBeNull();
    expect(oversizedParamsIn({ method: 'getBalance', params: 'not-an-array' })).toBeNull();
    expect(oversizedParamsIn({ method: 'getBalance' })).toBeNull();
  });
});
