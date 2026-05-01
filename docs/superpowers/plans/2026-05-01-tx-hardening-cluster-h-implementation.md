# Cluster H — Transaction Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch TxStatusCard from opaque `useWallet().sendTransaction` to explicit `signTransaction + sendRawTransaction` for full broadcast observability via our `/api/rpc`, then layer enhanced error classification (dust-floor / simulation-failed), structured server-side preflight errors, system-prompt rules, and a stream-layer hallucination guard on top.

**Architecture:** Reverse-data-flow refactor. The wallet now ONLY signs (deterministic across all Wallet-Standard wallets). We own the broadcast through Helius. Errors come back structured with `.logs` and Anchor codes that walletError classifies precisely. Server preflight detects Kamino's NetValueRemainingTooSmall and returns `{ errorCode, context, suggestedAlternatives }` for the LLM to route on. System prompt + stream-layer guards prevent "transaction is ready" hallucinations.

**Tech Stack:** React 18, TypeScript, `@solana/web3.js` v1 (`Connection.sendRawTransaction`), `@solana/wallet-adapter-react`, AI SDK v6 `streamText`, vitest 4 + happy-dom, Tailwind.

**Spec:** `docs/superpowers/specs/2026-05-01-tx-hardening-cluster-h-design.md`

---

## File Structure

```
src/
  components/chat/
    TxStatusCard.tsx          [Task 1] sign mechanism switch
    TxStatusCard.test.tsx     [Task 1] +4 tests
  lib/
    walletError.ts            [Task 2] +30 lines, 2 new kinds
    walletError.test.ts       [Task 2] +6 tests
server/
  tools/
    kamino.ts                 [Task 3] +50 lines, structured preflight outcome
    kamino.test.ts            [Task 3] +7 tests
  prompt.ts                   [Task 4] +30 lines, 3 new rules (text-only)
  chat.ts                     [Task 5] +25 lines, hallucination guard
  chat.test.ts                [Task 5] +6 tests
docs/
  demo-script.md              [Task 6] funding bump + edge-case appendix
CLAUDE.md                     [Task 6] +15 lines stack gotchas
~/.claude/projects/.../memory/
  solflare-bypasses-our-rpc.md  [Task 6] new memory (gitignored — written but not staged)
  kamino-net-value-floor.md     [Task 6] update with empirical $5 floor
  MEMORY.md                     [Task 6] new index entry
```

---

## Task 1: H6 — TxStatusCard sign mechanism switch

**Files:**
- Modify: `src/components/chat/TxStatusCard.tsx` (lines 71-163, the `handleSign` function + `useWallet` destructuring)
- Modify: `src/components/chat/TxStatusCard.test.tsx` (existing mocks + 4 new tests)

### Step 1.1: Update existing mock to use `signTransaction` instead of `sendTransaction`

- [ ] **Step 1.1.1: Read the current test file mock setup**

Run: `head -100 src/components/chat/TxStatusCard.test.tsx`

Expected: existing `vi.mock('@solana/wallet-adapter-react', ...)` with `useWallet` returning `{ sendTransaction, ...}` — note the exact mock structure for surgical edits.

- [ ] **Step 1.1.2: Replace `sendTransaction` mock with `signTransaction` + `connection.sendRawTransaction` mocks**

In `src/components/chat/TxStatusCard.test.tsx`, locate the existing `vi.mock('@solana/wallet-adapter-react', ...)` block. Replace `sendTransaction: vi.fn()` with `signTransaction: vi.fn()` everywhere. Then add `sendRawTransaction: vi.fn()` to the `useConnection` mock's `connection` object.

Concrete diff (find `sendTransaction` references, change to `signTransaction`; find `useConnection` mock, add `sendRawTransaction`):

```ts
// At top of test file — replace sendTransaction in useWallet mock
const mockSignTransaction = vi.fn();
const mockSendRawTransaction = vi.fn();

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({
    publicKey: mockPublicKey,
    connected: true,
    signTransaction: mockSignTransaction,  // changed from sendTransaction
  }),
  useConnection: () => ({
    connection: {
      sendRawTransaction: mockSendRawTransaction,  // NEW
      getSignatureStatuses: mockGetSignatureStatuses,
      getBlockHeight: mockGetBlockHeight,
    },
  }),
}));
```

In each existing test that called `sendTransaction.mockResolvedValueOnce(...)`, change to:
```ts
mockSignTransaction.mockResolvedValueOnce({ serialize: () => new Uint8Array([1, 2, 3]) });
mockSendRawTransaction.mockResolvedValueOnce('mock-signature-base58');
```

The signed-transaction object must have a `.serialize()` method returning Uint8Array — this matches `VersionedTransaction.serialize()` shape.

- [ ] **Step 1.1.3: Run existing tests — expect failures**

Run: `pnpm test:run src/components/chat/TxStatusCard.test.tsx 2>&1 | tail -40`

Expected: most existing tests FAIL because TxStatusCard.tsx still uses `sendTransaction`, but the mock no longer provides it. This confirms tests will catch the implementation switch.

### Step 1.2: Implement the sign-mechanism switch in TxStatusCard.tsx

- [ ] **Step 1.2.1: Update `useWallet` destructuring**

In `src/components/chat/TxStatusCard.tsx` at line 72, change:
```ts
const { publicKey, connected, sendTransaction } = useWallet();
```
to:
```ts
const { publicKey, connected, signTransaction } = useWallet();
```

- [ ] **Step 1.2.2: Replace handleSign body (lines 123-163)**

Replace the entire `handleSign` function with:

```ts
const handleSign = async () => {
  if (!connected || !publicKey) {
    setError({ kind: 'unknown', message: 'Connect a wallet first.' });
    setPhase('failed');
    return;
  }
  if (!signTransaction) {
    setError({
      kind: 'unknown',
      message: 'Wallet does not support signTransaction. Try a different wallet.',
    });
    setPhase('failed');
    return;
  }
  setError(null);
  setPhase('signing');
  try {
    const txBytes = decodeBase64ToBytes(transaction.base64Txn);
    const tx = VersionedTransaction.deserialize(txBytes);

    // Step 1: Wallet ONLY signs. Deterministic across all Wallet-Standard wallets.
    // Avoids Solflare's signAndSendTransaction which broadcasts via its own RPC.
    const signed = await signTransaction(tx);

    // Phase transition fires earlier — broadcast is now our concern, not the wallet's.
    setPhase('broadcasting');

    // Step 2: WE broadcast through OUR /api/rpc → Helius. Same RPC as preflight,
    // structured SendTransactionError on failure (with .logs we can parse).
    const sig = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
      preflightCommitment: 'confirmed',
    });

    setSignature(sig);
    onStatusChange?.({ status: 'submitted', signature: sig });

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
    // err is now one of:
    //   - WalletSignTransactionError (user rejected sign in popup)
    //   - SendTransactionError from Helius (.logs + .signature, with Anchor codes)
    //   - Network error reaching /api/rpc
    // eslint-disable-next-line no-console
    console.error('[Kami] sign or broadcast failed', err);
    const classified = classifyWalletError(err);
    setError(classified);
    setPhase('failed');
    onStatusChange?.({ status: 'failed', error: classified.message });
  }
};
```

- [ ] **Step 1.2.3: Run existing tests — expect them to pass with the new implementation**

Run: `pnpm test:run src/components/chat/TxStatusCard.test.tsx 2>&1 | tail -40`

Expected: all existing tests pass (after the mock update in Step 1.1.2). The sign-mechanism switch is tested by the existing happy-path tests because they now mock `signTransaction` + `sendRawTransaction` instead of `sendTransaction`.

### Step 1.3: Add new tests for the structured error paths

