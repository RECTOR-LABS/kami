// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const kitMocks = vi.hoisted(() => ({
  createSolanaRpc: vi.fn((url: string) => ({ __url: url })),
}));

vi.mock('@solana/kit', () => ({
  createSolanaRpc: kitMocks.createSolanaRpc,
}));

import { getRpc } from './connection';

describe('getRpc URL-aware singleton', () => {
  let originalUrl: string | undefined;

  beforeEach(() => {
    kitMocks.createSolanaRpc.mockClear();
    originalUrl = process.env.SOLANA_RPC_URL;
  });

  afterEach(() => {
    if (originalUrl === undefined) {
      delete process.env.SOLANA_RPC_URL;
    } else {
      process.env.SOLANA_RPC_URL = originalUrl;
    }
  });

  it('returns the same instance for repeated calls when URL is unchanged', () => {
    process.env.SOLANA_RPC_URL = 'https://a.example';
    const first = getRpc();
    const second = getRpc();
    expect(first).toBe(second);
  });

  it('recreates the RPC when SOLANA_RPC_URL changes between calls', () => {
    process.env.SOLANA_RPC_URL = 'https://b.example';
    const first = getRpc();
    process.env.SOLANA_RPC_URL = 'https://c.example';
    const second = getRpc();
    expect(first).not.toBe(second);
    expect(kitMocks.createSolanaRpc).toHaveBeenCalledWith('https://c.example');
  });

  it('caches again after a stable third call at the new URL', () => {
    process.env.SOLANA_RPC_URL = 'https://d.example';
    getRpc();
    process.env.SOLANA_RPC_URL = 'https://e.example';
    const second = getRpc();
    const third = getRpc();
    expect(second).toBe(third);
  });
});
