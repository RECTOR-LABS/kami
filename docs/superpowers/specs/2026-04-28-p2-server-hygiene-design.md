# Sprint 4.2a — P2 server hygiene: concurrency, observability, lifecycle correctness

**Date:** 2026-04-28
**Issues:**
- [#16 — D-8 In-flight promise guard on `getMarket` cache](https://github.com/RECTOR-LABS/kami/issues/16)
- [#17 — D-14 Structured-log adapter for production handler](https://github.com/RECTOR-LABS/kami/issues/17)
- [#18 — D-15 Narrow `pollSignatureStatus` catch + warn-log](https://github.com/RECTOR-LABS/kami/issues/18)
- [#19 — D-16 Reset-on-env-change for `getRpc` singleton](https://github.com/RECTOR-LABS/kami/issues/19)
- [#20 — D-17 Log raw `KaminoAction` errors with request context](https://github.com/RECTOR-LABS/kami/issues/20)
- [#21 — D-18 Memoize PDA per (market, wallet)](https://github.com/RECTOR-LABS/kami/issues/21)
- [#22 — D-20 Document `MAX_PARAMS_ARRAY_LENGTH` shallow-check assumption](https://github.com/RECTOR-LABS/kami/issues/22)

**Priority:** P2 (`qa-2026-04-26`)
**Sprint:** 4.2a (priority-based cluster — P2 server-hygiene sub-cluster, 7 of 9 P2 items; UI sub-cluster #23/#24 deferred to Sprint 4.2b)
**Estimate:** ~6-10h walltime; per-item range <1h to 2h
**Branch:** `chore/p2-server-hygiene`

---

## Problem

Seven server-side defensive-tweak items survived earlier sprints because each is below the bar for a standalone PR. The items partition cleanly into three sub-themes — **concurrency** (D-8, D-18), **observability** (D-14, D-15, D-17, D-20), and **lifecycle correctness** (D-16) — and all touch the production request path at low blast radius. Cohering them as one cluster matches Sprint 4.1's polish-cluster precedent.

**D-8 (#16) — `getMarket` thrashes under concurrent cold loads.** `server/tools/kamino.ts:64-81` uses TTL-based caching (30 s window). When the cache is cold or expired and N requests arrive in the same tick, all N trigger `KaminoMarket.load()` independently. Each load is a multi-RPC fetch. Solution: a separate `loadingPromise` field that concurrent callers await, cleared on resolution and rejection so the next caller can retry after a failure.

**D-14 (#17) — Production logs are unstructured `console.log` lines.** `server/chat.ts:25-28`'s `consoleLogger` and `api/chat.ts:123`'s inline `console.log('chat:aborted', ...)` emit human-readable lines. Vercel's log explorer parses JSON-shaped lines into queryable fields; bare `console.log` calls land as opaque strings. Solution: a tiny `server/log.ts` exporting `createLogger()` that emits one JSON line per call with reserved fields (`ts`, `level`, `msg`) hardened against caller injection.

**D-15 (#18) — `pollSignatureStatus` swallows every error silently.** `src/components/SignTransactionCard.tsx:37-39` has an empty `catch {}` block on the polling loop. The intent is "tolerate transient RPC hiccups", but the current shape also swallows programmer errors (TypeErrors, unbound calls, syntax-time bugs) and unexpected exceptions, leaving them invisible to the production console. Solution: `console.warn` the caught error so the polling continues but the symptom surfaces in browser logs.

**D-16 (#19) — `getRpc` singleton ignores env changes after first call.** `server/solana/connection.ts:5-15` caches the first-created RPC instance forever. If `SOLANA_RPC_URL` changes mid-process (test fixtures, hot reload, env mutation), subsequent `getRpc()` calls return the stale-URL client. The bug surfaces in tests and any future env-driven failover scenario. Solution: track the URL alongside the singleton; recreate when `getRpcUrl()` returns a different value.

**D-17 (#20) — `KaminoAction` build failures lose request context server-side.** `server/tools/kamino.ts:664-669` catches errors from `compileKaminoAction` and returns a user-facing message scrubbed to `Failed to build ${action} transaction: ${err.message}`. The raw error and the request context (action, symbol, amount, wallet) never reach the server log — making it impossible to triage why a specific user's tool call failed without reproducing it. Solution: `console.error` with full context BEFORE the user-facing return.

**D-18 (#21) — PDA derivation repeats per call for the same wallet.** `server/tools/kamino.ts:150` derives the vanilla obligation PDA on every `fetchVanillaObligation` invocation. PDA derivation is a cryptographic hash; the result is deterministic for fixed `(market, wallet)`. Across `getPortfolio` and `simulateHealth` calls in a single chat session, the same PDA is computed N times. Solution: a `Map<string, Promise<Address>>` keyed by `${market}:${wallet}`, populated lazily.

**D-20 (#22) — `oversizedParamsIn` only inspects one nesting level.** `server/rpc-guards.ts:33-49` checks if any direct child of `params` is an array longer than `MAX_PARAMS_ARRAY_LENGTH`. A future RPC method that wraps a long array inside a config object (e.g., `params: [{ accounts: [...100k...] }]`) would slip through. Today's `DENIED_METHODS` set covers the high-cardinality cases; the assumption is load-bearing but undocumented. Solution: a `// NOTE:` comment explaining the contract and the recursion-audit trigger.

## Scope

**In scope:**

- **D-20 (commit 1):** A `// NOTE:` block above `oversizedParamsIn` in `server/rpc-guards.ts` explaining the shallow-check contract and the trigger to revisit. Pure docs; zero behavior change. No new test.
- **D-15 (commit 2):** Replace empty `catch {}` at `src/components/SignTransactionCard.tsx:37-39` with `catch (err) { console.warn('[Kami] pollSignatureStatus retry', err); }`. Single-line behavior change (silent → warn). No new test (file has no existing unit coverage by design — UI integration is verified via Chrome MCP smoke).
- **D-17 (commit 3):** In `server/tools/kamino.ts` around line 664-669, add a `console.error('[Kami] KaminoAction build failed', { action, symbol: input.symbol, amount: input.amount, wallet, err })` call BEFORE the existing `return { ok: false, error: ... }`. No new test (consistent with kamino.ts's mainnet-validated surface; behavior change is purely additive observability).
- **D-16 (commit 4):** In `server/solana/connection.ts`, add `let sharedRpcUrl: string | null = null` field. In `getRpc()`, if `sharedRpc && sharedRpcUrl === currentUrl`, return cached; otherwise create and store both. New `server/solana/connection.test.ts` with ~3 tests: same URL caches, different URL recreates, env mutation drives recreate.
- **D-18 (commit 5):** Extract `getVanillaPda(market: Address, wallet: Address): Promise<Address>` in `server/tools/kamino.ts` using a module-scope `Map<string, Promise<Address>>` keyed by `${market}:${wallet}`. Replace the direct `await new VanillaObligation(...).toPda(...)` call inside `fetchVanillaObligation`. New `server/tools/kamino.test.ts` (FIRST test file for this module) with ~2 tests: same args memoize (1 SDK call across 3 invocations), different wallet → 2 SDK calls. Also adds an `_resetCachesForTesting()` helper guarded by `NODE_ENV === 'test'` matching the D-21 pattern.
- **D-8 (commit 6):** In `server/tools/kamino.ts`, add `let loadingPromise: Promise<KaminoMarket> | null = null`. The cold-cache branch checks `loadingPromise` first; if set, return it; otherwise create the loader IIFE that clears `loadingPromise` in a `finally` block (so both resolve and reject paths reset). Reuses `kamino.test.ts` scaffold from commit 5 — adds ~3 tests: 5 concurrent calls trigger 1 SDK load; cache hit short-circuits; loader rejection clears the in-flight promise.
- **D-14 (commit 7):** New `server/log.ts` exporting `Logger` interface and `createLogger()` factory. Each method emits one `JSON.stringify({ ...fields, ts, level, msg })` line — reserved fields come AFTER spread to prevent caller injection. `info`/`warn` → `console.log`; `error` → `console.error`. Replace `consoleLogger` in `server/chat.ts:25-28` with `createLogger()`. Replace `console.log('chat:aborted', { wallet: ... })` at `api/chat.ts:123` with the same logger. New `server/log.test.ts` with ~4 tests: shape (single-line, parseable JSON, ISO-8601 ts), level routing (info/warn → stdout, error → stderr), reserved-field precedence, level inclusion in output.

**Out of scope** (explicitly deferred):

- **#23 U-6 sidebar bulk-clear + per-chat rename** and **#24 U-8 thinking indicator** — Sprint 4.2b. UI surface; needs visual companion brainstorm. Locked per Day 12 spec.
- **Plumbing the new logger from `server/log.ts` through to kamino.ts handlers.** Would require changing the `ToolDefinition` interface to accept a logger via `ToolContext`. Scope balloon. D-17 uses bare `console.error` instead — same observability outcome with no architecture change.
- **Bounded cache for `pdaCache` (D-18).** In practice, one wallet per Kami session. Cap can ship later if the surface area grows (multi-wallet UI, fan-out testing).
- **Recursion in `oversizedParamsIn` (D-20).** Documenting the assumption is the deliverable; full recursion would change the algorithm and risk false-positives on legitimate wrapper objects. Queue for the day a high-cardinality method ships that nests its arrays.
- **Refactoring `pollSignatureStatus` to retry-budget pattern (D-15).** Out of scope; the warn-log is the requested change. Retry budgets are a different design conversation.
- **Auditing other `Decimal.toNumber()` usage in `server/tools/kamino.ts`** (deferred from Sprint 4.1 D-24 review). Pre-existing; not this sprint's scope.
- **8 deferred Minors from Sprint 4.1 PR #37 review.** All cosmetic; queue for the next time the touched file is opened for substantive change.

## Architecture

```
server/rpc-guards.ts                       src/components/SignTransactionCard.tsx
────────────────────                       ──────────────────────────────────────
  +NOTE block above oversizedParamsIn:        catch {} → catch (err) {
   - shallow-check contract                     console.warn('[Kami] pollSignatureStatus retry', err);
   - revisit trigger (new high-cardinality      // keep polling — RPC hiccups are expected
   method shipping with nested arrays)        }

server/tools/kamino.ts                     server/solana/connection.ts
─────────────────────                       ──────────────────────────
  +loadingPromise: Promise<KaminoMarket>      +sharedRpcUrl: string | null
   | null  (D-8)                              +getRpcUrl() check on every getRpc()
  +getVanillaPda(market, wallet) +              call (D-16); recreate if URL changed
   pdaCache: Map<string, Promise<Address>>
   (D-18)                                   server/log.ts (NEW)
  +console.error before existing return       ──────────────────
   in buildPendingTransaction catch (D-17)    +Logger interface
  +_resetCachesForTesting() helper            +createLogger() emits JSON lines
   (NODE_ENV === 'test' guard, mirrors D-21)   {...fields, ts, level, msg} —
                                                reserved fields win

server/chat.ts                              api/chat.ts
──────────────                              ───────────
  consoleLogger → createLogger()              console.log('chat:aborted', {wallet})
  (D-14)                                       → logger.info({wallet}, 'chat:aborted')
                                              (D-14)
```

### Test files

```
server/solana/connection.test.ts (NEW, D-16)
  ~3 tests: caches same URL, recreates on URL change, env-mutation drives recreate

server/tools/kamino.test.ts (NEW, D-18 + D-8)
  D-18 ~2 tests: PDA memoizes per (market,wallet); different wallet → 2 calls
  D-8  ~3 tests: concurrent calls share single load; cache hit short-circuits;
                 rejection clears the in-flight promise

server/log.test.ts (NEW, D-14)
  ~4 tests: JSON shape + ISO-8601 ts; level routes to console.log vs error;
            reserved fields override caller fields; level appears in line
```

### Key design decisions

1. **D-8 in-flight promise lives at the cache boundary.** A separate field, not entangled with `cachedMarket` / `marketLoadedAt`. Cleared via `finally` so both resolve and reject paths reset — otherwise a transient RPC failure would jam the cache forever. Tests assert both paths.

2. **D-14 reserved fields come AFTER spread.** `JSON.stringify({ ...fields, ts, level, msg })` — caller-supplied fields cannot override `ts`, `level`, or `msg`. This blocks log-injection at the smallest possible surface (one literal in `emit()`). Test asserts that a caller passing `{ msg: 'fake' }` does NOT replace the genuine `msg` argument.

3. **D-14 routing: error → stderr, info/warn → stdout.** Vercel's log explorer treats stderr as a higher-severity stream by default. `info` and `warn` are operational signal; `error` is failure signal. No need for a `debug` level — Kami doesn't have one today and YAGNI applies.

4. **D-15 = warn-log without narrowing or rethrow.** Issue title says "narrow + warn-log" (two actions). We ship only the warn-log. Reasons: (a) `web3.js` `Connection` errors are loosely typed (no exported error class hierarchy to discriminate against), so any "narrow" filter would be a brittle string-match on `err.message`; (b) by construction, every error in this loop is something we want to warn about — we're not selectively retrying based on error class, just keeping the polling alive; (c) per-poll cadence (one warn per `POLL_INTERVAL_MS` = 2s) already bounds log volume even on a sustained RPC outage. A `throw` here would abort polling on the first hiccup and break the user-visible confirmation flow.

5. **D-16 URL identity, not deep equality.** `getRpcUrl()` returns a string; comparing with `===` is correct because `process.env.SOLANA_RPC_URL?.trim()` produces a fresh string each call, and the fallback `DEFAULT_RPC` is a constant. No need for a deep config check.

6. **D-17 = bare `console.error`, not the new structured logger.** Plumbing the logger through `ToolContext` to handlers would mean changing the `ToolDefinition<I, O>` interface and updating all 7 tool handlers. That's a bigger commit than the rest of the sprint combined. The structured-log win is for handler-level events (chat-stream lifecycle, abort, tool-call/tool-result); raw error context inside a tool's catch is a triage breadcrumb that `console.error` already preserves. We can revisit if Phase D logging needs converge.

7. **D-18 memoization survives across calls within the same Vercel function instance.** Fluid Compute reuses instances (per CLAUDE.md), so the cache pays off across multiple chat turns. The cache cap is unbounded by design — one wallet per session, and the cache is process-local (resets on cold start). Documented in spec; cap can ship later if the surface grows.

8. **D-18 introduces the FIRST `kamino.test.ts`.** It also adds `_resetCachesForTesting()` (mirrors the D-21 runtime guard pattern) so the next commit (D-8) can reuse it. The mocking strategy: `vi.mock('@kamino-finance/klend-sdk', ...)` at module-load time, exposing `KaminoMarket.load` and `VanillaObligation.toPda` as spies. Pattern is copy-paste from `server/chat.test.ts`'s `vi.hoisted()` shape.

9. **D-20 = NOTE comment, not refactor.** The shallow check is correct for today's surface. Documenting the assumption is the requested change; expanding to recursion is a different conversation that needs a concrete trigger.

10. **One commit per logical change, seven commits total.** Per project rule. Any in-flight code-review fixes during execution ship as additional fix commits in the same PR (Sprint 3.1 C-2 pattern).

## Test plan

| Coverage | Where | New tests |
|---|---|---|
| D-20 NOTE | n/a (comments only) | 0 |
| D-15 warn-log | n/a (untested UI surface) | 0 |
| D-17 raw error log | n/a (kamino.ts mainnet-validated) | 0 |
| D-16 URL-aware singleton | `server/solana/connection.test.ts` (NEW) | +3 |
| D-18 PDA memoization | `server/tools/kamino.test.ts` (NEW) | +2 |
| D-8 in-flight guard | `server/tools/kamino.test.ts` (reuses) | +3 |
| D-14 structured logger | `server/log.test.ts` (NEW) | +4 |

**Test count delta:** 150 → ~162 across 17 → 20 files. (3 new test files, ~12 new tests.)

**Validation gates** (run after every commit per CLAUDE.md):
- `pnpm exec tsc --noEmit` — silent (client)
- `pnpm exec tsc -p server/tsconfig.json --noEmit` — silent (server)
- `pnpm test:run` — green, count matches commit's expected delta

## Risks

**Low-to-moderate.** Risk surface scales with each item's blast radius:

- **D-20:** Pure NOTE comment. Zero risk.
- **D-15:** Single `console.warn` addition. Worst case: warn shows up in production browser console for users on flaky RPC. Acceptable — this is the visibility we want.
- **D-17:** Single `console.error` addition. Worst case: server log gets one extra line per build-failure. Acceptable.
- **D-16:** Singleton lifecycle change. Worst case: an in-flight call holding the old `Rpc` instance gets back a response after we've recreated. Mitigation: `@solana/kit`'s `Rpc<SolanaRpcApi>` is stateless (config-only object, no socket pool), so a stale reference cannot leak resources. Verified by reading `@solana/kit` types — no `dispose`/`close`/connection-lifecycle members on the RPC handle.
- **D-18:** Cache addition. Worst case: stale PDA stays in cache after an unforeseen invariant change. Mitigation: PDA is deterministic from inputs; the only "stale" condition is a different `(market, wallet)` pair, which the cache key handles. Reset helper exists for tests.
- **D-8:** Concurrency primitive — highest risk in the cluster. Worst case: a partial implementation could deadlock (waiter never wakes) or thrash (cleanup runs but `cachedMarket` already populated). TDD critical here. The 3 tests cover the three reachable states (concurrent-cold, cache-hit, error-path).
- **D-14:** New module + plumbing into 2 existing call sites. Worst case: log injection, cosmetic shape regression. Mitigation: reserved-field-precedence test covers injection; shape test covers JSON parseability.

**Mitigation across the cluster:** Project's standard typecheck-and-test gates after each commit catch regressions at commit boundary. TDD red phase is mandatory on D-8 and D-18 (both have non-trivial concurrency invariants); recommended on D-16 (env-handling lifecycle) and D-14 (log injection); skippable on D-15 / D-17 / D-20 (single-line additions).

## Acceptance criteria

- [ ] All 7 commits land on `chore/p2-server-hygiene`, one per logical change.
- [ ] PR body lists `Closes #16`, `Closes #17`, `Closes #18`, `Closes #19`, `Closes #20`, `Closes #21`, `Closes #22`.
- [ ] All 3 typecheck commands silent on each commit.
- [ ] `pnpm test:run` shows ~162/162 across ~20 files at the tip of the branch.
- [ ] Cluster reviewer (`opus`) returns SHIP IT with 0 Critical / 0 Important.
- [ ] After PR merge, `gh issue list --label qa-2026-04-26 --state open --limit 30` returns 9 (8 backlog + 1 umbrella, P2 server-hygiene row fully ticked).
- [ ] Umbrella issue #3's P2 row shows #16-#22 ticked; #23 and #24 remain unchecked (Sprint 4.2b scope).
- [ ] No AI attribution in commit messages, PR body, or any added comment.

## Out-of-band notes

- **Test-infra scaffolding is reused across commits.** D-18 (commit 5) creates `kamino.test.ts` with `vi.hoisted()` + `vi.mock('@kamino-finance/klend-sdk', ...)`. D-8 (commit 6) extends the same file. The `_resetCachesForTesting()` helper covers BOTH `pdaCache` (D-18) and `loadingPromise` + `cachedMarket` + `marketLoadedAt` (D-8) so commit 6's test setup just calls the existing helper.
- **Coverage delta is concentrated in the new files.** Existing `server/tools/kamino.ts` coverage rises modestly from the 5 new tests; `server/solana/connection.ts` goes from 0% to ~100%; `server/log.ts` ships at ~100%.
- **Vercel deploy preview will surface D-14's structured logs immediately.** A useful smoke test post-merge: trigger a chat request and inspect Vercel function logs — `chat:aborted`, tool-invoke, tool-result events should now be JSON.
- **Sprint 4.2b (UI features, #23 + #24) remains scheduled for a separate session.** Visual companion offer applies there. Phase D (GTM — demo video, README screenshots, tweet thread, Superteam submission) untouched and RECTOR-driven; bounty deadline 2026-05-12 (14 days from session date).
