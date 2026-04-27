# D-13 Oracle-Staleness Gate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface oracle freshness on `findYield` and `getPortfolio` tool outputs, and instruct the LLM to flag stale rows with ⚠️ in markdown tables.

**Architecture:** A pure helper `computeStaleness(reserve, currentSlot)` derives `{ priceStale, slotsSinceRefresh }` from `reserve.state.lastUpdate.slot` against a 150-slot threshold (~60s). Both `YieldOpportunity` and `PortfolioPosition` gain the two fields; both call sites spread the helper output into their row objects. The LLM system prompt picks up a one-rule update.

**Tech Stack:** Node.js 24 (Vercel Function runtime), `@kamino-finance/klend-sdk` 7.3 on `@solana/kit` v2, `bn.js` for `BN` slot arithmetic, Vitest 4.x for unit tests.

**Spec:** `docs/superpowers/specs/2026-04-27-d13-oracle-staleness-design.md`

**Branch:** `feat/d13-oracle-staleness-gate`

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `server/tools/kamino.ts` | Modify | Add `STALENESS_THRESHOLD_SLOTS` constant + `computeStaleness` helper (exported); extend `YieldOpportunity` and `PortfolioPosition` interfaces with `priceStale: boolean` + `slotsSinceRefresh: number`; spread helper output at the `findYield` and `mapPositions` call sites. |
| `server/prompt.ts` | Modify | Add one rule line under "Numbers from tools are live mainnet values" instructing the LLM to prepend ⚠️ to stale rows in markdown tables and add a one-sentence footer. |
| `server/tools/kamino.test.ts` | Create | New unit-test file for the `kamino.ts` module. 4 tests covering `computeStaleness` (fresh, stale, threshold-boundary, clock-skew clamp). First test file for `kamino.ts` (currently the un-mocked surface per `CLAUDE.md`). |

`server/index.ts` (Fastify dev) and `api/chat.ts` are **unchanged**. Total diff: ~25 LOC additions in production files + ~50 LOC test additions. Three commits.

---

## Task 1: TDD the helper — `computeStaleness`

**Files:**
- Create: `server/tools/kamino.test.ts` (new file)
- Modify: `server/tools/kamino.ts` (add constant + exported helper)

- [ ] **Step 1: Create `server/tools/kamino.test.ts` with 4 unit tests**

Create `server/tools/kamino.test.ts`:

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

- [ ] **Step 2: Run new tests — verify FAIL**

```bash
pnpm exec vitest run server/tools/kamino.test.ts
```

Expected: import error or 4 failures because `computeStaleness` is not yet exported from `./kamino`.

- [ ] **Step 3: Add the constant + helper in `server/tools/kamino.ts`**

In `server/tools/kamino.ts`, find the existing `toNumber` helper (around line 79). Add the constant + `computeStaleness` helper IMMEDIATELY AFTER `toNumber`. The intended insertion point sits between `toNumber` and the `mapPositions` function. Add:

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

Notes:
- `KaminoReserve` is already imported elsewhere in the file (used by `mapPositions`); no new import needed.
- `BN` is part of `reserve.state.lastUpdate.slot` already; no new import needed in production code.

- [ ] **Step 4: Run new tests — verify PASS**

```bash
pnpm exec vitest run server/tools/kamino.test.ts
```

Expected: 4/4 PASS.

- [ ] **Step 5: Run full type-check + test suite**

```bash
pnpm exec tsc -b && pnpm test:run
```

Expected: zero TypeScript errors. **138/138 tests passing across 16 files** (was 134; +4 from the new file).

- [ ] **Step 6: Commit**

```bash
git add server/tools/kamino.ts server/tools/kamino.test.ts
git commit -m "$(cat <<'EOF'
feat(kamino): add computeStaleness helper

Pure helper derives { priceStale, slotsSinceRefresh } from
reserve.state.lastUpdate.slot vs currentSlot using a 150-slot threshold
(~60s, Solana DeFi convention). Negative slot diffs clamped to 0
(RPC clock-skew defense). 4 unit tests in new server/tools/kamino.test.ts.

The handoff flagged reserve.getReserveOracleStatus() as unverified —
verified via klend-sdk source: that method does NOT exist; slot-age is
the canonical signal.
EOF
)"
```

---

## Task 2: Surface staleness on `findYield` + `getPortfolio` rows

**Files:**
- Modify: `server/tools/kamino.ts` (extend interfaces + spread helper output at 2 call sites)

- [ ] **Step 1: Extend `YieldOpportunity` interface**

