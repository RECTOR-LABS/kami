# Sprint 4.2a — P2 server hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cohere 7 P2 server-side defensive-tweak items into one PR across three sub-themes (concurrency, observability, lifecycle correctness) with TDD discipline on the 4 items that need behavioral coverage.

**Architecture:** One commit per logical change, ordered smallest/lowest-risk → architectural. Tasks 1-3 are single-line additive observability/comment changes (no new tests). Tasks 4-6 add or extend `server/solana/connection.test.ts` and `server/tools/kamino.test.ts` (latter is the FIRST unit test file for the kamino tools module). Task 7 introduces `server/log.ts` plus its own test file and rewires two call sites. All tasks satisfy the same gate set (3 typecheck commands + `pnpm test:run`).

**Tech Stack:** TypeScript, Vitest 4.x with `vi.hoisted()` + `vi.mock()` patterns, `@solana/kit` v2, `@kamino-finance/klend-sdk` 7.3.

**Branch:** `chore/p2-server-hygiene` (already created with the design spec at `d6a0ab1`).

---

## File Structure

| File | Disposition | Tasks | Responsibility |
|---|---|---|---|
| `server/rpc-guards.ts` | Modify | 1 | Add NOTE comment above `oversizedParamsIn` |
| `src/components/SignTransactionCard.tsx` | Modify | 2 | Replace silent catch with `console.warn` |
| `server/tools/kamino.ts` | Modify | 3, 5, 6 | Raw error log + PDA memo + in-flight guard + `_resetCachesForTesting` |
| `server/solana/connection.ts` | Modify | 4 | URL-aware singleton |
| `server/solana/connection.test.ts` | Create | 4 | 3 tests for D-16 |
| `server/tools/kamino.test.ts` | Create (5), Modify (6) | 5, 6 | First kamino unit test file: 2 PDA tests + 3 in-flight tests |
| `server/log.ts` | Create | 7 | New structured logger module |
| `server/log.test.ts` | Create | 7 | 4 tests for D-14 |
| `server/chat.ts` | Modify | 7 | Replace `consoleLogger` with `createLogger()` |
| `api/chat.ts` | Modify | 7 | Replace `console.log('chat:aborted', ...)` with `logger.info(...)` |

**No new modules introduced beyond `server/log.ts`.** All other changes extend existing files.

---

## Task 1: D-20 — NOTE comment on `oversizedParamsIn` shallow-check assumption

**Files:**
- Modify: `server/rpc-guards.ts:33-49`

**No tests** — pure documentation, zero behavior change.

- [ ] **Step 1: Add the NOTE comment block above `oversizedParamsIn`**

In `server/rpc-guards.ts`, locate the line `export function oversizedParamsIn(payload: unknown): string | null {` (currently line 33). Insert this comment block immediately above it:

```typescript
// NOTE: This guard inspects only DIRECT array children of `params`. RPC methods
// that wrap long arrays inside config objects (e.g.,
// `params: [{ accounts: [...100 items...] }]`) would slip through. Today's
// DENIED_METHODS set covers the high-cardinality methods (getProgramAccounts,
// getSignaturesForAddress, etc.); if a new high-cardinality method ships with
// nested array params, audit this function for recursive descent before
// relying on it.
```

The function body itself is unchanged.

- [ ] **Step 2: Run typecheck and tests**

Run:
```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p server/tsconfig.json --noEmit
pnpm test:run
```

Expected: All three commands silent / 150 tests passing (no test count change).

- [ ] **Step 3: Commit**

```bash
git add server/rpc-guards.ts
git commit -m "$(cat <<'EOF'
docs(rpc-guards): NOTE shallow-check contract on oversizedParamsIn

Document the load-bearing assumption that the guard only inspects direct
array children of params. The current DENIED_METHODS set covers today's
high-cardinality surface; this comment marks the audit trigger for any
future method that nests its arrays inside config objects.

Closes #22
EOF
)"
```

---

## Task 2: D-15 — `pollSignatureStatus` warn-log

