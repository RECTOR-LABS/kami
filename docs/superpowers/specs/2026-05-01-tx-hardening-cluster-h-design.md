# Cluster H — Transaction Hardening Design

**Date:** 2026-05-01
**Sprint:** Cluster H — Transaction sign/broadcast hardening
**Branch:** `feat/cluster-h-tx-hardening` → PR #54
**Bounty deadline:** 2026-05-12 (11 days)

## Background

Day 23 manual testing surfaced a load-bearing diagnostic via Chrome MCP fetch instrumentation: **Solflare's `signAndSendTransaction` does the entire sign + broadcast inside the browser extension**, using `chrome.runtime.sendMessage` to its own background script + RPC endpoint. Our `/api/rpc` proxy is **never called** for the broadcast. When Solflare's RPC rejects post-sign (e.g. `NetValueRemainingTooSmall` after Kamino preflight passed via Helius), the adapter wraps the error in `WalletSendTransactionError` with empty `.message` and zero `.cause` — leaving us with zero observability and zero recovery surface.

Cascading findings from the same testing session:

1. **LLM hallucination** — after a build* tool fails, the model later claims "Sign & Send card should now appear" without re-invoking the tool. Fresh chat fixes it; mid-conversation users get stuck.
2. **NetValueRemainingTooSmall floor is ~$5 USD net, not the documented ~$1.** Wallets with $4-6 net cannot close cleanly via Kami's standard repay/withdraw paths.
3. **`walletError.ts` heuristic** misclassifies the empty `WalletSendTransactionError` as "popup dismissed" — wrong UX guidance.
4. **`docs/demo-script.md`** documents `≥6 USDC` funding requirement; empirically need `≥15 USDC` for clean Shot 7 close-out.
5. **System prompt** lacks a Kamino UI escape-hatch routing rule for protocol-level limitations.

This cluster ships all six fixes in one coherent PR (~5-7 agent hours, ~25 new tests, single deploy).

## Goals