In `server/tools/kamino.ts`, find the existing `YieldOpportunity` interface (around line 201). Add two new fields after `marketPriceUsd`:

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
  priceStale: boolean;
  slotsSinceRefresh: number;
}
```

- [ ] **Step 2: Extend `PortfolioPosition` interface**

In `server/tools/kamino.ts`, find the existing `PortfolioPosition` interface (around line 38). Add two new fields after `apyPercent`:

```ts
export interface PortfolioPosition {
  symbol: string;
  mint: string;
  reserve: string;
  amount: number;
  valueUsd: number;
  apyPercent: number;
  priceStale: boolean;
  slotsSinceRefresh: number;
}
```

- [ ] **Step 3: Spread `computeStaleness` into the `findYield` row push**

In `server/tools/kamino.ts`, find the existing `opportunities.push({...})` call inside `findYield` (around lines 246-256). Replace that push with:

```ts
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
```

- [ ] **Step 4: Spread `computeStaleness` into the `mapPositions` row push (with reserve-undefined guard)**

In `server/tools/kamino.ts`, find the existing `out.push({...})` call inside `mapPositions` (around lines 99-106). The existing handler already guards `reserve: KaminoReserve | undefined` because some obligations may reference reserves that have been removed. Add a ternary fallback for the missing-reserve case. Replace the for-of body:

```ts
for (const [, pos] of positions) {
  const reserve: KaminoReserve | undefined = market.getReserveByAddress(pos.reserveAddress);
  const symbol = reserve?.getTokenSymbol() ?? 'UNKNOWN';
  const tokenAmount = pos.amount.div(pos.mintFactor);
  const apy = reserve
    ? kind === 'supply'
      ? reserve.totalSupplyAPY(currentSlot)
      : reserve.totalBorrowAPY(currentSlot)
    : 0;
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
}
```

- [ ] **Step 5: Run type-check + full test suite**

```bash
pnpm exec tsc -b && pnpm test:run
```

Expected: zero TypeScript errors (interface extensions match call-site spreads). **138/138 tests passing** — no test changes, but full compile + run must succeed.

- [ ] **Step 6: Commit**

```bash
git add server/tools/kamino.ts
git commit -m "$(cat <<'EOF'
feat(kamino): surface priceStale on yield + portfolio rows

Extends YieldOpportunity and PortfolioPosition interfaces with
priceStale: boolean and slotsSinceRefresh: number. findYield spreads
computeStaleness into each row; mapPositions does the same with a
ternary fallback for the existing reserve-undefined edge case
(obligations referencing deleted reserves).
EOF
)"
```

---

## Task 3: Update LLM system prompt

**Files:**
- Modify: `server/prompt.ts` (one rule expanded)

- [ ] **Step 1: Update the "Numbers from tools" rule**

In `server/prompt.ts`, find the existing line:

```
- Numbers from tools are live mainnet values. Quote them verbatim.
```

Replace it with:

```
- Numbers from tools are live mainnet values. Quote them verbatim.
- If a yield or portfolio row has `priceStale: true`, prepend ⚠️ to that row in markdown tables and add a one-sentence footer like "Note: rows marked ⚠️ have oracle data > 60s old; numbers may lag the current market." Still quote the numbers — do NOT refuse the request.
```

The exact insertion is one new line immediately after the existing one. Both lines start with `- ` and continue the bulleted-rules style of the surrounding prompt.

- [ ] **Step 2: Run type-check + full test suite**

```bash
pnpm exec tsc -b && pnpm test:run
```

Expected: zero TypeScript errors. **138/138 tests passing** — no test changes; the prompt is a string and not directly tested.

- [ ] **Step 3: Commit**

```bash
git add server/prompt.ts
git commit -m "$(cat <<'EOF'
feat(prompt): flag stale oracle rows in markdown tables

Adds one rule under the existing "Numbers from tools are live mainnet
values" line. When findYield or getPortfolio returns a row with
priceStale: true, the LLM prepends ⚠️ to that row and adds a single-
sentence footer note. Numbers are still quoted — no refusal — to
preserve the demo flow while surfacing the safety signal.
EOF
)"
```

---

## Final verification

- [ ] **Final type-check + full suite + build**

```bash
pnpm exec tsc -b && pnpm test:run && pnpm build
```

Expected:
- `pnpm exec tsc -b`: zero errors.
- `pnpm test:run`: 138/138 across 16 files.
- `pnpm build`: vite + tsc -b success; bundle size near current ~616 kB main.

- [ ] **Push branch + open PR**

```bash
git push -u origin feat/d13-oracle-staleness-gate
gh pr create --title "feat(chat): D-13 oracle-staleness gate on findYield/getPortfolio" --body "$(cat <<'EOF'
## Summary

Closes #7. Sprint 2.2 of Chunk 2 (per `docs/superpowers/specs/2026-04-26-qa-backlog-roadmap-design.md`).

`reserve.getOracleMarketPrice()` returns the cached oracle price from the last `RefreshReserve`. If the underlying oracle has gone stale (Scope down, Pyth/Switchboard outage, no recent on-chain activity), users see numbers presented as live when they may be minutes old. This PR surfaces oracle freshness per row and instructs the LLM to flag stale rows with ⚠️ — while still quoting the numbers, to keep the demo flowing.