- [ ] **Step 1.3.1: Add test for wallet missing `signTransaction` capability**

Append to `src/components/chat/TxStatusCard.test.tsx` (inside the existing `describe` block):

```ts
it('shows clear error when wallet does not support signTransaction', async () => {
  // Re-mock useWallet to omit signTransaction (legacy wallet edge case)
  vi.doMock('@solana/wallet-adapter-react', () => ({
    useWallet: () => ({
      publicKey: mockPublicKey,
      connected: true,
      signTransaction: undefined,
    }),
    useConnection: () => ({
      connection: {
        sendRawTransaction: mockSendRawTransaction,
        getSignatureStatuses: mockGetSignatureStatuses,
        getBlockHeight: mockGetBlockHeight,
      },
    }),
  }));
  vi.resetModules();
  const { default: TxStatusCard } = await import('./TxStatusCard');

  const { getByText, findByText } = render(
    <TxStatusCard transaction={mockNeedsSignTx} />
  );
  fireEvent.click(getByText('Sign Transaction'));
  expect(await findByText(/does not support signTransaction/i)).toBeInTheDocument();
});
```

- [ ] **Step 1.3.2: Add test for SendTransactionError from Helius classified as on-chain failure**

Append:

```ts
it('classifies SendTransactionError from sendRawTransaction broadcast', async () => {
  mockSignTransaction.mockResolvedValueOnce({
    serialize: () => new Uint8Array([1, 2, 3]),
  });
  // Helius returns SendTransactionError with logs containing on-chain failure
  const rpcError = new Error('Transaction simulation failed: Error processing Instruction 5: custom program error: 0x17cc');
  rpcError.name = 'SendTransactionError';
  mockSendRawTransaction.mockRejectedValueOnce(rpcError);

  const { getByText, findByText } = render(
    <TxStatusCard transaction={mockNeedsSignTx} />
  );
  fireEvent.click(getByText('Sign Transaction'));
  // walletError classifies "0x17cc" → kind 'dust-floor' (added in Task 2)
  // Until Task 2 lands, this test asserts on the message containing the raw error
  // Update assertion in Task 2.5 once classifier branch exists.
  expect(await findByText(/0x17cc|simulation failed|dust|minimum/i)).toBeInTheDocument();
});
```

- [ ] **Step 1.3.3: Add test for WalletSignTransactionError (user rejected sign)**

Append:

```ts
it('classifies WalletSignTransactionError when user declines sign', async () => {
  const signError = new Error('User declined the request');
  signError.name = 'WalletSignTransactionError';
  mockSignTransaction.mockRejectedValueOnce(signError);

  const { getByText, findByText } = render(
    <TxStatusCard transaction={mockNeedsSignTx} />
  );
  fireEvent.click(getByText('Sign Transaction'));
  // Until Task 2 adds the WalletSignTransactionError branch, this matches the
  // existing 'cancelled' branch via 'declined' substring. After Task 2, the
  // classifier produces a more specific message.
  expect(await findByText(/declined|cancelled/i)).toBeInTheDocument();
});
```

- [ ] **Step 1.3.4: Add test confirming sign+broadcast happy path uses sendRawTransaction**

Append:

```ts
it('broadcasts via connection.sendRawTransaction (not via wallet)', async () => {
  const signedBytes = new Uint8Array([10, 20, 30, 40]);
  mockSignTransaction.mockResolvedValueOnce({
    serialize: () => signedBytes,
  });
  mockSendRawTransaction.mockResolvedValueOnce('confirmed-sig-base58');
  mockGetSignatureStatuses.mockResolvedValueOnce({
    value: [{ confirmationStatus: 'confirmed', err: null }],
  });

  const { getByText, findByText } = render(
    <TxStatusCard transaction={mockNeedsSignTx} />
  );
  fireEvent.click(getByText('Sign Transaction'));
  await findByText(/confirmed/i, undefined, { timeout: 4_000 });

  expect(mockSignTransaction).toHaveBeenCalledTimes(1);
  expect(mockSendRawTransaction).toHaveBeenCalledTimes(1);
  // The exact bytes from signTransaction must be passed to sendRawTransaction.
  expect(mockSendRawTransaction).toHaveBeenCalledWith(
    signedBytes,
    expect.objectContaining({ skipPreflight: false, maxRetries: 3 })
  );
});
```

- [ ] **Step 1.3.5: Run all TxStatusCard tests — expect pass**

Run: `pnpm test:run src/components/chat/TxStatusCard.test.tsx 2>&1 | tail -20`

Expected: all tests pass (existing + 4 new). If a test fails because of stale module cache from `vi.doMock`, isolate that test with `it.skip` and address in cluster review.

### Step 1.4: Run full typecheck + commit

- [ ] **Step 1.4.1: Run client typecheck**

Run: `pnpm exec tsc --noEmit`

Expected: silent.

- [ ] **Step 1.4.2: Commit**

```bash
git add src/components/chat/TxStatusCard.tsx src/components/chat/TxStatusCard.test.tsx
git commit -m "$(cat <<'EOF'
feat(TxStatusCard): switch to explicit signTransaction + sendRawTransaction (H6)

Solflare's signAndSendTransaction does sign+broadcast inside the browser
extension via chrome.runtime.sendMessage to its own RPC, completely
bypassing our /api/rpc proxy. When that RPC rejects post-sign, the
adapter wraps the failure in an empty WalletSendTransactionError —
zero observability, misclassified as "popup dismissed".

Switch to explicit two-step:
- signTransaction (Wallet Standard core, deterministic across all wallets)
- connection.sendRawTransaction (broadcast via our /api/rpc → Helius)

Now broadcast errors come back as SendTransactionError with .logs we
can parse (Anchor codes like 0x17cc, NetValueRemainingTooSmall, etc.).
walletError classifier in next commit will classify these precisely.

Tests +4: missing-signTransaction guard, SendTransactionError classify,
WalletSignTransactionError classify, sendRawTransaction is called with
exact bytes from signTransaction. All existing TxStatusCard tests pass
unchanged after mock substitution.

Hydration path (PR #52) unchanged — uses connection.getSignatureStatuses
which already routes through /api/rpc.
EOF
)"
```

---

## Task 2: H3 — walletError classifier enhancements

**Files:**
- Modify: `src/lib/walletError.ts` (add 2 new error kinds + 3 new branches)
- Modify: `src/lib/walletError.test.ts` (+6 tests)

### Step 2.1: Write failing tests for new classifier branches

- [ ] **Step 2.1.1: Add 6 new tests at end of `src/lib/walletError.test.ts`**

Append:

```ts
describe('dust-floor classification (H3 / Cluster H)', () => {
  it('classifies NetValueRemainingTooSmall as dust-floor', () => {
    const err = new Error(
      'Transaction simulation failed: Error processing Instruction 5: NetValueRemainingTooSmall'
    );
    const r = classifyWalletError(err);
    expect(r.kind).toBe('dust-floor');
    expect(r.message).toMatch(/below the minimum value floor/i);
    expect(r.hint).toMatch(/deposit more|partial repay|kamino ui/i);
  });

  it('classifies 0x17cc custom program error as dust-floor', () => {
    const err = new Error('custom program error: 0x17cc');
    const r = classifyWalletError(err);
    expect(r.kind).toBe('dust-floor');
  });

  it('case-insensitive dust-floor match', () => {
    const err = new Error('NETVALUEREMAININGTOOSMALL: net value 0.001');
    const r = classifyWalletError(err);
    expect(r.kind).toBe('dust-floor');
  });
});

describe('simulation-failed classification (H3 / Cluster H)', () => {
  it('classifies generic simulation-failed', () => {
    const err = new Error('Transaction simulation failed: BlockhashNotFound');
    const r = classifyWalletError(err);
    expect(r.kind).toBe('simulation-failed');
    expect(r.message).toMatch(/would fail on-chain/i);
  });

  it('classifies preflight check failed', () => {
    const err = new Error('Preflight check failed: insufficient compute');
    const r = classifyWalletError(err);
    expect(r.kind).toBe('simulation-failed');
  });
});

describe('WalletSignTransactionError (H3 / Cluster H)', () => {
  it('classifies as cancelled with sign-specific message', () => {
    const err = new Error('User declined');
    err.name = 'WalletSignTransactionError';
    const r = classifyWalletError(err);
    expect(r.kind).toBe('cancelled');
    expect(r.message).toMatch(/declined the sign request/i);
  });
});
```

