import { describe, it, expect } from 'vitest';

// Pure helper extracted from useChat's toolResult handler logic.
// Imported here so we can test the mapping without the full streaming machinery.
import { mapToolResultStatus } from './useChat';

describe('mapToolResultStatus', () => {
  it('returns "wallet-required" when output.code is WALLET_NOT_CONNECTED', () => {
    expect(mapToolResultStatus({ ok: false, error: 'x', code: 'WALLET_NOT_CONNECTED' }))
      .toBe('wallet-required');
  });

  it('returns "wallet-required" when output.code is INVALID_WALLET', () => {
    expect(mapToolResultStatus({ ok: false, error: 'x', code: 'INVALID_WALLET' }))
      .toBe('wallet-required');
  });

  it('returns "error" when output.ok is false without a code', () => {
    expect(mapToolResultStatus({ ok: false, error: 'rpc died' }))
      .toBe('error');
  });

  it('returns "error" when output.ok is false with a non-wallet code', () => {
    expect(mapToolResultStatus({ ok: false, error: 'x', code: 'STALE_ORACLE' }))
      .toBe('error');
  });

  it('returns "done" when output.ok is true', () => {
    expect(mapToolResultStatus({ ok: true, data: { foo: 1 } }))
      .toBe('done');
  });
});
