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

// ---------------------------------------------------------------------------
// preflightSimulate structured outcome — H2 / Cluster H
// ---------------------------------------------------------------------------

describe('preflightSimulate structured outcome (H2 / Cluster H)', () => {
  // Helper: create a mock RPC where simulateTransaction returns the given logs
  const mockRpcWithSimLogs = (logs: string[], err: unknown = { InstructionError: [5, 'Custom'] }) => ({
    getBalance: () => ({
      send: async () => ({ value: 1_000_000_000n }),
    }),
    simulateTransaction: () => ({
      send: async () => ({
        value: { err, logs },
      }),
    }),
  });

  it('returns errorCode "dust-floor" when logs contain NetValueRemainingTooSmall', async () => {
    const { preflightSimulate } = await import('./kamino');
    const rpc = mockRpcWithSimLogs([
      'Program log: Instruction: Repay',
      'Program log: AnchorError occurred. Error Code: NetValueRemainingTooSmall',
    ]);
    const r = await preflightSimulate(rpc as any, 'base64-tx' as any, 'wallet' as any, 'repay', 'SOL', 0.018);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errorCode).toBe('dust-floor');
    expect(r.context).toBeDefined();
    expect(r.suggestedAlternatives).toContain('partial-repay-leave-dust');
  });

  it('returns errorCode "dust-floor" when logs contain custom program error 0x17cc', async () => {
    const { preflightSimulate } = await import('./kamino');
    const rpc = mockRpcWithSimLogs([
      'Program log: Instruction: Withdraw',
      'Program XYZ failed: custom program error: 0x17cc',
    ]);
    const r = await preflightSimulate(rpc as any, 'base64-tx' as any, 'wallet' as any, 'withdraw', 'USDC', 5);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errorCode).toBe('dust-floor');
  });

  it('suggests add-collateral-then-retry for full repay intent', async () => {
    const { preflightSimulate } = await import('./kamino');
    const rpc = mockRpcWithSimLogs([
      'Program log: AnchorError occurred. Error Code: NetValueRemainingTooSmall',
    ]);
    const r = await preflightSimulate(rpc as any, 'base64-tx' as any, 'wallet' as any, 'repay', 'SOL', 0.018);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.suggestedAlternatives).toContain('add-collateral-then-retry');
    expect(r.suggestedAlternatives).toContain('kamino-ui-repay-max');
  });

  it('suggests repay-borrow-first for withdraw intent on dust-floor', async () => {
    const { preflightSimulate } = await import('./kamino');
    const rpc = mockRpcWithSimLogs([
      'Program log: AnchorError occurred. Error Code: NetValueRemainingTooSmall',
    ]);
    const r = await preflightSimulate(rpc as any, 'base64-tx' as any, 'wallet' as any, 'withdraw', 'USDC', 6);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.suggestedAlternatives).toContain('repay-borrow-first');
  });

  it('returns errorCode "simulation-failed" for non-dust generic failure', async () => {
    const { preflightSimulate } = await import('./kamino');
    const rpc = mockRpcWithSimLogs([
      'Program XYZ failed: BlockhashNotFound',
    ]);
    const r = await preflightSimulate(rpc as any, 'base64-tx' as any, 'wallet' as any, 'deposit', 'USDC', 1);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errorCode).toBe('simulation-failed');
    expect(r.context.failingLog).toContain('BlockhashNotFound');
  });

  it('returns errorCode "insufficient-sol" when balance is below tx-fee floor', async () => {
    const { preflightSimulate } = await import('./kamino');
    const rpc = {
      getBalance: () => ({ send: async () => ({ value: 5_000n }) }),
      simulateTransaction: () => ({ send: async () => ({ value: { err: null, logs: [] } }) }),
    };
    const r = await preflightSimulate(rpc as any, 'base64-tx' as any, 'wallet' as any, 'deposit', 'USDC', 1);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errorCode).toBe('insufficient-sol');
  });

  it('returns ok:true with no errorCode when simulation passes', async () => {
    const { preflightSimulate } = await import('./kamino');
    const rpc = {
      getBalance: () => ({ send: async () => ({ value: 1_000_000_000n }) }),
      simulateTransaction: () => ({ send: async () => ({ value: { err: null, logs: ['ok'] } }) }),
    };
    const r = await preflightSimulate(rpc as any, 'base64-tx' as any, 'wallet' as any, 'deposit', 'USDC', 1);
    expect(r.ok).toBe(true);
    // structured branches should NOT exist on ok:true outcomes
    expect((r as any).errorCode).toBeUndefined();
  });
});
