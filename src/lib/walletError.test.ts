import { describe, it, expect } from 'vitest';
import { classifyWalletError } from './walletError';

class WalletSendTransactionError extends Error {
  constructor(message = '') {
    super(message);
    this.name = 'WalletSendTransactionError';
  }
}

describe('classifyWalletError', () => {
  it('classifies explicit user rejection as cancelled', () => {
    const e = new Error('User rejected the request.');
    const r = classifyWalletError(e);
    expect(r.kind).toBe('cancelled');
    expect(r.message).toMatch(/cancelled/i);
  });

  it('classifies silent WalletSendTransactionError as cancelled with dismissed-popup hint', () => {
    const r = classifyWalletError(new WalletSendTransactionError(''));
    expect(r.kind).toBe('cancelled');
    expect(r.hint).toMatch(/popup/i);
  });

  it('classifies blockhash expiry as expired', () => {
    const r = classifyWalletError(new Error('Blockhash expired before confirmation.'));
    expect(r.kind).toBe('expired');
    expect(r.hint).toMatch(/new blockhash/i);
  });

  it('classifies RPC poll timeout as timeout', () => {
    const r = classifyWalletError(new Error('Timed out waiting for confirmation.'));
    expect(r.kind).toBe('timeout');
    expect(r.hint).toMatch(/congested/i);
  });

  it('classifies fetch/network errors as network', () => {
    const r = classifyWalletError(new TypeError('Failed to fetch'));
    expect(r.kind).toBe('network');
    expect(r.hint).toMatch(/connection/i);
  });

  it('classifies insufficient funds explicitly', () => {
    const r = classifyWalletError(new Error('insufficient funds for transaction'));
    expect(r.kind).toBe('insufficient');
    expect(r.hint).toMatch(/SOL|tokens/);
  });

  it('passes unknown errors through with a readable fallback', () => {
    const e = new Error('Something weird');
    e.name = 'StrangeError';
    const r = classifyWalletError(e);
    expect(r.kind).toBe('unknown');
    expect(r.message).toContain('Something weird');
    expect(r.message).toContain('StrangeError');
  });

  it('handles raw strings', () => {
    const r = classifyWalletError('User declined');
    expect(r.kind).toBe('cancelled');
  });

  it('handles null/undefined', () => {
    expect(classifyWalletError(null).kind).toBe('unknown');
    expect(classifyWalletError(undefined).kind).toBe('unknown');
  });
});

describe('dust-floor classification (H3 / Cluster H)', () => {
  it('classifies NetValueRemainingTooSmall as dust-floor', () => {
    const err = new Error(
      'Transaction simulation failed: Error processing Instruction 5: NetValueRemainingTooSmall'
    );
    const r = classifyWalletError(err);
    expect(r.kind).toBe('dust-floor');
    expect(r.message).toMatch(/below the minimum value floor/i);
    expect(r.hint).toMatch(/deposit more|partial repay|kamino ui/i);
  });

  it('classifies 0x17cc custom program error as dust-floor', () => {
    const err = new Error('custom program error: 0x17cc');
    const r = classifyWalletError(err);
    expect(r.kind).toBe('dust-floor');
  });

  it('case-insensitive dust-floor match', () => {
    const err = new Error('NETVALUEREMAININGTOOSMALL: net value 0.001');
    const r = classifyWalletError(err);
    expect(r.kind).toBe('dust-floor');
  });
});

describe('simulation-failed classification (H3 / Cluster H)', () => {
  it('classifies generic simulation-failed', () => {
    const err = new Error('Transaction simulation failed: BlockhashNotFound');
    const r = classifyWalletError(err);
    expect(r.kind).toBe('simulation-failed');
    expect(r.message).toMatch(/would fail on-chain/i);
  });

  it('classifies preflight check failed', () => {
    const err = new Error('Preflight check failed: insufficient compute');
    const r = classifyWalletError(err);
    expect(r.kind).toBe('simulation-failed');
  });
});

describe('WalletSignTransactionError (H3 / Cluster H)', () => {
  it('classifies as cancelled with sign-specific message', () => {
    const err = new Error('User declined');
    err.name = 'WalletSignTransactionError';
    const r = classifyWalletError(err);
    expect(r.kind).toBe('cancelled');
    expect(r.message).toMatch(/declined the sign request/i);
  });
});