- **G1.** Recover full observability + control over the sign + broadcast flow regardless of which wallet adapter is connected.
- **G2.** Detect Kamino's `NetValueRemainingTooSmall` floor in server-side preflight, surface structured context to the LLM, and let the LLM route to the right recovery path based on user intent.
- **G3.** Guard against the LLM hallucinating "transaction is ready" after a failed build* — both via tightened system-prompt rules (primary) and a stream-layer post-hoc footnote injection (safety net).
- **G4.** Make the Kamino UI escape hatch (https://app.kamino.finance) a first-class fallback in Kami's UX whenever a Kamino protocol limit is hit.
- **G5.** Update bounty submission docs and CLAUDE.md gotchas to reflect today's empirical learnings.

## Non-goals

- Reconnect Wallet button in TxStatusCard (today's diagnostic ruled out Solflare permission cache as the actual cause).
- Empty-msg-on-abort cosmetic UX (#39).
- Sprint 4.x deferred minors (#46 umbrella).
- Switching to Wallet-Standard `signAndSendTransaction` for wallets that don't expose `signTransaction` (universal Wallet-Standard support is sufficient for Solflare/Phantom/Backpack/Glow — the demo's primary wallets).

## Architecture overview

**Branch:** `feat/cluster-h-tx-hardening` → PR #54

**Files touched:** 6 source + 6 test + 3 docs + 2 memory.

| File | Change | Lines (~) |
|---|---|---|
| `src/components/chat/TxStatusCard.tsx` | H6: `sendTransaction` → `signTransaction + sendRawTransaction` | ~15 |
| `src/components/chat/TxStatusCard.test.tsx` | H6: update mocks (sendTransaction → signTransaction) + new tests for structured RPC errors | ~40 |
| `src/lib/walletError.ts` | H3: new branches for `dust-floor`, `simulation-failed`, `WalletSignTransactionError` | ~30 |
| `src/lib/walletError.test.ts` | H3: tests for new classifier branches | ~25 |
| `server/tools/kamino.ts` | H2: structured preflight error → `{ ok: false, errorCode, context, suggestedAlternatives }` for dust floor | ~50 |
| `server/tools/kamino.test.ts` | H2: tests for dust-floor detection + structured error shape | ~30 |
| `server/prompt.ts` | H1+H2+H5: anti-hallucination, dust-floor routing, Kamino UI escape hatch rules | ~30 |
| `server/chat.ts` | H1: stream-layer post-hoc footnote injection on hallucination patterns | ~25 |
| `server/chat.test.ts` | H1: tests for footnote injection | ~30 |
| `docs/demo-script.md` | H4: funding bump (`≥6 USDC` → `≥15 USDC`) + edge-case appendix | ~30 |
| `CLAUDE.md` | Stack gotchas: Solflare-bypasses-RPC + dust-floor reality | ~15 |
| `~/.claude/.../memory/solflare-bypasses-our-rpc.md` | New project memory (dispatched, gitignored) | ~30 |
| `~/.claude/.../memory/kamino-net-value-floor.md` | Updated: empirical $5 floor + Cluster H reference | ~5 |
| `~/.claude/.../memory/MEMORY.md` | New index entry pointer | ~1 |

**Net delta:** ~320 source/test lines, +23 tests (287 → 310). Bundle delta: ~+1 kB main (insignificant).

**Data flow change (the load-bearing one):**

```
BEFORE (current — opaque failure):
User clicks Sign → useWallet.sendTransaction(tx, conn)
  → Solflare adapter → solflare.signAndSendTransaction (extension internal)
  → Solflare's RPC (we have no visibility) → fail → empty WalletSendTransactionError
  → walletError.ts misclassifies as 'cancelled'

AFTER (structured failure visibility):
User clicks Sign → useWallet.signTransaction(tx)
  → Solflare adapter → solflare.signTransaction (sign-only, deterministic)
  → returns signed VersionedTransaction
  → connection.sendRawTransaction(signed.serialize()) [our /api/rpc → Helius]
  → if RPC rejects → SendTransactionError with .logs and .signature (structured)
  → walletError.ts classifies precisely (dust-floor / blockhash-expired / etc.)
  → user sees actionable message
```

## Component designs

### H6 — TxStatusCard sign-mechanism switch

**File:** `src/components/chat/TxStatusCard.tsx` (250 lines, ~15 lines diff)

Replace the implicit `sendTransaction` with explicit `signTransaction` + `connection.sendRawTransaction` so the wallet only signs and we own the broadcast through our `/api/rpc` proxy.

```ts
const { publicKey, connected, signTransaction } = useWallet();
const { connection } = useConnection();

const handleSign = async () => {
  if (!connected || !publicKey) {
    setError({ kind: 'unknown', message: 'Connect a wallet first.' });
    setPhase('failed');
    return;
  }
  if (!signTransaction) {
    setError({
      kind: 'unknown',
      message: 'Wallet does not support signTransaction. Try a different wallet.'
    });
    setPhase('failed');
    return;
  }
  setError(null);
  setPhase('signing');
  try {
    const txBytes = decodeBase64ToBytes(transaction.base64Txn);
    const tx = VersionedTransaction.deserialize(txBytes);

    // Step 1: Wallet ONLY signs (deterministic across all Wallet-Standard wallets)
    const signed = await signTransaction(tx);

    // Phase transition fires earlier — broadcast is now our concern
    setPhase('broadcasting');

    // Step 2: WE broadcast through OUR /api/rpc → Helius
    const sig = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
      preflightCommitment: 'confirmed',
    });

    setSignature(sig);
    onStatusChange?.({ status: 'submitted', signature: sig });

    // Existing poll loop unchanged — uses our connection.getSignatureStatuses
    const lastValidBlockHeight = Number(transaction.lastValidBlockHeight);
    const outcome = await pollSignatureStatus(connection, sig, lastValidBlockHeight);
    if (cancelRef.current) return;

    if (outcome.status === 'confirmed') {
      setPhase('confirmed');
      onStatusChange?.({ status: 'confirmed' });
    } else {
      const classified = classifyWalletError(new Error(outcome.reason));
      setError(classified);
      setPhase('failed');
      onStatusChange?.({ status: 'failed', error: outcome.reason });
    }
  } catch (err) {
    // Now err is one of:
    //   - WalletSignTransactionError (user rejected sign) — classified as 'cancelled'
    //   - SendTransactionError from Helius (structured, with .logs) — classified by branch
    //   - Network error reaching /api/rpc — classified as 'network'
    console.error('[Kami] sign or broadcast failed', err);
    const classified = classifyWalletError(err);
    setError(classified);
    setPhase('failed');
    onStatusChange?.({ status: 'failed', error: classified.message });
  }
};
```

**Hydration path (PR #52) is unchanged.** The resume `useEffect` (lines 100-121 current) polls via `connection.getSignatureStatuses` which already uses our `/api/rpc`.

**Universally safe** because `signTransaction` is a Wallet Standard CORE method implemented by every modern Solana wallet (Solflare, Phantom, Backpack, Glow, Magic Eden, etc.). Only legacy non-Wallet-Standard wallets might lack it; the explicit guard handles that edge case gracefully.

### H3 — walletError classifier enhancements

**File:** `src/lib/walletError.ts` (128 lines, +30 lines)

New error kinds:
```ts
export type WalletErrorKind =
  | 'cancelled'
  | 'expired'
  | 'timeout'
  | 'insufficient'
  | 'network'
  | 'on-chain'
  | 'simulation-failed'   // NEW — pre-broadcast wallet/RPC simulation rejected
  | 'dust-floor'          // NEW — Kamino NetValueRemainingTooSmall (Anchor 0x17cc)
  | 'unknown';
```

New branches added to `classifyFromStrings` (placed BEFORE the existing empty-WalletSendTransactionError heuristic):

```ts
// H6 unlocked these errors — Helius returns structured SendTransactionError
// with .logs that we can parse for specific Anchor errors
if (haystack.includes('netvalueremainingtoosmall') || haystack.includes('0x17cc')) {
  return {
    kind: 'dust-floor',
    message: 'Kamino rejected this action — would leave the obligation below the minimum value floor.',
    hint: 'Either deposit more collateral first, do a partial repay (leaving a tiny dust amount), or use Kamino UI\'s Repay Max for atomic close-out.',
  };
}

if (haystack.includes('simulation failed') || haystack.includes('preflight check failed')) {
  return {
    kind: 'simulation-failed',
    message: 'Transaction would fail on-chain — pre-broadcast simulation rejected it.',
    hint: 'Check the failure reason in your wallet\'s popup, or retry in a moment if it was a transient state issue.',
  };
}

// NEW: WalletSignTransactionError (from new signTransaction path)
// Phantom / Backpack variants include "user" in the message; Solflare may be empty
if (name === 'WalletSignTransactionError') {
  return {
    kind: 'cancelled',
    message: 'You declined the sign request in your wallet.',
    hint: 'Click Retry to reopen the signing popup.',
  };
}
```

Existing empty-WalletSendTransactionError heuristic (line 116) gets reworded — now much rarer (signTransaction returns proper errors), and when it does fire it's truly a popup-close-without-action:

```ts
// Now rare — only fires for legacy code paths or specific adapter quirks
if (name === 'WalletSendTransactionError' && message.trim() === '') {
  return {
    kind: 'cancelled',
    message: 'Wallet returned no detail — the popup was closed without action.',
    hint: 'Reopen your wallet, watch for the signing popup, and click Approve or Reject.',
  };
}
```

### H2 — Server-side preflight + structured error

**File:** `server/tools/kamino.ts` (810 lines, +50 lines)

Current `PreflightOutcome`:
```ts
type PreflightOutcome = { ok: true } | { ok: false; error: string };
```

New structured outcome:
```ts
type PreflightErrorCode =
  | 'insufficient-sol'      // existing — wallet can't even pay fees
  | 'insufficient-rent'     // existing — first-time Kamino rent shortage
  | 'dust-floor'            // NEW — NetValueRemainingTooSmall in sim logs
  | 'simulation-failed'     // existing — generic on-chain rejection
  ;

type PreflightContext = {
  netValueAfterUsd?: number;     // for dust-floor: where they'd land
  currentDepositUsd?: number;    // for dust-floor: where they are
  currentBorrowUsd?: number;     // for dust-floor: ditto
  shortfallSol?: number;         // for insufficient-sol/rent
  failingProgram?: string;       // for simulation-failed: top-of-stack program
  failingLog?: string;           // for simulation-failed: most-relevant log line
};

type PreflightOutcome =
  | { ok: true }
  | {
      ok: false;
      errorCode: PreflightErrorCode;
      error: string;                  // human-readable, kept for backwards compat
      context: PreflightContext;      // structured for LLM routing
      suggestedAlternatives: string[];
    };
```

Detection logic added after the existing insufficient-lamports branch (around line 538):

```ts
// Dust-floor detection — Anchor 0x17cc / "NetValueRemainingTooSmall"
const dustFloorLog = logs.find((line) =>
  /NetValueRemainingTooSmall/i.test(line) ||
  /custom program error: 0x17cc/i.test(line)
);
if (dustFloorLog) {
  // Extract net value context from the action's portfolio snapshot if available
  const ctx = await tryExtractDustFloorContext(rpc, feePayer, action, amount, symbol);
  return {
    ok: false,
    errorCode: 'dust-floor',
    error: `Kamino rejected this ${action} — would leave the obligation net value below the protocol minimum (~$5 USD floor). Current position: $${ctx.currentDepositUsd?.toFixed(2)} deposited, $${ctx.currentBorrowUsd?.toFixed(2)} borrowed → net $${ctx.netValueAfterUsd?.toFixed(2)} after this action.`,
    context: ctx,
    suggestedAlternatives:
      action === 'repay' && approxEquals(amount, ctx.currentBorrowUsd)
        ? ['add-collateral-then-retry', 'partial-repay-leave-dust', 'kamino-ui-repay-max']
        : action === 'withdraw'
          ? ['repay-borrow-first', 'partial-withdraw', 'kamino-ui']
          : ['add-collateral', 'kamino-ui'],
  };
}

// Existing fallthrough — generic simulation failure (kept, just reshape return)
return {
  ok: false,
  errorCode: 'simulation-failed',
  error: `Simulation failed for ${action} ${amount} ${symbol}: ${errStr}. Last logs: ${tail}`,
  context: { failingProgram: extractTopProgram(logs), failingLog: tail },
  suggestedAlternatives: [],
};
```

Build* tools (line 645+ for buildRepay) now pass the structured outcome through to the LLM:
```ts
if (!preflight.ok) {
  return {
    error: preflight.error,
    errorCode: preflight.errorCode,
    context: preflight.context,
    suggestedAlternatives: preflight.suggestedAlternatives,
  };
}
```

**LLM behavior** (governed by H2 + H5 prompt rules): reads `errorCode === 'dust-floor'` + `context` + `suggestedAlternatives`, decides based on user intent in the conversation. See H1+H2+H5 prompt rules below.

### H1 + H2 + H5 — System prompt rules

**File:** `server/prompt.ts` (45 lines, +30 lines)

Three new rules added after line 20 (the existing rent-error rule):

```
- HALLUCINATION GUARD (CRITICAL): Never claim "transaction is ready", "Sign & Send card should appear", "card now appears in your UI", or any equivalent phrasing UNLESS your immediately-previous step was a successful build* tool result. If a build* tool returned an error or you have not called it in this turn, do NOT narrate as if a transaction was built. Instead, acknowledge the failure explicitly and either retry the tool or surface alternatives.

- DUST FLOOR ROUTING: When a build* tool returns errorCode "dust-floor", read the suggestedAlternatives array and the context (currentDepositUsd, currentBorrowUsd, netValueAfterUsd) to choose the right recovery path:
  • If user said "repay all" / "fully close" AND context.netValueAfterUsd < 5 AND alternatives include "add-collateral-then-retry": tell the user their position is below Kamino's ~$5 minimum-obligation floor; offer to deposit more collateral (suggest a specific USD amount to reach $10 net) OR direct them to Kamino UI's Repay Max (https://app.kamino.finance) which handles atomic close-out.
  • If user said "repay all" AND context.netValueAfterUsd >= 5 AND alternatives include "partial-repay-leave-dust": offer to retry with a slightly smaller amount (current borrow × 0.99) — this leaves a tiny dust borrow but clears the floor.
  • If user said "repay X (specific amount)" AND dust-floor hits: suggest reducing X to X × 0.99 and retry; explain the buffer is to avoid the dust floor.
  • If user said "withdraw all" AND alternatives include "repay-borrow-first": suggest repaying the borrow first.

- KAMINO UI ESCAPE HATCH: When Kami cannot complete an action due to a Kamino protocol limitation (errorCode "dust-floor" with no viable Kami-side alternative, or any error that suggests using the Kamino UI), prominently link to https://app.kamino.finance with a one-line explanation of which UI feature handles the case (e.g., "Repay Max" for atomic close, or "Manage" for the specific reserve). Frame Kamino UI as the canonical escape hatch — Kami's job is to make 95% of cases easy, the protocol's UI handles the 5% edge cases.
```

### H1 — Stream-layer hallucination guard

**File:** `server/chat.ts` (+25 lines)

Defense-in-depth safety net. The system-prompt rule (above) is primary; this guard catches the residual case where the LLM drifts under context pressure.

```ts
// Patterns that indicate the LLM is claiming a transaction was built when it wasn't.
// Conservative — only triggers on high-confidence phrases that actually appeared in
// today's hallucination. Tune via observability log if false positives appear.
const HALLUCINATION_PATTERNS: ReadonlyArray<RegExp> = [
  /sign\s*&\s*send\s+card\s+should\s+(now\s+)?appear/i,
  /sign\s*&\s*send\s+card\s+should\s+already\s+be\s+visible/i,
  /transaction\s+is\s+ready/i,
  /your\s+(repay|deposit|borrow|withdraw)\s+transaction\s+is\s+ready/i,
];

interface ToolEventSummary {
  type: string;
  toolName?: string;
  isError?: boolean;
}

export function detectHallucinatedTxClaim(
  fullText: string,
  toolEvents: ReadonlyArray<ToolEventSummary>
): boolean {
  const matched = HALLUCINATION_PATTERNS.some((p) => p.test(fullText));
  if (!matched) return false;
  // Find the LAST successful build* tool-result event in this turn.
  const lastBuildResult = [...toolEvents].reverse().find(
    (e) => e.type === 'tool-result' && e.toolName?.startsWith('build') && !e.isError
  );
  // If we matched a hallucination phrase but there's NO successful build* tool-result
  // within this turn, it's a hallucination.
  return !lastBuildResult;
}

// At end of streamText completion, before forwarding the final-finish event:
if (detectHallucinatedTxClaim(fullAssistantText, toolEvents)) {
  // Append a system-style footnote (never block/discard the response).
  await writeTextDelta(stream, '\n\n---\n*⚠️ System note: a transaction was NOT actually built. Please rephrase your request and try again.*');
  log.warn('hallucination_guard_triggered', {
    matchedPattern: HALLUCINATION_PATTERNS.find(p => p.test(fullAssistantText))?.toString(),
    toolCallCount: toolEvents.filter(e => e.type === 'tool-call').length,
  });
}
```

**Why append-only is safe:** worst case (false positive on a legitimate response) is an annoying footnote, never a broken UX. Conservative patterns + per-turn scope minimize false-positive risk.

### H4 — docs/demo-script.md updates

Production checklist (line 89) gets the funding bump + edge-case appendix. Empirically validated: the recording's Shot 7 needs `≥ $10 USD net obligation value` after the borrow, which means `≥ 15 USDC` deposited (5 supplied + 5+ buffer + 5 deposited in Shot 5).

New appendix: "Edge cases & known limits (added 2026-05-01 from live testing)" documenting the NetValueRemainingTooSmall floor, first-time rent constraint, and the OBSOLETE Solflare opaque-broadcast issue (now fixed in this cluster).

### Memory + CLAUDE.md updates

- **CLAUDE.md** Stack gotchas section gets two new bullets: Solflare-bypasses-RPC + dust-floor reality (each ~7 lines, with PR reference).
- **New memory** `solflare-bypasses-our-rpc.md` — full diagnostic story, verified via Chrome MCP fetch instrumentation.
- **Updated memory** `kamino-net-value-floor.md` — bump empirical floor from "~$1-$5" to "~$5 USD net (validated 2026-05-01)" + Cluster H reference.
- **MEMORY.md index** — new line for the Solflare memory.

## Test strategy

**Hybrid TDD per project convention:**
- **Strict TDD** for pure logic (preflight error categorization, walletError classifier branches, hallucination detection function)
- **Pragmatic test-after** for integration surfaces (TxStatusCard sign-mechanism switch — needs wallet/connection mocking)

**Test count target:** 287 → ~310 (+23 across 6 test files).

**Coverage by H-item:**
- H1: 6 new tests in `server/chat.test.ts` (hallucination patterns + tool-event sequencing)
- H2: 7 new tests in `server/tools/kamino.test.ts` (dust-floor detection, structured shape, suggestedAlternatives by intent)
- H3: 6 new tests in `src/lib/walletError.test.ts` (dust-floor / simulation-failed / WalletSignTransactionError)
- H6: 4 new tests in `src/components/chat/TxStatusCard.test.tsx` (signTransaction mock + sendRawTransaction + classifies SendTransactionError + classifies WalletSignTransactionError)
- H4 / H5 / docs: no test code (text-only changes; reviewed manually)

**Mutation testing in cluster review:** verify 3 invariants catch their regression class:
1. dust-floor pattern detection in walletError catches `0x17cc` AND `NetValueRemainingTooSmall`
2. hallucination guard catches phrase-without-tool-result + ignores phrase-with-tool-result
3. signTransaction failure path classifies WalletSignTransactionError (not WalletSendTransactionError) as cancelled

## Sequencing

Subagent-driven-development pattern (per Day 14-16 sprints):
1. **Task 1 (H6 sign mechanism):** TxStatusCard.tsx switch + test updates. Gate: all existing tests pass + new sign+broadcast path tests pass.
2. **Task 2 (H3 classifier):** walletError.ts new branches + tests. Gate: all classifier tests pass.
3. **Task 3 (H2 preflight + structured error):** kamino.ts dust-floor detection + structured outcome shape + tests. Gate: kamino.test passes + integration with build* tools verified.
4. **Task 4 (H1+H2+H5 prompt rules):** prompt.ts text changes. No code tests; reviewed by reading prompt + smoke test in production after deploy.
5. **Task 5 (H1 stream-layer guard):** chat.ts detection function + footnote injection + tests. Gate: chat.test passes including injection scenarios.
6. **Task 6 (H4 docs + memory + CLAUDE.md):** doc-only changes. No tests.

Each task gets two-stage review (spec compliance + code quality opus) per project convention.

After all 6 tasks ship: cluster-level opus review + post-deploy live smoke test (one signed tx end-to-end on production with the new sign mechanism — validates the full chain works for a real wallet).

## Risks + mitigations

- **Risk: signTransaction-only path breaks for a wallet that lacks it.** Mitigation: explicit `if (!signTransaction)` guard with friendly error message. Wallet Standard mandates this method, so practical risk is near-zero.
- **Risk: stream-layer guard false-positives on legitimate responses.** Mitigation: conservative patterns (only 4 specific phrases tested today), append-only footnote (never blocks response), observability log for tuning.
- **Risk: dust-floor detection regex misses a Kamino error variant.** Mitigation: detect both `NetValueRemainingTooSmall` (Anchor message) AND `0x17cc` (custom program error code) — covers both formats Helius emits.
- **Risk: tryExtractDustFloorContext is slow (additional getPortfolio call).** Mitigation: only fires on dust-floor detection (rare path); cached portfolio snapshot from the build* tool's earlier call can be reused if available.
- **Risk: PR #52 reload hydration breaks because TxStatusCard changes.** Mitigation: hydration path uses `connection.getSignatureStatuses` which is unchanged; existing 3 hydration tests in TxStatusCard.test.tsx must continue passing.

## Open questions

None at design time — all architectural decisions resolved during brainstorming Q1-Q3.

## Acceptance criteria

- All 287 existing tests + ~23 new tests pass on CI
- All 3 typechecks silent (client + server + project mode)
- TxStatusCard hydration tests (PR #52) all pass unchanged
- Post-deploy live smoke: one signed tx end-to-end on https://kami.rectorspace.com using the new sign-mechanism path
- Cluster reviewer (opus) verdict: SHIP IT, 0 Critical, 0 Important
- Solflare empty-error symptom NO LONGER reproducible after the fix (manual verification: trigger a dust-floor scenario; should now see structured error with `kind: 'dust-floor'`, not `kind: 'cancelled'`)