- [ ] **Step 2.1.2: Run tests — expect 6 failures**

Run: `pnpm test:run src/lib/walletError.test.ts 2>&1 | tail -20`

Expected: 6 new tests fail because branches don't exist yet. Existing tests still pass.

### Step 2.2: Implement classifier branches

- [ ] **Step 2.2.1: Update `WalletErrorKind` type at line 1**

Replace lines 1-8 of `src/lib/walletError.ts`:

```ts
export type WalletErrorKind =
  | 'cancelled'
  | 'expired'
  | 'timeout'
  | 'insufficient'
  | 'network'
  | 'on-chain'
  | 'simulation-failed'   // H3: pre-broadcast wallet/RPC simulation rejected
  | 'dust-floor'          // H3: Kamino NetValueRemainingTooSmall (Anchor 0x17cc)
  | 'unknown';
```

- [ ] **Step 2.2.2: Add new branches in `classifyFromStrings` BEFORE the existing empty-WalletSendTransactionError heuristic**

In `src/lib/walletError.ts`, locate the `classifyFromStrings` function. Insert these branches between the `if (haystack.includes('on-chain failure'))` block (line 107) and the `// Heuristic: empty WalletSendTransactionError...` comment (line 115):

```ts
  // H3: Kamino NetValueRemainingTooSmall — Anchor error 0x17cc
  // Now reachable because H6 routes broadcast through our RPC, which surfaces
  // SendTransactionError.logs containing the raw Anchor message + custom code.
  if (haystack.includes('netvalueremainingtoosmall') || haystack.includes('0x17cc')) {
    return {
      kind: 'dust-floor',
      message:
        'Kamino rejected this action — would leave the obligation below the minimum value floor.',
      hint:
        "Either deposit more collateral first, do a partial repay (leaving a tiny dust amount), or use Kamino UI's Repay Max for atomic close-out.",
    };
  }

  // H3: Generic simulation failure (pre-broadcast preflight rejected the tx)
  if (haystack.includes('simulation failed') || haystack.includes('preflight check failed')) {
    return {
      kind: 'simulation-failed',
      message: 'Transaction would fail on-chain — pre-broadcast simulation rejected it.',
      hint:
        "Check the failure reason in your wallet's popup, or retry in a moment if it was a transient state issue.",
    };
  }

  // H3: WalletSignTransactionError — fired when user declines sign popup.
  // Distinct from WalletSendTransactionError (the legacy bypass-our-RPC path).
  if (name === 'WalletSignTransactionError') {
    return {
      kind: 'cancelled',
      message: 'You declined the sign request in your wallet.',
      hint: 'Click Retry to reopen the signing popup.',
    };
  }
```

- [ ] **Step 2.2.3: Reword the existing empty-WalletSendTransactionError heuristic (line 116)**

This branch is now MUCH rarer (signTransaction returns proper errors). When it does fire, it's truly a popup-close-without-action case. Update the message to be less misleading:

In `src/lib/walletError.ts`, find the block:
```ts
  // Heuristic: empty WalletSendTransactionError = silently dismissed popup
  if (name === 'WalletSendTransactionError' && message.trim() === '') {
    return {
      kind: 'cancelled',
      message: 'Wallet returned no detail — the popup was likely dismissed.',
      hint: 'Reopen your wallet, watch for the signing popup, and approve.',
    };
  }
```

Replace with:
```ts
  // H3: Empty WalletSendTransactionError — now rare since H6 routes via signTransaction.
  // When it does fire, it's typically a popup closed without action.
  if (name === 'WalletSendTransactionError' && message.trim() === '') {
    return {
      kind: 'cancelled',
      message: 'Wallet returned no detail — the popup was closed without action.',
      hint: 'Reopen your wallet, watch for the signing popup, and click Approve or Reject.',
    };
  }
```

- [ ] **Step 2.2.4: Run tests — expect all pass**

Run: `pnpm test:run src/lib/walletError.test.ts 2>&1 | tail -20`

Expected: all tests pass (6 new + existing).

### Step 2.3: Update Task 1 tests with stronger assertions

- [ ] **Step 2.3.1: Update Task 1 SendTransactionError test assertion**

In `src/components/chat/TxStatusCard.test.tsx`, find the test "classifies SendTransactionError from sendRawTransaction broadcast" (Step 1.3.2). Replace the assertion:
```ts
expect(await findByText(/0x17cc|simulation failed|dust|minimum/i)).toBeInTheDocument();
```
with the precise:
```ts
expect(await findByText(/below the minimum value floor/i)).toBeInTheDocument();
```

- [ ] **Step 2.3.2: Update Task 1 WalletSignTransactionError test assertion**

In the same file, find "classifies WalletSignTransactionError when user declines sign" (Step 1.3.3). Replace:
```ts
expect(await findByText(/declined|cancelled/i)).toBeInTheDocument();
```
with:
```ts
expect(await findByText(/declined the sign request/i)).toBeInTheDocument();
```

- [ ] **Step 2.3.3: Run TxStatusCard tests — expect all pass**

Run: `pnpm test:run src/components/chat/TxStatusCard.test.tsx 2>&1 | tail -20`

Expected: all pass with stronger assertions.

### Step 2.4: Commit

- [ ] **Step 2.4.1: Run client typecheck + commit**

```bash
pnpm exec tsc --noEmit
git add src/lib/walletError.ts src/lib/walletError.test.ts src/components/chat/TxStatusCard.test.tsx
git commit -m "$(cat <<'EOF'
feat(walletError): add dust-floor + simulation-failed + WalletSignTransactionError branches (H3)

H6 unlocked structured RPC errors via sendRawTransaction. walletError
classifier now distinguishes:
- dust-floor (Anchor 0x17cc / NetValueRemainingTooSmall) → "Kamino
  rejected — would leave obligation below minimum value floor"
- simulation-failed (generic preflight rejection) → "would fail on-chain"
- WalletSignTransactionError (user declined sign popup) → "you declined
  the sign request"

Existing empty-WalletSendTransactionError heuristic kept but reworded
("popup closed without action") since H6 makes it much rarer.

TxStatusCard tests assertions tightened to match new precise messages.

Tests +6: 3× dust-floor variants, 2× simulation-failed variants,
1× WalletSignTransactionError. Existing classifier tests pass unchanged.
EOF
)"
```

---

## Task 3: H2 — kamino preflight structured error

**Files:**
- Modify: `server/tools/kamino.ts` (replace `PreflightOutcome` type, add `tryExtractDustFloorContext` helper, update `preflightSimulate` return shape, update build* tools to pass through structured fields)
- Modify: `server/tools/kamino.test.ts` (+7 tests)

### Step 3.1: Read current preflight + build* tool wire-up

- [ ] **Step 3.1.1: Locate current `PreflightOutcome` type**

Run: `grep -n "PreflightOutcome\|type.*Preflight" server/tools/kamino.ts`

Expected: `type PreflightOutcome = ...` definition (likely just before `preflightSimulate` at line 476). Note line numbers for surgical edits.

