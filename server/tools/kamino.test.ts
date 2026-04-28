// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import BN from 'bn.js';
import { address } from '@solana/kit';

const klendMocks = vi.hoisted(() => ({
  toPda: vi.fn(),
  KaminoMarket: { load: vi.fn() },
  PROGRAM_ID: 'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD' as const,
  DEFAULT_RECENT_SLOT_DURATION_MS: 450 as const,
}));

vi.mock('@kamino-finance/klend-sdk', () => ({
  KaminoMarket: klendMocks.KaminoMarket,
  VanillaObligation: vi.fn().mockImplementation(function () {
    return { toPda: klendMocks.toPda };
  }),
  PROGRAM_ID: klendMocks.PROGRAM_ID,
  DEFAULT_RECENT_SLOT_DURATION_MS: klendMocks.DEFAULT_RECENT_SLOT_DURATION_MS,
}));

import { computeStaleness, _resetCachesForTesting, getVanillaPda, getMarket } from './kamino';
import type { KaminoReserve } from '@kamino-finance/klend-sdk';

// ---------------------------------------------------------------------------
// computeStaleness — pure unit tests (no klend-sdk runtime needed)
// ---------------------------------------------------------------------------

const BASELINE_SLOT = 1000n;

function reserveAt(slot: number): KaminoReserve {
  return {
    state: { lastUpdate: { slot: new BN(slot) } },
  } as unknown as KaminoReserve;
}

describe('computeStaleness', () => {
  it('returns priceStale=false for a fresh reserve (50 slots old)', () => {
    const r = reserveAt(950);
    expect(computeStaleness(r, BASELINE_SLOT)).toEqual({
      priceStale: false,
      slotsSinceRefresh: 50,
    });
  });

  it('returns priceStale=true for a stale reserve (700 slots old)', () => {
    const r = reserveAt(300);
    expect(computeStaleness(r, BASELINE_SLOT)).toEqual({
      priceStale: true,
      slotsSinceRefresh: 700,
    });
  });

  it('returns priceStale=false at the exact threshold (600 slots old) — uses > not >=', () => {
    const r = reserveAt(400);
    expect(computeStaleness(r, BASELINE_SLOT)).toEqual({
      priceStale: false,
      slotsSinceRefresh: 600,
    });
  });

  it('clamps negative slot diffs to 0 (RPC clock skew defense)', () => {
    const r = reserveAt(1010);
    expect(computeStaleness(r, BASELINE_SLOT)).toEqual({
      priceStale: false,
      slotsSinceRefresh: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// getVanillaPda memoization
// ---------------------------------------------------------------------------

const MARKET = address('7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF');
const WALLET_A = address('FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr');
const WALLET_B = address('11111111111111111111111111111111');

describe('getVanillaPda memoization', () => {
  beforeEach(() => {
    _resetCachesForTesting();
    klendMocks.toPda.mockReset();
    klendMocks.toPda.mockImplementation(async (m: string, w: string) =>
      // Return a deterministic fake PDA string (not validated as base58 — type cast is safe here
      // because Address is a branded string and we only check referential equality in these tests)
      `${m.slice(0, 4)}-${w.slice(0, 4)}-pda1234567890123456789012345678901` as ReturnType<typeof address>,
    );
  });

  it('memoizes PDA computation per (market, wallet) pair', async () => {
    const pda1 = await getVanillaPda(MARKET, WALLET_A);
    const pda2 = await getVanillaPda(MARKET, WALLET_A);
    const pda3 = await getVanillaPda(MARKET, WALLET_A);

    expect(pda1).toBe(pda2);
    expect(pda1).toBe(pda3);
    expect(klendMocks.toPda).toHaveBeenCalledTimes(1);
  });

  it('computes a separate PDA for a different wallet', async () => {
    await getVanillaPda(MARKET, WALLET_A);
    await getVanillaPda(MARKET, WALLET_B);
    await getVanillaPda(MARKET, WALLET_A); // re-fetch — should hit cache

    expect(klendMocks.toPda).toHaveBeenCalledTimes(2);
    expect(klendMocks.toPda).toHaveBeenNthCalledWith(1, MARKET, WALLET_A);
    expect(klendMocks.toPda).toHaveBeenNthCalledWith(2, MARKET, WALLET_B);
  });

  it('evicts the cache entry when the underlying toPda call rejects', async () => {
    const error = new Error('SDK rejected');
    klendMocks.toPda.mockRejectedValueOnce(error);

    await expect(getVanillaPda(MARKET, WALLET_A)).rejects.toThrow('SDK rejected');

    // Next call should NOT return the rejected promise — it should retry.
    klendMocks.toPda.mockResolvedValueOnce(
      'retry-success-pda' as ReturnType<typeof address>,
    );
    const retryPda = await getVanillaPda(MARKET, WALLET_A);
    expect(retryPda).toBe('retry-success-pda');
    expect(klendMocks.toPda).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// getMarket in-flight guard
// ---------------------------------------------------------------------------

import type { KaminoMarket } from '@kamino-finance/klend-sdk';

describe('getMarket in-flight guard', () => {
  beforeEach(() => {
    _resetCachesForTesting();
    klendMocks.KaminoMarket.load.mockReset();
  });

  it('triggers a single load when called concurrently from a cold cache', async () => {
    const fakeMarket = { getAddress: () => 'market-pda' } as unknown as KaminoMarket;
    let resolveLoad: ((m: unknown) => void) | undefined;
    klendMocks.KaminoMarket.load.mockImplementation(
      () => new Promise((resolve) => { resolveLoad = resolve; }),
    );

    const calls = Promise.all([getMarket(), getMarket(), getMarket(), getMarket(), getMarket()]);
    // Allow the microtask queue to drain so each caller registers on loadingPromise
    await new Promise((r) => setTimeout(r, 0));
    resolveLoad!(fakeMarket);
    const results = await calls;

    for (const m of results) {
      expect(m).toBe(fakeMarket);
    }
    expect(klendMocks.KaminoMarket.load).toHaveBeenCalledTimes(1);
  });

  it('returns cached market within TTL without calling load() again', async () => {
    const fakeMarket = { getAddress: () => 'market-pda' } as unknown as KaminoMarket;
    klendMocks.KaminoMarket.load.mockResolvedValue(fakeMarket);

    await getMarket();
    await getMarket();
    await getMarket();

    expect(klendMocks.KaminoMarket.load).toHaveBeenCalledTimes(1);
  });

  it('clears the in-flight promise on rejection so the next call can retry', async () => {
    klendMocks.KaminoMarket.load
      .mockRejectedValueOnce(new Error('rpc went sideways'))
      .mockResolvedValueOnce({ getAddress: () => 'market-pda' } as unknown as KaminoMarket);

    await expect(getMarket()).rejects.toThrow('rpc went sideways');

    const market = await getMarket();
    expect(market).toBeDefined();
    expect(klendMocks.KaminoMarket.load).toHaveBeenCalledTimes(2);
  });
});
