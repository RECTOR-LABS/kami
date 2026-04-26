import { describe, it, expect } from 'vitest';
import { assertWallet } from './wallet.js';
import type { ToolContext } from './types.js';

describe('assertWallet', () => {
  it('returns WALLET_NOT_CONNECTED when walletAddress is null', () => {
    const ctx: ToolContext = { walletAddress: null };
    const result = assertWallet(ctx);
    expect('wallet' in result).toBe(false);
    if ('wallet' in result) return;
    expect(result.ok).toBe(false);
    expect(result.code).toBe('WALLET_NOT_CONNECTED');
    expect(result.error).toContain('Solflare');
    expect(result.error).not.toContain('Phantom');
  });

  it('returns the parsed Address when walletAddress is a valid bs58 pubkey', () => {
    const ctx: ToolContext = {
      walletAddress: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
    };
    const result = assertWallet(ctx);
    expect('wallet' in result).toBe(true);
    if (!('wallet' in result)) return;
    expect(typeof result.wallet).toBe('string');
    expect(result.wallet).toBe('FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr');
  });

  it('returns INVALID_WALLET when walletAddress is malformed', () => {
    const ctx: ToolContext = { walletAddress: 'not-a-real-address' };
    const result = assertWallet(ctx);
    expect('wallet' in result).toBe(false);
    if ('wallet' in result) return;
    expect(result.ok).toBe(false);
    expect(result.code).toBe('INVALID_WALLET');
    expect(result.error).toContain('Invalid wallet address');
    expect(result.error).toContain('not-a-real-address');
  });
});