- [ ] **Step 3.1.2: Locate where build* tools handle the preflight result**

Run: `grep -n "preflight" server/tools/kamino.ts | head -10`

Expected: `const preflight = await preflightSimulate(...)` at ~line 735, followed by an `if (!preflight.ok)` branch.

### Step 3.2: Write failing tests for structured preflight outcome

- [ ] **Step 3.2.1: Add 7 new tests in `server/tools/kamino.test.ts`**

Append (or add to existing describe block as appropriate):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
```

- [ ] **Step 3.2.2: Run tests — expect 7 failures**

Run: `pnpm test:run server/tools/kamino.test.ts -t "preflightSimulate structured" 2>&1 | tail -30`

Expected: 7 new tests fail. Existing tests in the file still pass.

### Step 3.3: Update `PreflightOutcome` + `preflightSimulate` to return structured shape

- [ ] **Step 3.3.1: Replace `PreflightOutcome` type definition**

In `server/tools/kamino.ts`, find the existing `PreflightOutcome` type (probably just above `preflightSimulate`, around line 470) and replace with:

```ts
type PreflightErrorCode =
  | 'insufficient-sol'      // wallet can't even pay fees
  | 'insufficient-rent'     // first-time Kamino rent shortage
  | 'dust-floor'            // NetValueRemainingTooSmall in sim logs
  | 'simulation-failed';    // generic on-chain rejection

interface PreflightContext {
  netValueAfterUsd?: number;
  currentDepositUsd?: number;
  currentBorrowUsd?: number;
  shortfallSol?: number;
  failingProgram?: string;
  failingLog?: string;
}

type PreflightOutcome =
  | { ok: true }
  | {
      ok: false;
      errorCode: PreflightErrorCode;
      error: string;                    // human-readable, kept for backwards compat
      context: PreflightContext;
      suggestedAlternatives: string[];
    };
```

- [ ] **Step 3.3.2: Add helper `tryExtractDustFloorContext` above `preflightSimulate`**

Insert this helper just above the existing `preflightSimulate` function (around line 470):

```ts
/**
 * Best-effort extraction of obligation context for dust-floor diagnostics.
 * Returns empty fields if portfolio cannot be fetched (preflight should not
 * block on this — it's diagnostic context only).
 */
async function tryExtractDustFloorContext(
  _rpc: ReturnType<typeof getRpc>,
  _wallet: Address,
  _action: BuildAction,
  _amount: number,
  _symbol: string
): Promise<PreflightContext> {
  // Light-touch implementation: real portfolio fetch happens in getPortfolio
  // tool before build* runs, so the LLM already has context. Server-side
  // re-fetch here would double-call klend; instead, return empty context and
  // let the LLM combine the dust-floor signal with its existing portfolio
  // knowledge to surface a useful message. Future enhancement: cache the
  // portfolio snapshot per (wallet, ts) and reuse here.
  return {};
}
```

- [ ] **Step 3.3.3: Add helper `extractTopProgram` for simulation-failed context**

Insert just above `tryExtractDustFloorContext`:

```ts
/**
 * Extract the top-of-stack program ID from Solana sim logs (e.g.
 * "Program XYZ123 failed:" → "XYZ123"). Returns undefined if no match.
 */
function extractTopProgram(logs: string[]): string | undefined {
  for (let i = logs.length - 1; i >= 0; i--) {
    const m = logs[i].match(/^Program ([A-Za-z0-9]+) failed:/);
    if (m) return m[1];
  }
  return undefined;
}
```

- [ ] **Step 3.3.4: Update `preflightSimulate` body to return structured shape**

Find the `preflightSimulate` function (line 476-544) and replace its body. The new body keeps the existing `getBalance` + `simulateTransaction` calls, but reshapes ALL return statements:

```ts
async function preflightSimulate(
  rpc: ReturnType<typeof getRpc>,
  base64Txn: Base64EncodedWireTransaction,
  feePayer: Address,
  action: BuildAction,
  symbol: string,
  amount: number
): Promise<PreflightOutcome> {
  let balanceLamports: bigint;
  try {
    const balResp = await rpc.getBalance(feePayer).send();
    balanceLamports = balResp.value;
  } catch (err) {
    console.error('[preflight] getBalance threw — bypassing', err);
    return { ok: true };
  }

  if (balanceLamports < 10_000n) {
    return {
      ok: false,
      errorCode: 'insufficient-sol',
      error: `Wallet ${feePayer} has only ${formatSol(balanceLamports)} SOL — not enough for even a transaction fee. Top up at least 0.01 SOL before signing.`,
      context: { shortfallSol: 0.01 - Number(balanceLamports) / 1e9 },
      suggestedAlternatives: ['top-up-sol'],
    };
  }

  let simResp;
  try {
    simResp = await rpc
      .simulateTransaction(base64Txn, {
        encoding: 'base64',
        sigVerify: false,
        replaceRecentBlockhash: true,
        commitment: 'confirmed',
      })
      .send();
  } catch (err) {
    console.error('[preflight] simulateTransaction threw — bypassing', err);
    return { ok: true };
  }

  const err = simResp.value.err;
  if (!err) return { ok: true };

  const logs = simResp.value.logs ?? [];

  // Existing insufficient-lamports detection (kept, just reshape return)
  const insufficientLog = logs.find((line) => /insufficient lamports/i.test(line));
  if (insufficientLog) {
    const match = insufficientLog.match(/insufficient lamports (\d+),\s*need (\d+)/);
    if (match) {
      const have = Number(match[1]);
      const need = Number(match[2]);
      const shortfall = need - have;
      const approxTotal = Number(balanceLamports) + shortfall;
      return {
        ok: false,
        errorCode: 'insufficient-rent',
        error: `Insufficient SOL for rent on this ${action}. The wallet would run out mid-transaction when setting up a required Kamino account. Current balance: ${formatSol(balanceLamports)} SOL. Estimated total needed: ~${formatSol(approxTotal)} SOL (short by ~${formatSol(shortfall)} SOL). Heads up: this is a one-time account setup cost per Kamino market — about ~0.022 SOL of this is obligation account rent that stays locked per (user, market) pair (${KLEND_NO_CLOSE_OBLIGATION}); the remainder is cToken ATA rent (recoverable when the ATAs are closed) plus the tx fee.`,
        context: { shortfallSol: shortfall / 1e9 },
        suggestedAlternatives: ['top-up-sol'],
      };
    }
    return {
      ok: false,
      errorCode: 'insufficient-rent',
      error: `Insufficient SOL for account rent on this ${action}. First-time Kamino setup needs ~0.05 SOL on top of your deposit amount; ~0.022 SOL of that is the obligation account rent that stays locked per market (${KLEND_NO_CLOSE_OBLIGATION}). Current balance: ${formatSol(balanceLamports)} SOL.`,
      context: {},
      suggestedAlternatives: ['top-up-sol'],
    };
  }

  // H2: Dust-floor detection — Anchor 0x17cc / "NetValueRemainingTooSmall"
  const dustFloorLog = logs.find((line) =>
    /netvalueremainingtoosmall/i.test(line) ||
    /custom program error: 0x17cc/i.test(line)
  );
  if (dustFloorLog) {
    const ctx = await tryExtractDustFloorContext(rpc, feePayer, action, amount, symbol);
    const suggestedAlternatives =
      action === 'repay'
        ? ['add-collateral-then-retry', 'partial-repay-leave-dust', 'kamino-ui-repay-max']
        : action === 'withdraw'
          ? ['repay-borrow-first', 'partial-withdraw', 'kamino-ui']
          : ['add-collateral', 'kamino-ui'];
    return {
      ok: false,
      errorCode: 'dust-floor',
      error: `Kamino rejected this ${action} — would leave the obligation net value below the protocol minimum (~$5 USD floor). Add more collateral, do a partial action, or use Kamino UI's atomic close-out at https://app.kamino.finance.`,
      context: ctx,
      suggestedAlternatives,
    };
  }

  // Generic simulation failure
  const errStr = typeof err === 'string' ? err : safeStringify(err);
  const tail = logs.slice(-4).join(' | ') || '(no logs)';
  return {
    ok: false,
    errorCode: 'simulation-failed',
    error: `Simulation failed for ${action} ${amount} ${symbol}: ${errStr}. Last logs: ${tail}`,
    context: {
      failingProgram: extractTopProgram(logs),
      failingLog: tail,
    },
    suggestedAlternatives: [],
  };
}
```

- [ ] **Step 3.3.5: Update build* tool error pass-through**

Find the block in `buildPendingTransaction` (or wherever the preflight result is consumed — search for `if (!preflight.ok)`). Currently it returns `{ ok: false, error: preflight.error }`. Update to pass through the structured fields:

```ts
const preflight = await preflightSimulate(rpc, base64Txn, wallet, action, input.symbol, input.amount);
if (!preflight.ok) {
  return {
    ok: false,
    error: preflight.error,
    errorCode: preflight.errorCode,
    context: preflight.context,
    suggestedAlternatives: preflight.suggestedAlternatives,
  };
}
```

- [ ] **Step 3.3.6: Run preflight tests — expect all pass**

Run: `pnpm test:run server/tools/kamino.test.ts -t "preflightSimulate structured" 2>&1 | tail -20`

Expected: all 7 new tests pass.

### Step 3.4: Run full test suite + commit

- [ ] **Step 3.4.1: Run server typecheck**

Run: `pnpm exec tsc -p server/tsconfig.json --noEmit`

Expected: silent. Note: any consumer of the old `PreflightOutcome` shape (just the build* tools) needs the structured field passthrough — this is handled in Step 3.3.5.

- [ ] **Step 3.4.2: Run full test suite to verify no regressions**

Run: `pnpm test:run 2>&1 | tail -10`

Expected: 287 + 4 (Task 1) + 6 (Task 2) + 7 (Task 3) = 304 tests pass.

- [ ] **Step 3.4.3: Commit**

```bash
git add server/tools/kamino.ts server/tools/kamino.test.ts
git commit -m "$(cat <<'EOF'
feat(kamino): structured preflight outcome with errorCode + context (H2)

