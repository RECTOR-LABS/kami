// @vitest-environment node
import { describe, it, expect } from 'vitest';
import BN from 'bn.js';
import { computeStaleness } from './kamino';
import type { KaminoReserve } from '@kamino-finance/klend-sdk';

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
