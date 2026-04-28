# Sprint 4.1 — P3 trivial sweep: documentation + safety-rail polish

**Date:** 2026-04-28
**Issues:**
- [#25 — D-21 Gate `_resetForTesting` helper](https://github.com/RECTOR-LABS/kami/issues/25)
- [#26 — D-23 Inline `// NOTE:` for markdown-renderer pre/code gotcha](https://github.com/RECTOR-LABS/kami/issues/26)
- [#27 — D-24 `toNumber` JSDoc precision warning](https://github.com/RECTOR-LABS/kami/issues/27)
- [#28 — D-25 Integration test: empty `identify()` → 429 wire-up](https://github.com/RECTOR-LABS/kami/issues/28)

**Priority:** P3 (`qa-2026-04-26`)
**Sprint:** 4.1 (Chunk 4 — priority-based clusters)
**Estimate:** ~3h walltime; each commit < 1h
**Branch:** `chore/p3-trivial-sweep`

---

## Problem

Four small footguns and undocumented quirks survived earlier sprints because each item was below the bar to ship as its own PR. Cohering them as one cluster makes the trip worthwhile and clears 4 of the 19 remaining `qa-2026-04-26` backlog items in a single PR.

**D-21 (#25) — `_resetForTesting` is exported unguarded.** `server/ratelimit.ts:94-97` exports a test-only helper that resets the in-memory Redis singleton. A future contributor could call it from app code by accident; nothing today prevents that. The fix is a runtime guard, not a redesign.

**D-23 (#26) — Two undocumented quirks in `src/lib/markdown-renderer.tsx`.** The `pre` override reads `className` directly off `children[0].props` rather than checking `first.type === 'code'` because react-markdown v10's user-overridden `code` component shows up as the literal child type, not the string `'code'`. A future "simplification" would silently break syntax highlighting. Separately, the `code` override has a defensive `else ''` branch for non-string, non-array `children` shapes that would look like dead code without explanation. The C-3-finish (Sprint 3.2) review explicitly flagged the missing comment as a Minor.

**D-24 (#27) — `toNumber` quietly lossy above 2^53.** `server/tools/kamino.ts:83-85` converts `Decimal` → `number` and is used in 16 tool-output sites. All current call sites are display-only — but nothing in the function signature or surrounding context warns a future caller against using it for amounts that get hashed, sent on-chain, or compared for equality. JSDoc fixes this.

**D-25 (#28) — Empty-identify → 429 wire-up is asserted by inference, not by test.** `server/ratelimit.ts:74-76` returns `{ ok: false, limit: 0, ... }` when `identify()` yields an empty string (the production guard against shared-bucket DoS — see CLAUDE.md). `api/chat.ts` is supposed to convert that into a 429 with `X-RateLimit-Limit: 0` headers. `server/ratelimit.test.ts` covers the lower altitude (empty-identifier branch); `api/chat.test.ts` does not yet codify the handler's reaction.

## Scope

**In scope:**

- **D-21 (commit 1):** Add a runtime guard inside `_resetForTesting`. Throw with a specific error message when `process.env.NODE_ENV !== 'test'`. Add one test in `server/ratelimit.test.ts` asserting the throw.
- **D-23 (commit 2):** Two `// NOTE:` comments in `src/lib/markdown-renderer.tsx` — one above the `pre` override (lines 105-111), one above the `code` text-extraction (lines 78-83). Pure comments; zero behavior change.
- **D-24 (commit 3):** JSDoc block above `toNumber` in `server/tools/kamino.ts` warning about precision loss above 2^53, the `±Infinity → 0` overflow guard, and the display-only constraint. Pure docs; zero behavior change.
- **D-25 (commit 4):** One new test in `api/chat.test.ts` asserting that `identify() → ''` produces a 429 with `X-RateLimit-Limit: 0`, `X-RateLimit-Remaining: 0`, `Retry-After`, and the right body shape. Mock-mirroring style consistent with the existing 14 handler tests.

**Out of scope** (explicitly deferred):

- **Conditional export of `_resetForTesting`** (option B in the brainstorm). Type-noisy at the 4 existing call sites, fragile under tree-shaking changes, no incremental safety benefit over the runtime guard.
- **End-to-end integration test through real `applyLimit`** (option B for D-25). Covered at the right altitude already by `server/ratelimit.test.ts:97-127`. Re-testing it from a different angle adds ~3-4× the wiring (we'd need to mock `@upstash/ratelimit` instead of `../server/ratelimit.js`) without raising signal.
- **Splitting D-23 into two commits** (option B in the brainstorm). The two NOTEs touch the same file, the same theme ("undocumented quirks of react-markdown's component override surface"), and add < 20 lines of comments total.
- **Refactoring `toNumber` to throw on overflow** (instead of returning `0`). Safety-positive change, but it would break callers that expect a fallback. Out of scope for a doc-only sprint; queue for a future cleanup if precision-loss bites in practice.
- **Auditing other `Decimal.toNumber()` direct usage in `server/tools/kamino.ts`** (line 93's `lastSlot` for the staleness gate, line 686's `uiAmount` for transaction lamports). Both are sub-2^53 by construction; not in this sprint's scope.

## Architecture

```
server/ratelimit.ts                       src/lib/markdown-renderer.tsx
────────────────────                       ─────────────────────────────
  +runtime guard at the top of            +NOTE above `pre` override (lines 105-111):
   _resetForTesting:                        explain why we read className off
   throw if NODE_ENV !== 'test'             children[0].props instead of first.type
                                          +NOTE above `code` text-extraction
                                           (lines 78-83): explain the `else ''`
                                           defensive branch for ReactElement children

server/tools/kamino.ts                    api/chat.test.ts
─────────────────────                       ──────────────────
  +JSDoc on toNumber:                      +test: empty identify() → 429
   - precision loss > 2^53                  + X-RateLimit-Limit: 0
   - display-only constraint                 + X-RateLimit-Remaining: 0
   - ±Infinity → 0 overflow note             + Retry-After header
                                              + body.error === 'Too many requests'

server/ratelimit.test.ts
────────────────────────
  +test: _resetForTesting throws when
   NODE_ENV !== 'test' (toggle env var
   inside try/finally to restore)
```

### Key design decisions

1. **D-21 = runtime guard, not import-gate.** Brainstorm option A. The function body refusing to run is functionally equivalent to the helper being undefined, with a cleaner test surface (`expect(() => _resetForTesting()).toThrow()`) and no `if (helper)` guards at the 4 existing call sites in `server/ratelimit.test.ts`. The few extra bytes shipped in the prod bundle are below the noise floor.

2. **D-23 = bundle both NOTEs in one commit.** The two quirks share theme and file, and the C-3-finish review explicitly tied the second NOTE to D-23. Splitting into two commits would yield two ≈3-line diffs in the same file, hours apart — false granularity.

3. **D-24 = JSDoc block, not @-deprecated.** Display-only is a contract, not a deprecation. The right tool is documentation. Future callers see the warning at IDE-hover time without any compile-time noise on existing call sites.

4. **D-25 = mock-mirroring at the handler altitude.** Brainstorm option A. Style-consistent with the 14 existing handler tests in `api/chat.test.ts`. The test's mocks mirror the contract `applyLimit('')` already enforces in `server/ratelimit.ts:74-76` (already covered by `server/ratelimit.test.ts:97-127`); this test asserts the handler reads `ok: false, limit: 0` correctly and emits the right wire response.

5. **One commit per logical change, four commits total.** Per project rule. Any in-flight code-review fixes during execution ship as additional fix commits in the same PR (the C-2 pattern from Sprint 3.1, not the post-merge pattern).

## Test plan

| Coverage | Where | New tests |
|---|---|---|
| D-21 throw outside test env | `server/ratelimit.test.ts` | +1 |
| D-23 NOTEs | n/a (comments only) | 0 |
| D-24 JSDoc | n/a (docs only) | 0 |
| D-25 empty-identify wire-up | `api/chat.test.ts` | +1 |

**Test count delta:** 148 → 150 across 17 files. No new test files.

**Validation gates** (run after every commit per CLAUDE.md):
- `pnpm exec tsc --noEmit` — silent (client)
- `pnpm exec tsc -p server/tsconfig.json --noEmit` — silent (server)
- `pnpm test:run` — green, count matches commit's expected delta

## Risks

**Low — all four items.** Risk surface scales with each item's blast radius:

- **D-21:** Adds a throw on a code path no app code reaches. Worst case: a future test forgets to set `NODE_ENV=test` (vitest default) and gets a clear error message pointing to the fix.
- **D-23:** Pure comments. Zero risk.
- **D-24:** Pure JSDoc. Zero risk.
- **D-25:** Adds an `it()` block. Worst case: the existing handler invariant changes and this new test catches the regression — which is exactly the value we want.

**Mitigation:** Project's standard typecheck-and-test gates after each commit catch any regression at the commit boundary, not the PR boundary.

## Acceptance criteria

- [ ] All 4 commits land on `chore/p3-trivial-sweep`, one per logical change.
- [ ] PR body lists `Closes #25`, `Closes #26`, `Closes #27`, `Closes #28`.
- [ ] All 3 typecheck commands silent on each commit.
- [ ] `pnpm test:run` shows 150/150 across 17 files at the tip of the branch.
- [ ] Cluster reviewer (`opus`) returns SHIP IT with 0 Critical / 0 Important.
- [ ] After PR merge, `gh issue list --label qa-2026-04-26 --state open --limit 30` returns 16 (15 backlog + 1 umbrella). Umbrella issue #3's P3 row shows #25–#28 ticked.
- [ ] No AI attribution in commit messages, PR body, or any added comment.

## Out-of-band notes

- The session handoff (`~/Documents/secret/claude-strategy/kami/session-handoff-2026-04-28.md`) calls out that #26 (D-23) was foreshadowed by C-3-finish reviewer feedback. The "fold both NOTEs into one commit" choice is the explicit answer to that callout.
- Phase D (GTM — demo video, README screenshots, tweet thread, Superteam submission) remains untouched and RECTOR-driven. Bounty deadline is 2026-05-12 (14 days). Sprint 4.1 does not block Phase D.