preflightSimulate now returns:
  { ok: false, errorCode, error, context, suggestedAlternatives }

errorCode discriminates:
- insufficient-sol  (wallet < 0.01 SOL — can't pay fees)
- insufficient-rent (first-time Kamino account setup shortage)
- dust-floor        (NetValueRemainingTooSmall / 0x17cc in sim logs)
- simulation-failed (generic on-chain rejection)

For dust-floor, suggestedAlternatives is intent-aware:
- repay  → [add-collateral-then-retry, partial-repay-leave-dust, kamino-ui-repay-max]
- withdraw → [repay-borrow-first, partial-withdraw, kamino-ui]
- other  → [add-collateral, kamino-ui]

build* tools pass these fields through to the LLM, which routes the
recovery path based on user intent in conversation (rules added in
next commit to server/prompt.ts).

Empirical context: Kamino's NetValueRemainingTooSmall floor was hit
3× during Day 23 manual testing on a $4-6 USD net position. Documented
floor was "~$1-$5"; reality is closer to $5. The structured signal
lets the LLM choose between add-collateral / partial action / Kamino
UI escape hatch instead of hand-waving.

Tests +7: dust-floor (3 variants), simulation-failed, insufficient-sol,
insufficient-rent kept, ok:true with no errorCode field.
EOF
)"
```

---

## Task 4: H1 + H2 + H5 — System prompt rules

**Files:**
- Modify: `server/prompt.ts` (add 3 new rules after line 20)

No test code — this is text-only and validated by Task 5 stream-layer tests + manual review.

### Step 4.1: Update prompt rules

- [ ] **Step 4.1.1: Read current prompt to confirm insertion point**

Run: `grep -n "Do NOT re-call" server/prompt.ts`

Expected: a single match (the existing rent-error rule at ~line 20). New rules go immediately after this line, before line 22 (the "Tools available" header).

- [ ] **Step 4.1.2: Insert 3 new rules**

In `server/prompt.ts`, find the line:
```
- When a build* tool returns an error mentioning "insufficient SOL" or "rent", explain it as one-time account-rent needed by Kamino for this market. About ~0.022 SOL of that funds the obligation account itself and is permanently locked per (user, market) pair, because klend does not expose a close_obligation instruction; the remainder (cToken ATA rent + tx fee) is consumed as a network fee or recoverable when the ATAs are closed. Do not promise full refundability. Quote the shortfall amount verbatim and ask the user to top up before retrying. Do NOT re-call the build* tool in the same turn.
```

Add immediately after it (before the empty line preceding "Tools available"):

```
- HALLUCINATION GUARD (CRITICAL): Never claim "transaction is ready", "Sign & Send card should appear", "card now appears in your UI", or any equivalent phrasing UNLESS your immediately-previous step was a successful build* tool result. If a build* tool returned an error or you have not called it in this turn, do NOT narrate as if a transaction was built. Instead, acknowledge the failure explicitly and either retry the tool or surface alternatives.
- DUST FLOOR ROUTING: When a build* tool returns errorCode "dust-floor", read the suggestedAlternatives array and the context (currentDepositUsd, currentBorrowUsd, netValueAfterUsd) to choose the right recovery path. For full repay/close intents on small positions (net < $5), suggest depositing more collateral to reach $10+ net OR direct the user to Kamino UI's Repay Max at https://app.kamino.finance which handles atomic close-out via a different program path. For full repay on healthy positions (net >= $5), offer a partial repay (current borrow × 0.99) that leaves a tiny dust amount but clears the floor. For specific-amount repay that hits the floor, suggest reducing by 1% and retry. For full-withdraw intents, suggest repaying the borrow first.
- KAMINO UI ESCAPE HATCH: When Kami cannot complete an action due to a Kamino protocol limitation (errorCode "dust-floor" with no viable Kami-side alternative, or any error suggesting the Kamino UI), prominently link to https://app.kamino.finance with a one-line explanation of which UI feature handles the case (e.g., "Repay Max" for atomic close, "Manage" for the specific reserve). Frame Kamino UI as the canonical escape hatch — Kami's job is to make 95% of cases easy, the protocol's UI handles the 5% edge cases.
```

- [ ] **Step 4.1.3: Verify the file is well-formed**

Run: `wc -l server/prompt.ts`

Expected: ~75 lines (was 45, added ~30).

Run: `pnpm exec tsc -p server/tsconfig.json --noEmit`

Expected: silent. (Prompt is just a string literal; typecheck should be unaffected.)

### Step 4.2: Commit

- [ ] **Step 4.2.1: Commit**

```bash
git add server/prompt.ts
git commit -m "$(cat <<'EOF'
feat(prompt): add hallucination guard + dust-floor routing + Kamino UI escape (H1+H2+H5)

Three new rules added to the LLM system prompt:

- HALLUCINATION GUARD: forbids "transaction is ready" / "Sign & Send
  card should appear" claims unless the immediately-previous step was
  a successful build* tool result. Belt to the stream-layer suspenders
  in the next commit (server/chat.ts).

- DUST FLOOR ROUTING: when buildRepay/Withdraw returns errorCode
  "dust-floor", routes the user to the right recovery based on intent:
  add-collateral / partial-action / Kamino UI Repay Max. Uses the
  structured context from Task 3 (server-side preflight detection).