**Files:**
- Modify: `src/components/SignTransactionCard.tsx:37-39`

**No tests** — UI component has no existing unit coverage by design (browser/wallet integration verified via Chrome MCP smoke); change is purely additive observability.

- [ ] **Step 1: Replace the silent catch with a warn-log**

In `src/components/SignTransactionCard.tsx`, locate the lines:

```typescript
    } catch {
      // transient RPC hiccup — keep polling
    }
```

Replace with:

```typescript
    } catch (err) {
      // Visibility for unexpected RPC errors. Silent swallowing hides programmer
      // bugs (TypeErrors, unbound calls) behind a "transient" lie. Polling
      // continues regardless — POLL_INTERVAL_MS bounds log volume.
      console.warn('[Kami] pollSignatureStatus retry', err);
    }
```

- [ ] **Step 2: Run typecheck and tests**

Run:
```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p server/tsconfig.json --noEmit
pnpm test:run
```

Expected: All three commands silent / 150 tests passing.

- [ ] **Step 3: Commit**

```bash
git add src/components/SignTransactionCard.tsx
git commit -m "$(cat <<'EOF'
fix(sign-tx): warn-log on pollSignatureStatus catch

Empty catch block was swallowing every error in the polling loop, including
programmer errors (TypeErrors, unbound calls) that have nothing to do with
transient RPC failures. Add console.warn so unexpected exceptions surface in
browser logs while polling continues.

Closes #18
EOF
)"
```

---

## Task 3: D-17 — Raw `KaminoAction` build-error log

**Files:**
- Modify: `server/tools/kamino.ts:664-669`

**No tests** — consistent with kamino.ts's mainnet-validated surface; behavior change is purely additive observability.

- [ ] **Step 1: Add the `console.error` call inside the existing catch**

In `server/tools/kamino.ts`, locate the catch block inside `buildPendingTransaction` (currently around lines 664-669):

```typescript
  let kaminoAction: KaminoAction;
  try {
    kaminoAction = await compileKaminoAction(action, mint, amountStr, ownerSigner, market, currentSlot);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Failed to build ${action} transaction: ${message}` };
  }
```

Replace with:

```typescript
  let kaminoAction: KaminoAction;
  try {
    kaminoAction = await compileKaminoAction(action, mint, amountStr, ownerSigner, market, currentSlot);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Server-side triage: keep the raw error and request context. The
    // user-facing message stays scrubbed below.
    console.error('[Kami] KaminoAction build failed', {
      action,
      symbol: input.symbol,
      amount: input.amount,
      wallet,
      err,
    });
    return { ok: false, error: `Failed to build ${action} transaction: ${message}` };
  }
```

- [ ] **Step 2: Run typecheck and tests**

Run:
```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p server/tsconfig.json --noEmit
pnpm test:run
```

Expected: All three commands silent / 150 tests passing.

- [ ] **Step 3: Commit**

```bash
git add server/tools/kamino.ts
git commit -m "$(cat <<'EOF'
fix(kamino): log raw KaminoAction build errors with request context

The catch around compileKaminoAction returns a scrubbed message to the LLM
but loses the raw error and request context server-side, making post-hoc
triage impossible without reproducing. Add a console.error breadcrumb with
action, symbol, amount, wallet, and the full err — the user-facing message
stays unchanged.

Closes #20
EOF
)"
```

---

## Task 4: D-16 — URL-aware `getRpc` singleton (TDD)

**Files:**
- Modify: `server/solana/connection.ts`
- Create: `server/solana/connection.test.ts`

**Pattern:** TDD red → green. Write failing tests first, run to confirm fail, implement, run to pass.

- [ ] **Step 1: Create the failing test file**

Create `server/solana/connection.test.ts` with this content:

```typescript
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
```

- [ ] **Step 2: Run the new tests to confirm they fail**

Run:
```bash
pnpm test:run server/solana/connection.test.ts
```

Expected: 1 of the 3 tests FAILS (the recreate-on-URL-change test). Test 1 (same URL) passes accidentally because the current singleton happens to return the same reference. Test 3 (caches at new URL) also passes accidentally — the singleton holds whatever URL it was first seeded with.

If all 3 pass already, the implementation is already correct and Task 4 is a no-op (unlikely; verify via reading `server/solana/connection.ts`).

- [ ] **Step 3: Implement the URL-aware singleton**

Replace the entire content of `server/solana/connection.ts` with:

```typescript
import { createSolanaRpc, type Rpc, type SolanaRpcApi } from '@solana/kit';

