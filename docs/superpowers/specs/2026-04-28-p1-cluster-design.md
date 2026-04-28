# Sprint 4.3 — P1 cluster: server hygiene + UI polish + useChat test expansion

**Date:** 2026-04-28
**Issues:**
- [#9 — D-5 Drop relative `fetch('api/chat')` for `/api/chat`](https://github.com/RECTOR-LABS/kami/issues/9)
- [#10 — D-9 Random per-process token in dev to avoid 'anonymous' shared bucket](https://github.com/RECTOR-LABS/kami/issues/10)
- [#11 — D-10 Switch RPC guard from denylist to allowlist](https://github.com/RECTOR-LABS/kami/issues/11)
- [#12 — D-11 Expand `useChat.test.ts` to cover streaming + abort + D-3/D-4 regressions](https://github.com/RECTOR-LABS/kami/issues/12)
- [#14 — U-5 Sidebar conversation-title tooltip on hover](https://github.com/RECTOR-LABS/kami/issues/14)
- [#15 — U-7 Empty-state feature cards: make clickable or downgrade to badges](https://github.com/RECTOR-LABS/kami/issues/15)

**Priority:** P1 (`qa-2026-04-26`)
**Sprint:** 4.3 (priority-based cluster — final P1 sweep, closes the entire 2026-04-26 QA backlog)
**Estimate:** ~6-10h walltime; per-item range <1h to 4h+
**Branch:** `feat/p1-cluster`

---

## Problem

Six remaining P1 items in the QA backlog after Sprints 4.1 (P3 trivial sweep), 4.2a (P2 server hygiene), and 4.2b (P2 UI features) closed the lower-priority and the P2 sub-clusters. The six items split into three sub-themes that share the same time scale (most under 2h each):

- **Server hygiene** (#9 #10 #11) — three small server-side robustness improvements: a relative-URL fetch path with breakage potential under sub-path routing; a shared `'anonymous'` rate-limit bucket in dev environments; an unbounded RPC denylist that grows unbounded as Solana adds methods.
- **UI polish** (#14 #15) — two discoverability gaps in the sidebar and empty state: truncated chat titles with no tooltip; empty-state feature cards that visually invite a click but currently do nothing.
- **Test expansion** (#12) — the broader streaming/abort/error-handling coverage gap on `useChat.ts` that was first flagged in the baseline QA report. C-1 (Sprint 1.1) added `mapToolResultStatus` unit tests; the hook's hot reducer-style state is otherwise still uncovered.

None of these are demo-blocking for the Eitherway-Kamino bounty. Sprint 4.3 closes them so the backlog ledger is clean before the bounty submission, and so post-merge the umbrella tracking issue (#3) can also close.

## Scope

**In scope (6 commits, single PR on `feat/p1-cluster`):**

### #9 — Drop relative fetch path (commit 1)

`src/hooks/useChat.ts:182` — change `fetch('api/chat', ...)` to `fetch('/api/chat', ...)`. Single-character fix. The relative form resolves against the current document URL and breaks if the SPA is ever served from a non-root sub-path or if `react-router` ever pushes the URL into a sub-segment without a trailing slash. Absolute path is the standard.

No new test required — the path change is covered by every existing integration path that hits `/api/chat`.

### #10 — Random per-process token in dev (commit 2)

`server/ratelimit.ts:65` — replace the `'anonymous'` literal returned by `identify()` in non-production with a randomized per-process token cached at module load: `'dev-' + crypto.randomUUID()`. Production behavior unchanged (still resolves real IP / wallet / session identifiers).

The motivation: if a developer accidentally points a local dev build at the real Upstash, every request from that build shares the `anonymous` bucket — a single curl loop exhausts it for the whole session. A per-process random token ensures each dev process has its own bucket without leaking real identity.

Add a small unit test confirming `identify()` returns a `dev-`-prefixed UUID-shaped string when `NODE_ENV !== 'production'` and no real identifier is provided.

### #11 — RPC allowlist (commit 3)

`server/rpc-guards.ts` — replace the `DENIED_METHODS` denylist with an `ALLOWED_METHODS` allowlist. Rename the function `deniedMethodIn(payload)` → `disallowedMethodIn(payload)` (returns the method name when it is NOT in the allowlist; the call site in `api/rpc.ts` reads "if disallowed, 403"). Update the existing `server/rpc-guards.test.ts` to flip semantics: known-good method passes, arbitrary method (e.g. `'getProgramAccounts'`) is now caught.

**Initial allowlist (implementer verifies + extends as needed via grep + smoke test before commit):**

- `getHealth` — heartbeat / readiness checks
- `getLatestBlockhash` — transaction construction
- `getBalance` — wallet balance reads
- `getAccountInfo` — single-account reads
- `getMultipleAccounts` — batch reads (Kamino uses this)
- `simulateTransaction` — preflight simulation
- `sendTransaction` — wallet broadcast
- `getSignatureStatuses` — confirmation polling (used by `SignTransactionCard.pollSignatureStatus`)
- `getBlockHeight` — confirmation timeout (used by `pollSignatureStatus`)
- `getMinimumBalanceForRentExemption` — rent calculations

The implementer must run `pnpm dev`, exercise: wallet connect, sign a deposit transaction (devnet OK), confirm it on-chain, and verify no `/api/rpc` 403s appear in the browser console. If any new method shows up that the app legitimately needs, add it to the allowlist before committing.

The Day 14 (Sprint 4.2a) `oversizedParamsIn` shallow-check NOTE in `server/rpc-guards.ts:33-39` stays — that comment is about a different concern (nested-array params) and is unaffected by the allowlist switch.

### #12 — useChat.test.ts streaming + abort + regression coverage (commit 4)

`src/hooks/useChat.test.ts` — extend with `renderHook` + a stubbed `global.fetch` yielding canned SSE chunks. Sprint 4.2b already added the `aborts in-flight stream when clearAllConversations is called` test using this pattern; reuse it.

**New describe blocks (~6-8 tests total):**

- `useChat sendMessage streaming` — stub fetch returning an SSE stream with text-delta chunks, assert that `activeConversation.messages[last].content` accumulates correctly. Verify the assistant message moves from empty → partial → complete in the right order.
- `useChat sendMessage tool sequencing` — stub fetch with chunks containing `parsed.toolCall`, `parsed.toolResult`, `parsed.toolError`. Assert that `messages[last].toolCalls` updates (call → done | error | wallet-required) per the `mapToolResultStatus` contract. The status mapping itself is already unit-tested; this verifies the wiring inside `commitToolCalls`.
- `useChat sendMessage abort during streaming` — start a `sendMessage`, abort via `stopStreaming` mid-stream, assert `isStreaming` becomes false and the assistant message stays at whatever was accumulated (no error string overwrites in-progress content).
- `useChat D-3 regression` — stub fetch with a 429 response (rate-limited), assert the assistant message renders the formatted error string from `formatChatError`. (`formatChatError` is already unit-tested in isolation; this confirms the hook calls it on the right path.)
- `useChat D-4 regression — switchConversation aborts in-flight stream` — start `sendMessage`, switch conversation mid-stream, assert the captured `AbortSignal` is aborted.
- `useChat D-4 regression — deleteConversation aborts in-flight stream` — same pattern as above for `deleteConversation` of the active conversation.
- (optional, if straightforward) `useChat D-4 regression — deleteConversation of NON-active does NOT abort` — confirms the existing guard at `useChat.ts:102-104`.

The `useChat clearAllConversations` describe block already has the abort regression (added in Sprint 4.2b round-1 fix). Don't duplicate it — this commit's tests are about `sendMessage`, `switchConversation`, and `deleteConversation`.

### #14 — Sidebar tooltip (commit 5)

`src/components/Sidebar.tsx` — add a `title={conv.title}` attribute to the existing `<span className="flex-1 truncate">` that renders the chat title in the non-edit branch. The native HTML `title` attribute produces a browser-default tooltip (~1.5s delay) on hover, accessible to screen readers, no JS required.

Edit-mode branch (the `<input>`) keeps its own `aria-label` from Sprint 4.2b — no change there.

No new test required — this is a static attribute addition. The existing Sidebar tests still cover the relevant render paths.

### #15 — Empty-state cards clickable (commit 6)

`src/components/EmptyState.tsx` + `src/components/ChatPanel.tsx`.

**Wiring:** Add an `onSend: (msg: string) => void` prop to `EmptyState`. In `ChatPanel`, pass `handleSend` (which already wraps `onSend` with `publicKey`) as `<EmptyState onSend={handleSend} />`. The `EmptyState` component is rendered only when `hasMessages === false`, so the wiring is direct.

**Card behavior:** Each card gets an `onClick` that fires its representative query through `onSend`. The cards already have `hover:bg-kami-surface` (which hints at clickability); add `cursor-pointer` to make the affordance explicit.

**Card → query mapping:**

| Card title | Query fired |
|---|---|
| Live Yields | `What are the best Kamino yields right now?` |
| Build & Sign | `Show me a 5 USDC deposit example` |
| Portfolio | `Show me my Kamino portfolio` |
| Health Sim | `Will my borrow position liquidate at SOL $50?` |

**Tests (NEW file `src/components/EmptyState.test.tsx`):**

- 4 tests, one per card: render `<EmptyState onSend={mockFn} />`, click the card, assert `mockFn` called with the expected query string.
- 1 smoke test: render `<EmptyState onSend={mockFn} />`, assert all 4 card titles appear.

The wallet-connect button already in `EmptyState` keeps its existing handlers — independent from the cards.

**Out of scope** (explicitly deferred):

- **Custom-styled tooltip for #14.** Native `title` is the smallest correct fix. A custom positioned tooltip matching `bg-kami-surface border-kami-border` would add ~30-60 lines and require Headless UI / Radix or similar. Defer until a wider tooltip pattern lands.
- **Hover affordance polish on EmptyState cards.** The `hover:bg-kami-surface` is the current pattern; sprint adds `cursor-pointer` but does not change visual hover treatment otherwise. A more pronounced hover (lift + shadow + border-glow) is cosmetic; defer.
- **Accessibility upgrade on `EmptyState` cards.** Plain `<div role="button">` would be more correct than relying on `<div onClick>`; the four cards as currently rendered are not keyboard-focusable. Add `tabIndex={0}` + `onKeyDown` Enter handler if the bounty's a11y review surfaces this; otherwise defer.
- **`useChat.test.ts` branch coverage of `JSON.parse(data)` failure path.** The hook silently continues on `SyntaxError`; testing this would require carefully malformed SSE chunks. Defer — behavioral coverage is the goal, not branch coverage.
- **#11 RPC allowlist drift detection.** A future Solana method that the app legitimately needs to call would be silently 403'd until someone notices and updates the allowlist. Mitigation in this sprint: the implementer's manual smoke covers the known paths. A separate sprint could add a synthetic monitor or a client-side "method denied" toast.

## Architecture

```
src/hooks/
  useChat.ts                                    server/
  ──────────                                    ─────
  Line 163 (commit 1):                          ratelimit.ts (commit 2)
    - fetch('api/chat', ...)                    ───────────
      → fetch('/api/chat', ...)                 - At module load, cache
                                                  DEV_TOKEN = 'dev-' +
  useChat.test.ts (commit 4)                      crypto.randomUUID()
  ────────────────                              - In identify(), if
  Append 3 new describe blocks:                   NODE_ENV !== 'production'
    + sendMessage streaming                       and no real id, return
    + sendMessage tool sequencing                 DEV_TOKEN
    + sendMessage abort during streaming        - Test: identify() returns
    + D-3 regression (4xx)                        dev-prefixed UUID-shaped
    + D-4 regression (switch + delete)            string in non-prod

src/components/                                 server/rpc-guards.ts (commit 3)
  ─────────                                     ──────────────────
  Sidebar.tsx (commit 5):                       - DENIED_METHODS → ALLOWED_METHODS
    + title={conv.title} on the                 - deniedMethodIn → disallowedMethodIn
      static-title <span>                       - Returns method name iff
                                                  !ALLOWED_METHODS.has(method)
  EmptyState.tsx (commit 6):                    - oversizedParamsIn unchanged
    + onSend prop
    + onClick on each of 4 cards                rpc-guards.test.ts (commit 3)
    + cursor-pointer class                      ────────────────
                                                - Flip 1-2 existing tests
  ChatPanel.tsx (commit 6):                       (known-good passes;
    + <EmptyState onSend={handleSend} />          arbitrary method 403s)
                                                - Add 1 allowlist-membership test
  EmptyState.test.tsx (commit 6, NEW):
    + 4 tests (one per card click)
    + 1 smoke test
```

### Key design decisions

1. **Single PR with 6 commits.** All items are small (most <1-2h), well-bounded to one or two files, and don't touch each other's code. A sub-split into 4.3a/b/c was considered (matches Sprint 4.2 precedent) but rejected because (a) opus cluster review handles 6 commits fine — Sprint 4.2a's PR had 9 commits, 4.2b's had 5 — and (b) one PR-cycle vs. three saves ~1-2h of overhead. Sprint 4.2's split was justified by the deep theme divergence (server vs. UI); Sprint 4.3's items, while spanning three themes, are each so small that the divergence cost is minimal.

2. **Native `title` attribute over custom tooltip for #14.** The simplest fix that works on every browser, every screen reader, and every input modality. Custom tooltips would match Kami's dark theme better but cost 30-60 lines + a positioning library or careful CSS. Defer the polish to a future sprint.

3. **Clickable cards over downgraded badges for #15.** The existing visual already invites a click (cards have hover state, rounded corners, lucide-react icons); making them actually fire queries respects the user's expectation. Downgrading to badges would be a regression — fewer demo-friendly entry points before bounty.

4. **Card-to-query mapping is hard-coded inline, not extracted.** Four entries; YAGNI applies. If the empty state grows to ~10 cards or if cards become user-configurable, extract then.

5. **#11 allowlist starting set, implementer verifies.** Static enumeration via `grep` is unreliable because some RPC methods are called indirectly through `@solana/wallet-adapter-react`'s wallet adapter or through `Connection` instance methods. The starting list above covers the known direct paths; the implementer runs `pnpm dev` + a wallet-sign smoke test before commit and adds any method that 403s.

6. **#12 D-11 test scope is behavioral, not branch coverage.** The goal is "does the hook produce the right state on the right inputs?" — not "does every line execute?" Specifically out of scope: the `JSON.parse` syntax-error catch arm (existence verified by code reading; testing would require malformed SSE chunks); the inner `for (const line of lines)` early-`break` on `[DONE]` (covered indirectly by stream-completion tests).

7. **No new files outside `EmptyState.test.tsx`.** Item 6's component test file is the only new file. Items 1-5 modify existing files only.

8. **One commit per logical change, six commits total.** Per project rule. Code-review fix commits ship in the same PR (Sprint 4.2 precedent).

## Test plan

| Coverage | Where | New tests |
|---|---|---|
| #10 D-9 dev-token returns dev-prefixed UUID-shape | `server/ratelimit.test.ts` (extend) | +1 |
| #11 D-10 known-good method passes | `server/rpc-guards.test.ts` (flip semantics) | edits to existing |
| #11 D-10 arbitrary method 403s | `server/rpc-guards.test.ts` (flip semantics) | edits to existing |
| #11 D-10 allowlist set assertion | `server/rpc-guards.test.ts` | +1 |
| #12 D-11 sendMessage streaming text-delta | `src/hooks/useChat.test.ts` (extend) | +1 |
| #12 D-11 sendMessage tool sequencing | `src/hooks/useChat.test.ts` | +1 |
| #12 D-11 sendMessage abort during streaming | `src/hooks/useChat.test.ts` | +1 |
| #12 D-11 D-3 regression (4xx error rendering) | `src/hooks/useChat.test.ts` | +1 |
| #12 D-11 D-4 switchConversation aborts | `src/hooks/useChat.test.ts` | +1 |
| #12 D-11 D-4 deleteConversation of active aborts | `src/hooks/useChat.test.ts` | +1 |
| #12 D-11 D-4 deleteConversation of non-active does NOT abort | `src/hooks/useChat.test.ts` | +1 |
| #15 U-7 each card click fires onSend with expected query | `src/components/EmptyState.test.tsx` (NEW) | +4 |
| #15 U-7 cards render (smoke) | `src/components/EmptyState.test.tsx` | +1 |

**Test count delta:** 175 → ~189 across 20 → 21 files. (`EmptyState.test.tsx` is new; `server/ratelimit.test.ts`, `server/rpc-guards.test.ts`, `src/hooks/useChat.test.ts` all extended.)

**Validation gates** (per CLAUDE.md, run after every commit):
- `pnpm exec tsc --noEmit` — silent (client)
- `pnpm exec tsc -p server/tsconfig.json --noEmit` — silent (server)
- `pnpm test:run` — green, count matches commit's expected delta

**Manual smoke (post-deploy):**
- Submit a chat query → confirm `/api/chat` (with absolute path) is hit (#9)
- Open dev tools → trigger a request → confirm `X-RateLimit-*` headers show a `dev-`-prefixed identifier in dev (#10)
- Wallet-sign a deposit transaction → confirm no `/api/rpc` 403s in browser console (#11)
- Hover any sidebar conversation row → confirm browser-default tooltip with full title appears (#14)
- On welcome screen → click each of the 4 cards → confirm the matching query is sent (#15)

## Risks

**Low-to-medium overall.** Item #11 is the only item with non-trivial regression potential.

- **#11 allowlist false-negative regression.** If a method the app legitimately uses is missing from the allowlist, that path 403s in production silently (no crash, but the call fails). Mitigation: implementer's `pnpm dev` smoke before commit covers the known paths; the existing CI includes the rpc-guards tests with flipped semantics; production rollout is gradual via Vercel's rolling deploy. If a previously-working flow breaks post-deploy, a one-line allowlist addition + redeploy resolves it (~5 min).

- **#10 dev-token entropy.** `crypto.randomUUID()` is part of the global Crypto API in Node 19+. Kami's package.json uses Node 24 LTS (Vercel default), so this is safe. If the test environment differs (happy-dom in Vitest), `crypto.randomUUID` is also defined — verified from prior Sprint 4.2b experience.

- **#12 D-11 walltime overrun.** Estimated 4h+. SSE-chunk fixtures may take longer than expected if mocking the `body.getReader()` interface gets fiddly. Mitigation: time-box each test to ~30min; if a test gets stuck, ship what's stable and file a follow-up issue rather than blocking the sprint. Worst case: this sprint becomes 5 commits + a deferred D-11.

- **#15 wiring regression.** The `EmptyState` component currently has a wallet-connect button and a "Use another Solana wallet" button. Adding `onSend` doesn't touch them. The existing `useWallet` and `useWalletModal` hooks remain. No interference expected.

- **#14 native tooltip styling.** Browser-default tooltips are gray, ~1.5s delay, can't be styled. Acceptable trade-off — aesthetics are not the goal. If RECTOR later wants the polish, file as a follow-up.

## Acceptance criteria

- [ ] All 6 commits land on `feat/p1-cluster`, one per logical change.
- [ ] PR body lists `Closes #9`, `Closes #10`, `Closes #11`, `Closes #12`, `Closes #14`, `Closes #15`.
- [ ] All 3 typecheck commands silent on each commit.
- [ ] `pnpm test:run` shows ~189/189 across ~21 files at branch tip.
- [ ] Cluster reviewer (`opus`) returns SHIP IT with 0 Critical / 0 Important.
- [ ] After PR merge, `gh issue list --label qa-2026-04-26 --state open --limit 30` returns 0-1 (umbrella #3 closes when all child issues close, OR is closed manually).
- [ ] Umbrella issue #3's P1 row fully ticked.
- [ ] No AI attribution in commit messages, PR body, comments, or any added code.

## Out-of-band notes

- **Sprint 4.2b's bonus abort test** (`useChat clearAllConversations` describe block, added in commit `ff3702b`) covered the abort path for `clearAllConversations`. This sprint covers the abort path for `switchConversation` and `deleteConversation` separately under `useChat sendMessage / D-4 regression`. The abort-via-`stopStreaming` test (#12 commit) covers the in-input stop button.
- **Sprint 4.3 closes the entire `qa-2026-04-26` baseline-QA backlog.** After merge, only #39 (out-of-scope discovery from Sprint 4.2b — empty-msg-on-abort persistence) and any future QA-run umbrellas remain open. Bounty deadline 2026-05-12 = 14 days from session date.
- **Phase D (GTM) becomes next priority** after Sprint 4.3 ships. RECTOR-driven (demo video recording, README screenshots, tweet thread, Superteam submission, judging rehearsal). This sprint's UI improvements (#14 tooltip + #15 clickable cards) directly improve Phase D demo discoverability.
- **No infrastructure changes.** No VPS, env-var, or Cloudflare changes. Vercel + GitLab mirror auto-trigger on PR lifecycle as usual.
