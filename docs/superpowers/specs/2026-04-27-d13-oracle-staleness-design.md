# D-13 — Oracle-staleness gate on findYield / getPortfolio

**Date:** 2026-04-27
**Issue:** [#7 — Oracle-staleness gate on findYield/getPortfolio output](https://github.com/RECTOR-LABS/kami/issues/7)
**Priority:** P0 (`qa-2026-04-26`)
**Sprint:** 2.2 (Chunk 2 — Test/Abort/Safety Extensions, Option C ordering: D-12 → **D-13** → D-11)
**Estimate:** 2-4h
**Branch:** `feat/d13-oracle-staleness-gate`

---

## Problem

`reserve.getOracleMarketPrice()` returns the cached oracle price from the last `RefreshReserve` call. If the underlying oracle has gone stale (Scope down, Pyth/Switchboard validator outage, simply no recent on-chain activity for that reserve), the user sees yield/portfolio numbers presented as live mainnet values when they may be minutes or hours old. The current LLM system prompt (`server/prompt.ts:13`) instructs: *"Numbers from tools are live mainnet values. Quote them verbatim."*

For the Eitherway-Kamino bounty judging, this is a reputation/trust risk. Judges will probe what happens when oracle data is stale — and getting "live" numbers that aren't actually live is a poor signal for a DeFi co-pilot.

## Scope

**In scope** (per brainstorm: `(a) 150 slots + (b-rich) + (c-warn)`):

- Add a pure helper `computeStaleness(reserve, currentSlot)` in `server/tools/kamino.ts` that returns `{ priceStale: boolean; slotsSinceRefresh: number }` based on a 150-slot threshold (~60s @ 400ms/slot).
- Surface both fields per row in `findYield` (extends `YieldOpportunity`) and `mapPositions` (extends `PortfolioPosition`).
- Update LLM system prompt to instruct: when `priceStale: true`, prepend `⚠️` to the table row and add a one-sentence footer note. Quote numbers verbatim — do NOT refuse.
- Add 4 unit tests in a new `server/tools/kamino.test.ts` covering the helper's threshold logic, boundary, stale path, and clock-skew clamp.

**Out of scope** (explicitly deferred):

- Apply staleness check to `simulateHealth` — depends on config (LTV thresholds), not market-stale oracle prices.
- UI badges for stale rows — markdown emoji is sufficient for D-13; future UI sprint.
- `priceStatus` enum interpretation — klend-sdk doesn't export enum values; slot-age is the canonical fallback.
- Per-reserve or env-configurable threshold — global constant for hackathon scope.
- Integration tests for `findYield` / `mapPositions` with stale reserves — those handlers are mainnet-validated per existing convention; unit-testing the pure helper is sufficient.

## Verified API ground truth

The handoff flagged `reserve.getReserveOracleStatus()` as unverified. **Confirmed: that method does NOT exist.** Verified via `node_modules/@kamino-finance/klend-sdk/dist/`:

| Field | Type | What it means |
|---|---|---|
| `reserve.state.lastUpdate.slot` | `BN` | Last slot when reserve was refreshed (`.toNumber()` to convert) |
| `reserve.state.lastUpdate.stale` | `number` (0/1) | **Transaction-level** flag — set when state-changing ix touches reserve, cleared on refresh. Always 0 outside a transaction. **NOT useful for our case.** |
| `reserve.state.lastUpdate.priceStatus` | `number` | Enum status of prices used in last update. Values not exported in TypeScript. **Skip.** |

**Canonical computable signal:**
```ts
const slotsSinceRefresh = Number(currentSlot) - reserve.state.lastUpdate.slot.toNumber();
const priceStale = slotsSinceRefresh > 150;
```

**Threshold rationale (150 slots ≈ 60s):** aligns with Solana DeFi convention. Pyth's `STALE_PRICE_AGE_SECONDS` defaults to 60s; Switchboard recommends 30-60s. 60 slots is too aggressive (false-positives on idle off-peak reserves); 300 slots only catches catastrophic outages.

## Architecture

```
findYield (kamino.ts:246)     mapPositions (kamino.ts:99)        computeStaleness (new helper)
─────────────────────         ─────────────────────────         ─────────────────────────────
per reserve in market         per position in obligation        input: KaminoReserve, bigint
  → computeStaleness          → computeStaleness                output: { priceStale, slotsSinceRefresh }
  → spread into row             → spread into row               logic: Number(currentSlot) -
                                                                          reserve.state.lastUpdate.slot.toNumber()
                                                                        priceStale = slotsSince > 150
                                                                        slotsSinceRefresh clamped to ≥ 0

server/prompt.ts updated rule
─────────────────────────────
"If priceStale: true, prepend ⚠️ to row + footer note. Still quote numbers."
```

### Key design decisions

1. **One helper, exported for tests.** Matches `toNumber`, `computeUtilizationPercent`, `computeHealthFactor` precedent in the same file.
2. **Threshold = `STALENESS_THRESHOLD_SLOTS = 150`** as a top-level constant. Tunable via single edit; no env override (YAGNI for hackathon).
3. **Negative `slotsSinceRefresh` clamped to 0** — handles RPC clock skew where reserve refresh slot is ahead of `currentSlot` we just fetched.
4. **`priceStale` boolean is what the LLM gates on; `slotsSinceRefresh` is for transparency** (ops debugging, future UI badges, optional LLM-quoted freshness).
5. **No `simulateHealth` changes.** Out of scope — depends on config (LTV thresholds), not market-stale oracle prices.

## Code changes

### `server/tools/kamino.ts` — 4 surgical changes

**Change 1: add constant + helper (around line 79, near other helpers):**

```ts
const STALENESS_THRESHOLD_SLOTS = 150;  // ~60s @ ~400ms/slot — Solana DeFi convention (Pyth, Switchboard)

export function computeStaleness(
  reserve: KaminoReserve,
  currentSlot: bigint,
): { priceStale: boolean; slotsSinceRefresh: number } {
  const lastSlot = reserve.state.lastUpdate.slot.toNumber();
  const slotsSinceRefresh = Math.max(0, Number(currentSlot) - lastSlot);
  return {
    priceStale: slotsSinceRefresh > STALENESS_THRESHOLD_SLOTS,
    slotsSinceRefresh,
  };
}
```

**Change 2: extend `YieldOpportunity` (line 201-211):**

```ts
export interface YieldOpportunity {
  symbol: string;
  mint: string;
  reserve: string;
  side: 'supply' | 'borrow';
  apyPercent: number;
  ltvRatio: number;
  liquidationLtv: number;
  utilizationPercent: number;
  marketPriceUsd: number;
  priceStale: boolean;          // NEW
  slotsSinceRefresh: number;    // NEW
}
```

**Change 3: extend `PortfolioPosition` (line 38-45):**

```ts
export interface PortfolioPosition {
  symbol: string;
  mint: string;
  reserve: string;
  amount: number;
  valueUsd: number;
  apyPercent: number;
  priceStale: boolean;          // NEW
  slotsSinceRefresh: number;    // NEW
}
```

**Change 4: spread staleness into both call sites:**

```ts
// findYield (line 246-256)
opportunities.push({
  symbol,
  mint: reserve.stats.mintAddress,
  reserve: reserve.address,
  side,
  apyPercent: apy * 100,
  ltvRatio: reserve.stats.loanToValue,
  liquidationLtv: reserve.stats.liquidationThreshold,
  utilizationPercent: computeUtilizationPercent(reserve),
  marketPriceUsd: toNumber(reserve.getOracleMarketPrice()),
  ...computeStaleness(reserve, currentSlot),
});

// mapPositions (line 99-106)
const staleness = reserve
  ? computeStaleness(reserve, currentSlot)
  : { priceStale: false, slotsSinceRefresh: 0 };
out.push({
  symbol,
  mint: pos.mintAddress,
  reserve: pos.reserveAddress,
  amount: toNumber(tokenAmount),
  valueUsd: toNumber(pos.marketValueRefreshed),
  apyPercent: Number.isFinite(apy) ? apy * 100 : 0,
  ...staleness,
});
```

### `server/prompt.ts` — one rule expanded

Replace the existing line 13:
```
- Numbers from tools are live mainnet values. Quote them verbatim.
```

With:
```
- Numbers from tools are live mainnet values. Quote them verbatim.
- If a yield or portfolio row has `priceStale: true`, prepend ⚠️ to that row in markdown tables and add a one-sentence footer like "Note: rows marked ⚠️ have oracle data > 60s old; numbers may lag the current market." Still quote the numbers — do NOT refuse the request.
```

## Testing

### `server/tools/kamino.test.ts` — new file, 4 unit tests

```ts
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

  it('returns priceStale=true for a stale reserve (200 slots old)', () => {
    const r = reserveAt(800);
    expect(computeStaleness(r, BASELINE_SLOT)).toEqual({
      priceStale: true,
      slotsSinceRefresh: 200,
    });
  });

  it('returns priceStale=false at the exact threshold (150 slots old) — uses > not >=', () => {
    const r = reserveAt(850);
    expect(computeStaleness(r, BASELINE_SLOT)).toEqual({
      priceStale: false,
      slotsSinceRefresh: 150,
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
```

### Why no integration test for `findYield` / `mapPositions`

Those handlers are mainnet-validated per CLAUDE.md (kamino.ts is the un-mocked surface). Mock-driven integration would require fake `KaminoMarket.load()` + fake reserves — low ROI. The new fields appear in tool output via type system at compile time. Manual smoke (post-merge) verifies in production.

### Coverage delta

| Suite | Before | After |
|---|---|---|
| Total tests | 134 | **138** |
| Test files | 15 | **16** |
| `server/tools/kamino.test.ts` tests | 0 | 4 |

## Edge cases

| Edge case | Handling |
|---|---|
| `BN.toNumber()` overflow | Solana slot counts (~290M as of 2026) are far below 2^53. Safe for centuries. |
| Negative `slotsSinceRefresh` from RPC clock skew | Clamped to 0 via `Math.max(0, ...)`. Test 4 enforces. |
| Reserve with no `state.lastUpdate` | Anchor schema makes `lastUpdate` non-optional. TypeScript catches mismatches at compile time. |
| `currentSlot` = bigint vs number | `Number(currentSlot)` conversion is safe for slot range. |
| `reserve` undefined in `mapPositions` | Existing handler already guards `KaminoReserve | undefined`. Ternary fallback `{ priceStale: false, slotsSinceRefresh: 0 }` for the missing-reserve case. |
| LLM doesn't always render ⚠️ | Best-effort prompt compliance; the boolean is in the data and visible to judges/devs. Acceptable trade-off — non-deterministic LLM output is a known property. |
| `react-markdown` rendering ⚠️ in tables | Renders correctly as inline emoji; no special handler needed. |
| Test stub `as unknown as KaminoReserve` | Stub bypasses full type check at construction. The helper itself is type-checked against the real `KaminoReserve` import — any klend-sdk shape change breaks compilation of the helper, not the stub. |

## Non-goals — explicitly deferred

| Item | Where it goes |
|---|---|
| Apply staleness to `simulateHealth` | Future iteration if real demand emerges. simulateHealth is a "hypothetical" computation; LTV thresholds it depends on are config, not market-stale. |
| UI badges for stale rows | Future UI sprint can add tooltip / colored badge. Markdown ⚠️ is sufficient for D-13. |
| `priceStatus` enum interpretation | klend-sdk doesn't export enum values. Slot-age is the canonical fallback. |
| Per-reserve / env-configurable threshold | Global `STALENESS_THRESHOLD_SLOTS = 150` for hackathon scope. |
| Integration tests for `findYield` / `mapPositions` | Validated via mainnet per existing project convention. |

## Acceptance criteria

- [ ] `pnpm exec tsc -b` clean.
- [ ] `pnpm test:run` — 138/138 passing across 16 files.
- [ ] All 4 `computeStaleness` unit tests pass.
- [ ] `findYield` tool output includes `priceStale` and `slotsSinceRefresh` per row.
- [ ] `getPortfolio` tool output includes `priceStale` and `slotsSinceRefresh` per `deposits[]` and `borrows[]` row.
- [ ] LLM system prompt updated with the new staleness rule.
- [ ] Manual smoke (post-merge prod): query `findYield` for "best USDC yield" — confirm rows include `priceStale: false` for active reserves; spot-check that a low-traffic reserve (if any) returns `priceStale: true` after a few minutes of inactivity.
- [ ] Issue #7 closed by the merge commit (via `Closes #7` in PR body).

## Risks

- **Threshold mis-tuned for production:** 150 slots may be too aggressive or too lenient depending on real reserve refresh patterns. Mitigation: it's a one-line edit; can tune post-deploy based on observed false-positive / false-negative rates from Vercel logs and judge feedback.
- **LLM compliance is non-deterministic:** the LLM may occasionally fail to render `⚠️` or omit the footer. Mitigation: the boolean is in the data; judges inspecting tool output will see the gate is real.
- **`reserve.state` shape change in future klend-sdk version:** breaking change would surface as TypeScript error in the helper at compile time. Mitigation: pin guard CI workflow already locks klend-sdk to current major. Manual upgrade required for breaking-change adoption.

## Acceptance — done when

> "Would this survive a security audit?" Yes — read-only computation, no new attack surface.
> "Would I deploy this to mainnet tonight?" Yes — pure helper with unit tests; LLM prompt change is reversible by editing one string.
> "Will the next developer understand why I made these choices?" The constant + threshold + helper signature are self-documenting; this spec records the API verification trail (`getReserveOracleStatus` does not exist; we use slot-age) for future archaeologists.