const DEFAULT_RPC = 'https://api.mainnet-beta.solana.com';

let sharedRpc: Rpc<SolanaRpcApi> | null = null;
let sharedRpcUrl: string | null = null;

export function getRpcUrl(): string {
  return process.env.SOLANA_RPC_URL?.trim() || DEFAULT_RPC;
}

export function getRpc(): Rpc<SolanaRpcApi> {
  const currentUrl = getRpcUrl();
  if (sharedRpc && sharedRpcUrl === currentUrl) return sharedRpc;
  sharedRpc = createSolanaRpc(currentUrl);
  sharedRpcUrl = currentUrl;
  return sharedRpc;
}
```

- [ ] **Step 4: Run the new tests to confirm they pass**

Run:
```bash
pnpm test:run server/solana/connection.test.ts
```

Expected: 3/3 tests pass.

- [ ] **Step 5: Run the full gate set**

Run:
```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p server/tsconfig.json --noEmit
pnpm test:run
```

Expected: All commands silent / 153 tests passing across 18 files (was 150 across 17).

- [ ] **Step 6: Commit**

```bash
git add server/solana/connection.ts server/solana/connection.test.ts
git commit -m "$(cat <<'EOF'
fix(connection): URL-aware getRpc singleton

The shared RPC singleton ignored env changes after first call. Track the URL
alongside the singleton; recreate when getRpcUrl() returns a different value.
Adds 3 tests covering: stable URL caches, URL change recreates, and stable
re-cache after change.

@solana/kit's Rpc<SolanaRpcApi> is config-only (no socket pool to leak), so
recreating mid-process drops the stale reference safely.

Closes #19
EOF
)"
```

---

## Task 5: D-18 — Memoize PDA per (market, wallet) (TDD)

**Files:**
- Modify: `server/tools/kamino.ts` (extract `getVanillaPda`, replace direct call in `fetchVanillaObligation`, add `_resetCachesForTesting`)
- Create: `server/tools/kamino.test.ts`

**Pattern:** TDD red → green. Establishes the FIRST kamino test file with `vi.mock('@kamino-finance/klend-sdk', ...)` scaffold. Task 6 reuses this scaffold.

- [ ] **Step 1: Create the failing test file**

Create `server/tools/kamino.test.ts` with this content:

```typescript
// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { address } from '@solana/kit';

const klendMocks = vi.hoisted(() => ({
  toPda: vi.fn(),
  KaminoMarket: { load: vi.fn() },
  PROGRAM_ID: 'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD' as const,
  DEFAULT_RECENT_SLOT_DURATION_MS: 450 as const,
}));

vi.mock('@kamino-finance/klend-sdk', () => ({
  KaminoMarket: klendMocks.KaminoMarket,
  VanillaObligation: vi.fn().mockImplementation(() => ({
    toPda: klendMocks.toPda,
  })),
  PROGRAM_ID: klendMocks.PROGRAM_ID,
  DEFAULT_RECENT_SLOT_DURATION_MS: klendMocks.DEFAULT_RECENT_SLOT_DURATION_MS,
}));

import { _resetCachesForTesting, getVanillaPda } from './kamino';

const MARKET = address('7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF');
const WALLET_A = address('FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr');
const WALLET_B = address('11111111111111111111111111111111');