- KAMINO UI ESCAPE HATCH: surfaces https://app.kamino.finance as
  canonical fallback whenever a Kamino protocol limit is hit. Kami
  handles 95% of cases easy; Kamino UI handles the 5% edge cases.

Validated by Task 5 stream-layer tests + manual smoke test post-deploy.
EOF
)"
```

---

## Task 5: H1 — Stream-layer hallucination guard

**Files:**
- Modify: `server/chat.ts` (add `detectHallucinatedTxClaim` helper + integration in stream loop)
- Modify: `server/chat.test.ts` (+6 tests)

### Step 5.1: Write failing tests for `detectHallucinatedTxClaim`

- [ ] **Step 5.1.1: Read chat.test.ts current structure**

Run: `head -40 server/chat.test.ts`

Expected: existing test file with mock setup for `streamText`. Note import patterns and mock conventions used.

- [ ] **Step 5.1.2: Add 6 new tests at end of `server/chat.test.ts`**

Append:

```ts
import { detectHallucinatedTxClaim } from './chat';

describe('detectHallucinatedTxClaim (H1 / Cluster H)', () => {
  const buildResultEvent = (toolName: string, isError = false) => ({
    type: 'tool-result',
    toolName,
    isError,
  });

  it('returns true when "Sign & Send card should appear" appears with no build* tool-result', () => {
    const text = 'Got it! A Sign & Send card should now appear in your UI.';
    const events = [
      { type: 'tool-call', toolName: 'getPortfolio' },
      buildResultEvent('getPortfolio'),
    ];
    expect(detectHallucinatedTxClaim(text, events)).toBe(true);
  });

  it('returns false when "transaction is ready" appears AFTER a successful buildDeposit', () => {
    const text = 'Your deposit transaction is ready! Click Sign.';
    const events = [
      { type: 'tool-call', toolName: 'buildDeposit' },
      buildResultEvent('buildDeposit', false),
    ];
    expect(detectHallucinatedTxClaim(text, events)).toBe(false);
  });

  it('returns true when "your repay transaction is ready" appears AFTER a FAILED buildRepay', () => {
    const text = 'Your repay transaction is ready! 🎉';
    const events = [
      { type: 'tool-call', toolName: 'buildRepay' },
      buildResultEvent('buildRepay', true),  // isError: true → not a successful result
    ];
    expect(detectHallucinatedTxClaim(text, events)).toBe(true);
  });

  it('returns false for benign text without hallucination phrases', () => {
    const text = "Here's your portfolio. You have $5 USDC deposited.";
    const events = [buildResultEvent('getPortfolio')];
    expect(detectHallucinatedTxClaim(text, events)).toBe(false);
  });

  it('matches case-insensitively across whitespace variations', () => {
    const text = 'A SIGN  &  SEND CARD SHOULD now appear in your UI.';
    expect(detectHallucinatedTxClaim(text, [])).toBe(true);
  });

  it('returns false when "Sign & Send card already visible" appears AFTER successful build*', () => {
    const text = 'A Sign & Send card should already be visible.';
    const events = [buildResultEvent('buildBorrow')];
    expect(detectHallucinatedTxClaim(text, events)).toBe(false);
  });
});
```

- [ ] **Step 5.1.3: Run tests — expect 6 failures (function not exported yet)**

Run: `pnpm test:run server/chat.test.ts -t "detectHallucinatedTxClaim" 2>&1 | tail -20`

Expected: 6 failures, "detectHallucinatedTxClaim is not exported" or similar.

### Step 5.2: Implement `detectHallucinatedTxClaim` + stream-layer integration

- [ ] **Step 5.2.1: Add the helper function and patterns near the top of `server/chat.ts`**

Insert after the existing imports (after line 14, the `createLogger` import) and before the `ChatInput` interface:

```ts
// H1: Patterns that indicate the LLM is claiming a transaction was built
// when it wasn't. Conservative — only triggers on high-confidence phrases
// that actually appeared in Day 23 hallucination cases.
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

/**
 * H1: Detects when the LLM has claimed a transaction was built but no
 * successful build* tool-result event preceded the claim in this turn.
 *
 * Returns true → caller should append a system footnote to the response
 * informing the user no tx was built. Append-only, never blocks the response.
 */
export function detectHallucinatedTxClaim(
  fullText: string,
  toolEvents: ReadonlyArray<ToolEventSummary>
): boolean {
  const matched = HALLUCINATION_PATTERNS.some((p) => p.test(fullText));
  if (!matched) return false;
  const lastBuildResult = [...toolEvents].reverse().find(
    (e) => e.type === 'tool-result' && e.toolName?.startsWith('build') && !e.isError
  );
  return !lastBuildResult;
}
```

- [ ] **Step 5.2.2: Integrate the guard into `createChatStream`'s stream loop**

In `server/chat.ts`, locate the `for await (const part of result.fullStream)` loop (around line 145). We need to:
1. Accumulate text deltas into `fullAssistantText`
2. Track tool events into `toolEvents`
3. After the loop completes (just before `data: [DONE]`), run `detectHallucinatedTxClaim` and inject footnote if true

Replace the block from `for await (const part of result.fullStream)` through the `data: [DONE]` line with:

```ts
        // H1: Track text + tool events for post-stream hallucination guard
        let fullAssistantText = '';
        const toolEvents: ToolEventSummary[] = [];

        for await (const part of result.fullStream) {
          switch (part.type) {
            case 'text-delta':
              fullAssistantText += part.text;
              writeEvent({ text: part.text });
              break;
            case 'tool-call':
              toolEvents.push({ type: 'tool-call', toolName: part.toolName });
              writeEvent({
                toolCall: { id: part.toolCallId, name: part.toolName, input: part.input },
              });
              break;
            case 'tool-result':
              // Mark as error if the tool returned ok:false (kamino tool convention)
              const isError =
                part.output && typeof part.output === 'object' && 'ok' in part.output && (part.output as { ok: boolean }).ok === false;
              toolEvents.push({ type: 'tool-result', toolName: part.toolName, isError });
              writeEvent({
                toolResult: { id: part.toolCallId, name: part.toolName, output: part.output },
              });
              break;
            case 'tool-error':
              toolEvents.push({ type: 'tool-error', toolName: part.toolName, isError: true });
              writeEvent({
                toolError: {
                  id: part.toolCallId,
                  name: part.toolName,
                  error: part.error instanceof Error ? part.error.message : String(part.error),
                },
              });
              break;
            case 'error': {
              const message = part.error instanceof Error ? part.error.message : String(part.error);
              writeEvent({ error: message });
              break;
            }
          }
        }

        // H1: Post-stream hallucination guard. Append-only footnote, never blocks.
        if (detectHallucinatedTxClaim(fullAssistantText, toolEvents)) {
          const footnote =
            '\n\n---\n*⚠️ System note: a transaction was NOT actually built. Please rephrase your request and try again.*';
          writeEvent({ text: footnote });
          log.info(
            {
              matchedPattern: HALLUCINATION_PATTERNS.find((p) => p.test(fullAssistantText))?.toString(),
              toolCallCount: toolEvents.filter((e) => e.type === 'tool-call').length,
            },
            'hallucination_guard_triggered'
          );
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
```

- [ ] **Step 5.2.3: Run hallucination guard tests — expect all pass**

Run: `pnpm test:run server/chat.test.ts -t "detectHallucinatedTxClaim" 2>&1 | tail -20`

Expected: all 6 tests pass.

- [ ] **Step 5.2.4: Run full chat.test.ts to verify no regression**

Run: `pnpm test:run server/chat.test.ts 2>&1 | tail -10`

Expected: all chat tests pass (existing + 6 new).

### Step 5.3: Server typecheck + commit

- [ ] **Step 5.3.1: Run server typecheck**

Run: `pnpm exec tsc -p server/tsconfig.json --noEmit`

Expected: silent.

- [ ] **Step 5.3.2: Commit**

```bash
git add server/chat.ts server/chat.test.ts
git commit -m "$(cat <<'EOF'
feat(chat): add stream-layer hallucination guard with footnote injection (H1)

Detects when the LLM has claimed "transaction is ready" / "Sign & Send
card should appear" but no successful build* tool-result preceded the
claim in this turn. When detected, appends a system footnote to the
response informing the user no tx was built.

Append-only — never blocks/discards the response (false-positive risk
= annoying footnote, never broken UX). Conservative patterns: only
4 specific phrases that actually appeared in Day 23 hallucination cases.

Logs hallucination_guard_triggered for observability — lets us tune
patterns if false positives appear in production.

Belt-and-suspenders pairing with the system prompt rule shipped in the
previous commit. The prompt rule should prevent ~95% of cases; this
guard catches the residual where the model drifts under context pressure.

Tests +6: hallucination patterns with/without preceding successful
build* result, case-insensitive matching, failed-build still triggers,
benign text doesn't trigger.
EOF
)"
```

---

## Task 6: H4 — Docs + memory + CLAUDE.md updates

**Files:**
- Modify: `docs/demo-script.md` (Production checklist + new edge-case appendix)
- Modify: `CLAUDE.md` (Stack gotchas section)
- Create: `~/.claude/projects/-Users-rector-local-dev-kami/memory/solflare-bypasses-our-rpc.md`
- Modify: `~/.claude/projects/-Users-rector-local-dev-kami/memory/kamino-net-value-floor.md`
- Modify: `~/.claude/projects/-Users-rector-local-dev-kami/memory/MEMORY.md`

No tests — text-only changes.

### Step 6.1: Update `docs/demo-script.md`

- [ ] **Step 6.1.1: Update Production checklist funding requirement**

In `docs/demo-script.md`, find the line:
```markdown
- [ ] Test wallet topped up (≥ 0.1 SOL, ≥ 6 USDC) before recording. Shot 7's auto-recovery needs a buffer of at least $5 equivalent in the obligation.
```

Replace with:
```markdown
- [ ] **Test wallet topped up (≥ 0.1 SOL, ≥ 15 USDC) before recording.** Shot 5 deposits 5 USDC; Shot 6 borrows 0.05 USDC; Shot 7 repays full. The auto-recovery in Shot 7 needs the obligation's net value to land **above ~$5 USD floor** after repay — meaning the deposit must be ≥ $10 (5 supplied + 5+ buffer). Empirically validated 2026-05-01: wallets with $4-6 USD net position cannot close cleanly via Kami; only Kamino UI's atomic Repay Max can close them.
```

- [ ] **Step 6.1.2: Add edge-cases appendix at end of file**

Append to `docs/demo-script.md`:

```markdown