## API ground truth (verified)

The QA report flagged `reserve.getReserveOracleStatus()` as unverified. **Confirmed: that method does NOT exist** in `@kamino-finance/klend-sdk` 7.3. Verified ground truth via `node_modules/.../klend/types/LastUpdate.d.ts` and `dist/classes/reserve.d.ts`:

- `reserve.state.lastUpdate.slot: BN` — last refresh slot (canonical signal we use)
- `reserve.state.lastUpdate.stale: number` — transaction-level flag, NOT useful here
- `reserve.state.lastUpdate.priceStatus: number` — undocumented enum, skipped

We compute `slotsSinceRefresh = Number(currentSlot) - lastUpdate.slot.toNumber()` and gate on `> 150` slots (~60s @ 400ms/slot, matching Pyth/Switchboard convention).

## Changes

- `server/tools/kamino.ts`: new exported helper `computeStaleness(reserve, currentSlot)` returning `{ priceStale, slotsSinceRefresh }`. `YieldOpportunity` and `PortfolioPosition` extended with the two fields. `findYield` and `mapPositions` spread the helper output into their row pushes (with `mapPositions` ternary fallback for the existing reserve-undefined edge case).
- `server/prompt.ts`: one rule added under "Numbers from tools are live mainnet values" instructing the LLM to prepend ⚠️ to stale rows in markdown tables + add a one-sentence footer. Still quotes numbers.
- `server/tools/kamino.test.ts` (new file): 4 unit tests for `computeStaleness` covering fresh / stale / threshold-boundary / clock-skew-clamp paths. First test file for `kamino.ts` (the un-mocked surface per `CLAUDE.md`).

## Spec + plan

- Spec: `docs/superpowers/specs/2026-04-27-d13-oracle-staleness-design.md`
- Plan: `docs/superpowers/plans/2026-04-27-d13-oracle-staleness-implementation.md`

## Test plan

- [x] `pnpm exec tsc -b` clean
- [x] `pnpm test:run` — 138/138 passing across 16 files
- [x] Per-task spec compliance review ✅ (Task 1, 2, 3)
- [x] Per-task code quality review ✅ (Task 1, 2, 3)
- [x] Final cluster review verdict
- [ ] Manual smoke (post-merge prod): query "best USDC yield" — confirm rows include `priceStale: false` for active reserves; spot-check a low-traffic reserve to verify `priceStale: true` after sustained inactivity. Also verify the LLM renders ⚠️ + footer when stale data appears.
EOF
)"
```

- [ ] **Wait for CI + merge with `--merge` (keep branches)**

```bash
gh pr checks --watch
gh pr merge --merge
```

- [ ] **Production smoke + close umbrella checkbox**

After Vercel auto-deploys main:

```bash
# Quick health check
curl -sS -X POST https://kami.rectorspace.com/api/rpc \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' -D - | head -5

# Manual smoke in real browser, watch for priceStale field in tool output
gh issue list --label qa-2026-04-26 --state open --limit 30  # expect 23 open (was 24)
gh issue view 3   # ensure #7 ticked in umbrella
```

---

## Self-review

**Spec coverage:**
- ✅ Problem framing → reflected in PR body + Task 1 commit message.
- ✅ API ground truth verification → spec section preserved + Task 1 commit message references it.
- ✅ Architecture diagram → reflected in code changes across Tasks 1, 2, 3.
- ✅ `computeStaleness` helper + constant → Task 1 Step 3.
- ✅ `YieldOpportunity` extension → Task 2 Step 1.
- ✅ `PortfolioPosition` extension → Task 2 Step 2.
- ✅ `findYield` call site spread → Task 2 Step 3.
- ✅ `mapPositions` call site spread (with reserve-undefined guard) → Task 2 Step 4.
- ✅ LLM prompt update → Task 3 Step 1.
- ✅ 4 unit tests → Task 1 Step 1.
- ✅ Coverage delta 134 → 138 → confirmed in Task 1 Step 5 + final verification.
- ✅ Acceptance criteria checklist → Final verification + PR test plan.
- ✅ `simulateHealth` left unchanged per scope → not modified in any task.

**Placeholder scan:** No TBD/TODO/"add appropriate handling"/"similar to Task N". All steps have actual code.

**Type consistency:** `computeStaleness(reserve: KaminoReserve, currentSlot: bigint): { priceStale: boolean; slotsSinceRefresh: number }` declared in Task 1 Step 3, called in Task 2 Step 3 + Step 4 with the same shape. `STALENESS_THRESHOLD_SLOTS = 150` declared in Task 1, used in `> 150` test boundary in Task 1 Step 1 (Test 3) and reflected in Task 1 Step 3 implementation. `priceStale: boolean` and `slotsSinceRefresh: number` field names consistent across interfaces (Task 2 Step 1, 2) and the helper return shape (Task 1 Step 3).