describe('getVanillaPda memoization', () => {
  beforeEach(() => {
    _resetCachesForTesting();
    klendMocks.toPda.mockReset();
    klendMocks.toPda.mockImplementation(async (m: string, w: string) =>
      address(`${m.slice(0, 4)}-${w.slice(0, 4)}-pda1234567890123456789012345678901`),
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
});
```

- [ ] **Step 2: Run the new tests to confirm they fail**

Run:
```bash
pnpm test:run server/tools/kamino.test.ts
```

Expected: TypeScript compile error / import failure on `_resetCachesForTesting` and `getVanillaPda` (neither is exported yet from `kamino.ts`).

- [ ] **Step 3: Modify `server/tools/kamino.ts` — add cache, helper, exports**

Open `server/tools/kamino.ts`. Locate the section near line 64 with `const MARKET_CACHE_TTL_MS = 30_000;`. Below the existing market cache fields, add the PDA cache:

```typescript
const MARKET_CACHE_TTL_MS = 30_000;
let cachedMarket: KaminoMarket | null = null;
let marketLoadedAt = 0;

const pdaCache = new Map<string, Promise<Address>>();

export function getVanillaPda(market: Address, wallet: Address): Promise<Address> {
  const key = `${market}:${wallet}`;
  let promise = pdaCache.get(key);
  if (!promise) {
    promise = new VanillaObligation(PROGRAM_ID).toPda(market, wallet);
    pdaCache.set(key, promise);
  }
  return promise;
}
```

Locate `fetchVanillaObligation` (currently around line 146-152). Replace the direct PDA derivation with the new helper:

```typescript
async function fetchVanillaObligation(
  market: KaminoMarket,
  wallet: Address
): Promise<KaminoObligation | null> {
  const vanillaPda = await getVanillaPda(market.getAddress(), wallet);
  return market.getObligationByAddress(vanillaPda);
}
```

At the bottom of the file (after the last existing export), add the test-only reset helper:

```typescript
/** For tests only — clears module-scope caches so unit tests start clean.
 *  Throws when invoked outside `NODE_ENV === 'test'` (matches D-21 pattern). */
export function _resetCachesForTesting(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('_resetCachesForTesting may only be called when NODE_ENV === "test"');
  }
  cachedMarket = null;
  marketLoadedAt = 0;
  pdaCache.clear();
}
```

- [ ] **Step 4: Run the new tests to confirm they pass**

Run:
```bash
pnpm test:run server/tools/kamino.test.ts
```

Expected: 2/2 tests pass.

- [ ] **Step 5: Run the full gate set**

Run:
```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p server/tsconfig.json --noEmit
pnpm test:run
```

Expected: All commands silent / 155 tests passing across 19 files (was 153 across 18).

- [ ] **Step 6: Commit**

```bash
git add server/tools/kamino.ts server/tools/kamino.test.ts
git commit -m "$(cat <<'EOF'
perf(kamino): memoize vanilla obligation PDA per (market, wallet)

PDA derivation is deterministic from inputs and was being recomputed on every
fetchVanillaObligation call (getPortfolio, simulateHealth, etc.). Add a
process-local Map<string, Promise<Address>> keyed by ${market}:${wallet}.

Establishes server/tools/kamino.test.ts as the first unit test file for the
kamino tools module. Also adds _resetCachesForTesting() (NODE_ENV === 'test'
guarded, mirrors the D-21 pattern) so future kamino tests start clean.

Closes #21
EOF
)"
```

---

## Task 6: D-8 — In-flight promise guard on `getMarket` cache (TDD)

**Files:**
- Modify: `server/tools/kamino.ts:64-81` (add `loadingPromise` field, rewrite `getMarket`, extend `_resetCachesForTesting`)
- Modify: `server/tools/kamino.ts` (export `getMarket`)
- Modify: `server/tools/kamino.test.ts` (extend with 3 D-8 tests)

**Pattern:** TDD red → green. Reuses kamino.test.ts scaffold from Task 5.

- [ ] **Step 1: Add the failing tests to `server/tools/kamino.test.ts`**

Open `server/tools/kamino.test.ts`. Append these imports + describe block to the bottom of the file (the existing `getVanillaPda memoization` describe block stays unchanged):

```typescript
import { getMarket } from './kamino';

describe('getMarket in-flight guard', () => {
  beforeEach(() => {
    _resetCachesForTesting();
    klendMocks.KaminoMarket.load.mockReset();
  });

  it('triggers a single load when called concurrently from a cold cache', async () => {
    const fakeMarket = { getAddress: () => 'market-pda' };
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
    const fakeMarket = { getAddress: () => 'market-pda' };
    klendMocks.KaminoMarket.load.mockResolvedValue(fakeMarket);

    await getMarket();
    await getMarket();
    await getMarket();

    expect(klendMocks.KaminoMarket.load).toHaveBeenCalledTimes(1);
  });

  it('clears the in-flight promise on rejection so the next call can retry', async () => {
    klendMocks.KaminoMarket.load
      .mockRejectedValueOnce(new Error('rpc went sideways'))
      .mockResolvedValueOnce({ getAddress: () => 'market-pda' });

    await expect(getMarket()).rejects.toThrow('rpc went sideways');

    const market = await getMarket();
    expect(market).toBeDefined();
    expect(klendMocks.KaminoMarket.load).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run the new tests to confirm they fail**

Run:
```bash
pnpm test:run server/tools/kamino.test.ts
```

Expected: TypeScript compile error / import failure on `getMarket` (currently not exported). After exporting (next step) but before the implementation change, all 3 tests fail because:
- Test 1 (concurrent): `KaminoMarket.load` called 5 times instead of 1 (current TTL-only cache).
- Test 2 (cached): passes already (TTL cache works for sequential calls).
- Test 3 (rejection retry): may pass or fail depending on whether the existing implementation lets `load()` throw and the second call retries naturally — likely fails if the error path corrupts state.

- [ ] **Step 3: Modify `server/tools/kamino.ts` — add `loadingPromise`, rewrite `getMarket`, extend reset, export**

Open `server/tools/kamino.ts`. Locate the cache fields (currently around lines 64-66):

```typescript
const MARKET_CACHE_TTL_MS = 30_000;
let cachedMarket: KaminoMarket | null = null;
let marketLoadedAt = 0;
```

Add a new field below them:

```typescript
const MARKET_CACHE_TTL_MS = 30_000;
let cachedMarket: KaminoMarket | null = null;
let marketLoadedAt = 0;
let loadingPromise: Promise<KaminoMarket> | null = null;
```

Locate `getMarket` (currently `async function getMarket(): Promise<KaminoMarket>` around lines 68-81). Replace the entire function with:

```typescript
export async function getMarket(): Promise<KaminoMarket> {
  const now = Date.now();
  if (cachedMarket && now - marketLoadedAt < MARKET_CACHE_TTL_MS) {
    return cachedMarket;
  }
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    try {
      const rpc = getRpc();
      const market = await KaminoMarket.load(rpc, KAMINO_MAIN_MARKET, DEFAULT_RECENT_SLOT_DURATION_MS);
      if (!market) {
        throw new Error(`Failed to load Kamino main market ${KAMINO_MAIN_MARKET}`);
      }
      cachedMarket = market;
      marketLoadedAt = Date.now();
      return market;
    } finally {
      loadingPromise = null;
    }
  })();
  return loadingPromise;
}
```

(Note: `getMarket` is now `export`ed — it was previously private.)

Locate `_resetCachesForTesting` (added in Task 5, at the bottom of the file). Extend the body to clear `loadingPromise`:

```typescript
export function _resetCachesForTesting(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('_resetCachesForTesting may only be called when NODE_ENV === "test"');
  }
  cachedMarket = null;
  marketLoadedAt = 0;
  loadingPromise = null;
  pdaCache.clear();
}
```

- [ ] **Step 4: Run the new tests to confirm they pass**

Run:
```bash
pnpm test:run server/tools/kamino.test.ts
```

Expected: 5/5 tests pass (2 PDA from Task 5 + 3 in-flight new).

- [ ] **Step 5: Run the full gate set**

Run:
```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p server/tsconfig.json --noEmit
pnpm test:run
```

Expected: All commands silent / 158 tests passing across 19 files (was 155 across 19 — same file count; +3 tests in existing kamino.test.ts).

- [ ] **Step 6: Commit**

```bash
git add server/tools/kamino.ts server/tools/kamino.test.ts
git commit -m "$(cat <<'EOF'
fix(kamino): in-flight guard on getMarket concurrent loads

Cold-cache concurrent callers triggered N independent KaminoMarket.load()
calls. Add loadingPromise field; concurrent callers await the same in-flight
promise, cleared via finally so both resolve and reject paths reset.

Tests cover the 3 reachable states: 5 concurrent calls share 1 load, cache
hit short-circuits, rejection clears the in-flight promise so the next call
retries cleanly.

Closes #16
EOF
)"
```

---

## Task 7: D-14 — Structured logger module + plumb into `chat.ts` and `api/chat.ts` (TDD)

**Files:**
- Create: `server/log.ts`
- Create: `server/log.test.ts`
- Modify: `server/chat.ts` (replace `consoleLogger` with `createLogger()`)
- Modify: `api/chat.ts` (replace `console.log('chat:aborted', ...)` with `logger.info(...)`)

**Pattern:** TDD red → green for the new module; the two callsite changes are mechanical follow-ups.

- [ ] **Step 1: Create the failing test file**

Create `server/log.test.ts` with this content:

```typescript
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createLogger } from './log';

describe('createLogger', () => {
  let log: ReturnType<typeof createLogger>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    log = createLogger();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errSpy.mockRestore();
  });

  it('emits a single-line, parseable JSON object with ISO-8601 ts', () => {
    log.info({ wallet: 'abc', requestId: 'r-1' }, 'tool:invoke');

    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = logSpy.mock.calls[0][0] as string;
    expect(line.includes('\n')).toBe(false);
    const parsed = JSON.parse(line);
    expect(parsed).toMatchObject({
      level: 'info',
      msg: 'tool:invoke',
      wallet: 'abc',
      requestId: 'r-1',
    });
    expect(parsed.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('routes info and warn to console.log; error to console.error', () => {
    log.info({}, 'i');
    log.warn({}, 'w');
    log.error({}, 'e');

    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(errSpy).toHaveBeenCalledTimes(1);

    const errLine = errSpy.mock.calls[0][0] as string;
    expect(JSON.parse(errLine).level).toBe('error');
  });

  it('reserved fields (ts, level, msg) cannot be overridden by caller', () => {
    log.info({ ts: 'hijacked', level: 'fake', msg: 'fake-msg' }, 'real-msg');

    const line = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(line);
    expect(parsed.msg).toBe('real-msg');
    expect(parsed.level).toBe('info');
    expect(parsed.ts).not.toBe('hijacked');
  });

  it('preserves nested object and array fields', () => {
    log.info({ tool: 'getPortfolio', stats: { count: 3, items: ['a', 'b'] } }, 'snapshot');

    const line = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(line);
    expect(parsed.tool).toBe('getPortfolio');
    expect(parsed.stats).toEqual({ count: 3, items: ['a', 'b'] });
  });
});
```

- [ ] **Step 2: Run the new tests to confirm they fail**

Run:
```bash
pnpm test:run server/log.test.ts
```

Expected: Module-not-found error on `./log` (file doesn't exist yet).

- [ ] **Step 3: Implement `server/log.ts`**

Create `server/log.ts` with this content:

```typescript
export interface Logger {
  info: (fields: Record<string, unknown>, msg: string) => void;
  warn: (fields: Record<string, unknown>, msg: string) => void;
  error: (fields: Record<string, unknown>, msg: string) => void;
}

function emit(
  stream: 'log' | 'error',
  level: 'info' | 'warn' | 'error',
  fields: Record<string, unknown>,
  msg: string,
): void {
  // Reserved fields (ts, level, msg) come AFTER spread so caller-supplied
  // fields cannot override them — blocks log injection at the smallest surface.
  const line = JSON.stringify({ ...fields, ts: new Date().toISOString(), level, msg });
  if (stream === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

export function createLogger(): Logger {
  return {
    info: (fields, msg) => emit('log', 'info', fields, msg),
    warn: (fields, msg) => emit('log', 'warn', fields, msg),
    error: (fields, msg) => emit('error', 'error', fields, msg),
  };
}
```

- [ ] **Step 4: Run the new tests to confirm they pass**

Run:
```bash
pnpm test:run server/log.test.ts
```

Expected: 4/4 tests pass.

- [ ] **Step 5: Replace `consoleLogger` in `server/chat.ts` with `createLogger()`**

Open `server/chat.ts`. Locate the import block at the top (currently lines 1-13). Add a new import for the logger factory:

```typescript
import { createLogger } from './log.js';
```

Locate the `consoleLogger` constant (currently lines 25-28):

```typescript
const consoleLogger: ChatLogger = {
  info: (obj, msg) => console.log(msg, obj),
  error: (obj, msg) => console.error(msg, obj),
};
```

Replace it with:

```typescript
const defaultLogger = createLogger();
```

Locate the `createChatStream` signature (currently around line 109-114). Update the default-parameter reference:

```typescript
export function createChatStream(
  input: ChatInput,
  apiKey: string,
  log: ChatLogger = defaultLogger,
  signal?: AbortSignal,
): ReadableStream<Uint8Array> {
```

(The `ChatLogger` interface itself stays unchanged — `Logger` is a structural superset, so `defaultLogger` satisfies the `ChatLogger` parameter type.)

- [ ] **Step 6: Replace inline `console.log('chat:aborted', ...)` in `api/chat.ts`**

Open `api/chat.ts`. Locate the import block at the top (currently lines 1-5). Add a new import for the logger factory:

```typescript
import { createLogger } from '../server/log.js';
```

Below the existing constants near the top of the file (after `const CHAT_RATE_LIMIT = ...` at line 7), add a module-level logger:

```typescript
const logger = createLogger();
```

Locate the `req.on('close', ...)` listener (currently lines 120-125):

```typescript
  req.on('close', () => {
    if (!res.writableEnded) {
      controller.abort();
      console.log('chat:aborted', { wallet: walletAddress ?? null });
    }
  });
```

Replace with:

```typescript
  req.on('close', () => {
    if (!res.writableEnded) {
      controller.abort();
      logger.info({ wallet: walletAddress ?? null }, 'chat:aborted');
    }
  });
```

- [ ] **Step 7: Run the full gate set**

Run:
```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p server/tsconfig.json --noEmit
pnpm test:run
```

Expected: All commands silent / 162 tests passing across 20 files (was 158 across 19 — adds `server/log.test.ts` with 4 tests).

- [ ] **Step 8: Commit**

```bash
git add server/log.ts server/log.test.ts server/chat.ts api/chat.ts
git commit -m "$(cat <<'EOF'
feat(log): structured JSON logger for production handler events

Replace consoleLogger in server/chat.ts and the inline console.log call in
api/chat.ts with a tiny createLogger() factory that emits one JSON line per
call. Vercel's log explorer parses JSON-shaped lines into queryable fields;
opaque human-readable strings were unparseable.

Reserved fields (ts, level, msg) come AFTER the caller-fields spread so
caller-supplied keys cannot hijack them — blocks log injection at the
smallest surface. info/warn route to stdout, error to stderr.

ChatLogger interface in server/chat.ts is unchanged; the new Logger type is a
structural superset (adds warn) so defaultLogger satisfies it.

Closes #17
EOF
)"
```

---

## Final verification — full PR readiness

- [ ] **Step 1: Verify the 7-commit shape**

Run:
```bash
git log --oneline main..HEAD
```

Expected output (commit hashes will differ):
```
<hash> feat(log): structured JSON logger for production handler events
<hash> fix(kamino): in-flight guard on getMarket concurrent loads
<hash> perf(kamino): memoize vanilla obligation PDA per (market, wallet)
<hash> fix(connection): URL-aware getRpc singleton
<hash> fix(kamino): log raw KaminoAction build errors with request context
<hash> fix(sign-tx): warn-log on pollSignatureStatus catch
<hash> docs(rpc-guards): NOTE shallow-check contract on oversizedParamsIn
<hash> docs(spec): add Sprint 4.2a P2 server hygiene design
```

(8 commits total: 1 spec + 7 implementation.)

- [ ] **Step 2: Run the full gate set one more time**

Run:
```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p server/tsconfig.json --noEmit
pnpm test:run
```

Expected: silent / silent / 162 tests passing across 20 files.

- [ ] **Step 3: Push branch and open PR**

```bash
git push -u origin chore/p2-server-hygiene
gh pr create --title "chore: P2 server hygiene — concurrency, observability, lifecycle correctness" --body "$(cat <<'EOF'
## Summary

Sprint 4.2a — clears 7 of the 9 P2 items in `qa-2026-04-26` backlog (UI sub-cluster #23 + #24 deferred to Sprint 4.2b).

Three sub-themes:

- **Concurrency:** `loadingPromise` field on `getMarket` cache (concurrent cold-cache callers share one `KaminoMarket.load()`); PDA memoization per `(market, wallet)` (eliminates redundant cryptographic derivation across `getPortfolio`/`simulateHealth`).
- **Observability:** structured JSON logger (`server/log.ts`); raw `KaminoAction` build errors now hit server logs with request context; `pollSignatureStatus` no longer silently swallows programmer errors; `MAX_PARAMS_ARRAY_LENGTH` shallow-check assumption documented.
- **Lifecycle:** `getRpc` singleton recreates on `SOLANA_RPC_URL` change.

## Test plan

- 12 new tests across 3 new files (`server/solana/connection.test.ts`, `server/tools/kamino.test.ts`, `server/log.test.ts`)
- `pnpm test:run`: 150 → 162 across 17 → 20 files
- TDD red → green on the 4 tested items (D-16, D-18, D-8, D-14)
- Manual smoke post-deploy: confirm Vercel function logs now parse as JSON in the dashboard log explorer

Closes #16
Closes #17
Closes #18
Closes #19
Closes #20
Closes #21
Closes #22
EOF
)"
```

- [ ] **Step 4: Watch CI**

Run:
```bash
gh pr checks --watch
```

Expected: green across `test`, `mirror-gitlab`, and any other configured checks.

- [ ] **Step 5: Tick umbrella issue #3's P2 row after PR merges**

After merge, edit `gh issue view 3` to tick `#16-#22` checkboxes in the P2 section. The handoff for Sprint 4.2b notes the UI sub-cluster (#23 + #24) is deferred.

---

## Notes for the executing engineer

- **`pnpm exec tsc -b` does NOT validate `server/tsconfig.json`.** Always run all 3 typecheck commands separately. (Memory: `tsc-b-skips-server-tsconfig.md`.)
- **`Array.prototype.at()` does NOT work in `src/`** (ES2020 lib target). Use `arr[arr.length - 1]`. (Memory: `array-at-es2020-trap.md`.) None of the current tasks need this — flagged for awareness only.
- **`vi.hoisted()` is the established mock pattern.** Don't switch to bare `const` for shared mock state. (Memory: `vitest-vi-hoisted-convention.md`.)
- **HEREDOC commit messages** per global CLAUDE.md. No AI attribution in any commit, comment, or PR body.
- **One commit per logical change.** Each task ends in exactly one commit. If a task fails the gate set, fix and re-stage before committing — do NOT amend the prior task's commit.
- **Tasks 5 and 6 share the same test file.** Task 5 creates `server/tools/kamino.test.ts`. Task 6 appends a new describe block to it. The file should be staged in both commits.
