import { describe, it, expect } from 'vitest';
import {
  disallowedMethodIn,
  oversizedParamsIn,
  ALLOWED_METHODS,
  MAX_BATCH_SIZE,
  MAX_PARAMS_ARRAY_LENGTH,
} from './rpc-guards';

describe('disallowedMethodIn', () => {
  it('returns null for an allowlisted method', () => {
    expect(disallowedMethodIn({ jsonrpc: '2.0', id: 1, method: 'getHealth' })).toBeNull();
  });

  it('returns the method name when an arbitrary (non-allowlisted) method is used', () => {
    expect(disallowedMethodIn({ jsonrpc: '2.0', id: 1, method: 'getProgramAccounts' })).toBe(
      'getProgramAccounts',
    );
  });

  it('returns the method name for newly-shipped Solana RPC methods (drift safety)', () => {
    // Hypothetical future method — the allowlist explicitly opts in, so an
    // unknown method 403s by default rather than silently relaying.
    expect(disallowedMethodIn({ jsonrpc: '2.0', id: 1, method: 'getFutureBlockchainSomething' })).toBe(
      'getFutureBlockchainSomething',
    );
  });

  it('scans batch arrays and flags the first disallowed method', () => {
    const batch = [
      { jsonrpc: '2.0', id: 1, method: 'getHealth' },
      { jsonrpc: '2.0', id: 2, method: 'getProgramAccounts' },
    ];
    expect(disallowedMethodIn(batch)).toBe('getProgramAccounts');
  });

  it('returns null for batches of allowlisted methods', () => {
    const batch = [
      { jsonrpc: '2.0', id: 1, method: 'getHealth' },
      { jsonrpc: '2.0', id: 2, method: 'getBalance' },
    ];
    expect(disallowedMethodIn(batch)).toBeNull();
  });

  it('tolerates malformed payloads', () => {
    expect(disallowedMethodIn(null)).toBeNull();
    expect(disallowedMethodIn(undefined)).toBeNull();
    expect(disallowedMethodIn('not an object')).toBeNull();
    expect(disallowedMethodIn({ method: 42 })).toBeNull();
  });
});

describe('ALLOWED_METHODS membership', () => {
  it('includes every method the app actually uses', () => {
    // This list is the contract — if the app starts using a new RPC method,
    // add it here AND to ALLOWED_METHODS in rpc-guards.ts.
    const expected = [
      'getHealth',
      'getLatestBlockhash',
      'simulateTransaction',
      'sendTransaction',
      'getSignatureStatuses',
      'getBlockHeight',
      'getMinimumBalanceForRentExemption',
      'getBalance',
      'getAccountInfo',
      'getMultipleAccounts',
    ];
    for (const method of expected) {
      expect(ALLOWED_METHODS.has(method)).toBe(true);
    }
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