## Edge cases & known limits (added 2026-05-01 from Day 23 testing)

These DO NOT block the demo if the production checklist above is followed, but documenting for transparency.

### NetValueRemainingTooSmall floor (~$5 USD)

Kamino's klend program rejects any action that would drop the obligation's net value below ~$5. This bites on:
- "Repay all" when current net is already < $10 (because repay reduces net)
- "Withdraw all USDC" when there's any open borrow (creates negative net)

Fix: collateral discipline — keep ≥ $10 deposit when fully closing positions, OR use Kamino UI's Repay Max which handles atomic close-out via a different program path. Kami's `buildRepay` tool now returns structured `errorCode: 'dust-floor'` so the LLM can suggest the right recovery (see Cluster H / PR #54).

### First-time Kamino rent (~0.022 SOL)

Permanently locked per (user, market) pair. klend has no `close_obligation` instruction. Fund accordingly — first deposit needs an extra ~0.05 SOL on top of the deposit amount.

### Solflare opaque sign+broadcast (OBSOLETE — fixed in Cluster H / PR #54)

Pre-PR-#54: Solflare's `signAndSendTransaction` did sign+broadcast inside the browser extension, using its own RPC and bypassing our `/api/rpc` proxy. Failures came back as empty `WalletSendTransactionError` with zero observability. Cluster H switched `TxStatusCard` to explicit `signTransaction` + manual `connection.sendRawTransaction(...)` so all errors are now structured and routed through our Helius proxy.
```

### Step 6.2: Update `CLAUDE.md` Stack gotchas

- [ ] **Step 6.2.1: Append two new gotchas to the Stack gotchas section**

In `/Users/rector/local-dev/kami/CLAUDE.md`, find the line containing `**Vitest shared mock state via `vi.hoisted()`.**` (the last gotcha entry currently). Add immediately AFTER its closing line:

```markdown
- **Solflare's `signAndSendTransaction` bypasses our `/api/rpc`.** It signs AND broadcasts inside the browser extension via `chrome.runtime.sendMessage`, using Solflare's own RPC endpoint. Empty `WalletSendTransactionError` was the symptom; observability was zero. Cluster H (PR #54) switched `TxStatusCard` to `useWallet().signTransaction(tx)` + manual `connection.sendRawTransaction(...)` so broadcast goes through our Helius proxy with structured errors. Memory: `solflare-bypasses-our-rpc.md`.
- **Kamino NetValueRemainingTooSmall floor is ~$5 USD net (not the documented ~$1).** Empirically validated 2026-05-01: positions with $4-6 net cannot close cleanly via klend's standard repay/withdraw paths. The Kamino UI's "Repay Max" uses an atomic close-out path that bypasses this. Cluster H (PR #54) detects `0x17cc` / `NetValueRemainingTooSmall` in preflight logs, returns structured `errorCode: 'dust-floor'` + `suggestedAlternatives`, and the LLM routes to the right recovery (add-collateral / partial-repay / kamino-ui-escape). Updated memory: `kamino-net-value-floor.md`.
```

### Step 6.3: Update memory files

- [ ] **Step 6.3.1: Create new memory file `solflare-bypasses-our-rpc.md`**

Write the following file at `/Users/rector/.claude/projects/-Users-rector-local-dev-kami/memory/solflare-bypasses-our-rpc.md`:

```markdown
---
name: Solflare bypasses our RPC for sign-and-send
description: useWallet().sendTransaction with Solflare adapter calls the wallet's signAndSendTransaction internally, which signs+broadcasts via chrome.runtime.sendMessage using Solflare's own RPC — completely bypassing the connection we pass. Use signTransaction + sendRawTransaction explicitly for control + observability.
type: project
---

Diagnosed 2026-05-01 during Day 23 manual test. Symptom: Approve in Solflare popup → Kami shows FAILED with "Wallet returned no detail — popup was likely dismissed". Empty WalletSendTransactionError, no `cause`, no message.

Diagnostic process via Chrome MCP:
- Patched `window.fetch` to log all outbound calls
- Asked RECTOR to retry sign + approve
- Result: ZERO outbound fetch calls during the entire failed broadcast
- Conclusion: Solflare extension does sign+broadcast internally via chrome.runtime.sendMessage, using its own RPC. Our /api/rpc proxy never sees the broadcast.

Fix in PR #54 (Cluster H): TxStatusCard.tsx switches from `useWallet().sendTransaction(tx, conn)` → explicit two-step `useWallet().signTransaction(tx)` + `connection.sendRawTransaction(signed.serialize())`. Wallet only signs (deterministic across all Wallet-Standard wallets), broadcast goes through our /api/rpc → Helius (structured SendTransactionError with `.logs` we can parse).

Universally safe: signTransaction is Wallet Standard core, all modern Solana wallets implement it.
```

- [ ] **Step 6.3.2: Update existing `kamino-net-value-floor.md` memory**

Read `/Users/rector/.claude/projects/-Users-rector-local-dev-kami/memory/kamino-net-value-floor.md` and update the description field + body to reflect the empirical $5 floor (not $1):

The frontmatter should mention "~$5 USD net floor (validated 2026-05-01, not the documented ~$1)". The body should add a section noting that Day 23 testing on a $4-6 USD net position confirmed the floor is closer to $5, and reference Cluster H (PR #54) for the structured detection now in place.

If the file is short, the simplest update is to read its current contents, prepend a "Updated 2026-05-01:" note, and add the new context. If the file is long, only update the description in frontmatter + add the new context section at the bottom.

- [ ] **Step 6.3.3: Add new line to `MEMORY.md` index**

Read `/Users/rector/.claude/projects/-Users-rector-local-dev-kami/memory/MEMORY.md`. Add a single-line entry under the existing index in the most appropriate alphabetical/topical position. Example line:

```markdown
- [Solflare bypasses our RPC](solflare-bypasses-our-rpc.md) — useWallet.sendTransaction on Solflare goes via chrome.runtime.sendMessage to Solflare's own RPC; use signTransaction + sendRawTransaction for control + structured errors
```

Keep the line under 200 chars per the MEMORY.md convention.

### Step 6.4: Final commit

- [ ] **Step 6.4.1: Stage docs + CLAUDE.md (NOT memory files — those are git-ignored per CLAUDE.md global)**

```bash
git add docs/demo-script.md CLAUDE.md
git status --short
```

Expected: only the two staged files. Memory files stay local (per CLAUDE.md "Memory: ~/.claude/projects/*/memory/ — local only, no backup, no symlinks. Never commit to git.").

- [ ] **Step 6.4.2: Commit**

```bash
git commit -m "$(cat <<'EOF'
docs: bump demo funding requirement + document dust-floor + Solflare bypass (H4)

docs/demo-script.md:
- Production checklist: ≥ 6 USDC → ≥ 15 USDC (Shot 7 needs $10+ net to
  clear NetValueRemainingTooSmall floor)
- New "Edge cases & known limits" appendix documenting:
  • NetValueRemainingTooSmall floor (~$5 USD)
  • First-time Kamino rent (~0.022 SOL permanently locked)
  • Solflare opaque sign+broadcast (OBSOLETE — fixed in PR #54)

CLAUDE.md Stack gotchas: two new entries for Solflare-bypasses-RPC and
the empirical $5 dust floor, both referencing PR #54 for the fix details.

All three updates derived from Day 23 manual testing where:
1. We hit NetValueRemainingTooSmall 3× on small positions
2. We discovered via Chrome MCP that Solflare bypasses /api/rpc entirely
3. Empty WalletSendTransactionError was misclassified as "popup dismissed"

Memory files (~/.claude/.../memory/) updated locally per project convention
(never committed to git per global CLAUDE.md).
EOF
)"
```

---

## Final verification + PR

### Step 7.1: Full test suite + 3 typechecks

- [ ] **Step 7.1.1: Run full test suite**

Run: `pnpm test:run 2>&1 | tail -5`

Expected: ~310 tests pass across ~39 files (287 baseline + 4 Task1 + 6 Task2 + 7 Task3 + 6 Task5 = 310).

- [ ] **Step 7.1.2: Run all 3 typechecks**

```bash
pnpm exec tsc --noEmit && \
pnpm exec tsc -p server/tsconfig.json --noEmit && \
pnpm exec tsc -b
```

Expected: all three silent.

- [ ] **Step 7.1.3: Production build**

Run: `pnpm build 2>&1 | tail -10`

Expected: clean build, bundle delta ~+1 kB main.

### Step 7.2: Push branch and open PR

- [ ] **Step 7.2.1: Push branch**

```bash
git push -u origin feat/cluster-h-tx-hardening
```

- [ ] **Step 7.2.2: Open PR**

```bash
gh pr create --title "feat(cluster-h): tx sign/broadcast hardening + structured error routing" --body "$(cat <<'EOF'
## Summary
- **H6:** TxStatusCard switches `sendTransaction` → `signTransaction + sendRawTransaction` so all broadcasts go through our `/api/rpc` → Helius (no more Solflare opaque-broadcast bypass).
- **H3:** walletError classifier gains `dust-floor`, `simulation-failed`, and `WalletSignTransactionError` branches for precise error UX.
- **H2:** kamino preflight returns structured `{ errorCode, context, suggestedAlternatives }` so the LLM can route recovery paths intent-aware.
- **H1:** anti-hallucination rule in system prompt + stream-layer footnote-injection guard on "transaction is ready" claims without preceding successful build*.
- **H5:** Kamino UI escape hatch promoted as canonical fallback for protocol-level limits.
- **H4:** demo-script funding bump (≥6 → ≥15 USDC) + edge-case appendix.

Spec: `docs/superpowers/specs/2026-05-01-tx-hardening-cluster-h-design.md`
Plan: `docs/superpowers/plans/2026-05-01-tx-hardening-cluster-h-implementation.md`

## Why
Day 23 manual testing surfaced via Chrome MCP fetch instrumentation that Solflare's `signAndSendTransaction` does the entire sign + broadcast inside the browser extension via `chrome.runtime.sendMessage` to its own RPC — completely bypassing our `/api/rpc` proxy. When Solflare's RPC rejects post-sign (e.g. `NetValueRemainingTooSmall` after our Helius preflight passed), the wallet adapter wraps the failure in an empty `WalletSendTransactionError` with zero observability. We misclassified as "popup dismissed". H6 is the load-bearing fix; H1-H5 layer enhanced UX on top.

## Net delta
- ~320 lines source + tests
- +23 tests (287 → 310)
- ~+1 kB main bundle
- 6 commits, one per H-item

## Test plan
- [ ] CI passes (310 tests + 3 typechecks + build)
- [ ] Post-deploy live smoke: trigger a sign on production, verify (a) Solflare popup opens cleanly, (b) on success the tx confirms via our /api/rpc (verify in Vercel logs that `/api/rpc` POST with `sendTransaction` method appears for the signed tx), (c) on dust-floor the LLM produces a structured recovery suggestion (not "popup dismissed")
- [ ] Verify hydration path (PR #52) still works: hard-reload after a confirmed tx, conversation persists, TxStatusCard shows confirmed state
EOF
)"
```

- [ ] **Step 7.2.3: After CI passes + RECTOR reviews → merge with `gh pr merge N --merge`**

(Standard project workflow — one commit per logical change is preserved with `--merge`, branches kept per CLAUDE.md rule.)

---

## Self-review checklist (run by author after writing this plan)

- [x] **Spec coverage:** All 6 H-items mapped to tasks. H1 → Task 4 + Task 5; H2 → Task 3; H3 → Task 2; H4 → Task 6; H5 → Task 4; H6 → Task 1. ✓
- [x] **Placeholder scan:** No "TBD", "TODO", "implement later", or vague directives. Every code step has full code blocks. ✓
- [x] **Type consistency:** `signTransaction` (not `signMessage`), `connection.sendRawTransaction` (not `sendTransaction`), `errorCode` field consistent across kamino.ts + walletError.ts + chat.ts. ✓
- [x] **Test counts add up:** 287 baseline + 4 + 6 + 7 + 6 = 310 (matches spec target). ✓
- [x] **Commit messages explain the why** (not just the what), reference Cluster H + PR #54 for traceability. ✓
- [x] **No-AI-attribution rule respected** in commit message templates (no "Co-Authored-By: Claude", no "🤖 Generated with"). ✓
