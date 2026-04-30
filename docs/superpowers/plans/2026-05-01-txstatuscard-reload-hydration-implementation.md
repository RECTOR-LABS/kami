# TxStatusCard Reload Hydration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist transaction lifecycle (`submitted → confirmed | failed`) so TxStatusCard hydrates correctly across page reload, conversation switch, and component remount, and resume `pollSignatureStatus` for any signed-but-not-yet-confirmed transaction. Closes the duplicate-sign window on reload.

**Architecture:** Three surfaces: `useChat` exports new `updatePendingTransaction(messageId, patch)` method; `TxStatusCard` accepts new optional `onStatusChange` prop and adds a mount-only `useEffect` that resumes polling when persisted state is `'submitted'` with a signature; `MessageBubble` + `App.tsx` wire the callback chain through. Zero schema changes — `PendingTransaction.status` enum already includes `'submitted' | 'confirmed' | 'failed'` and `signature` is already optional in `src/types.ts`.

**Tech Stack:** React 18 + TypeScript + Vitest 4 (`vi.hoisted` + `vi.mock` for shared mocks) + happy-dom + `@testing-library/react` (`renderHook`, `render`, `act`, `waitFor`).

**Spec:** `docs/superpowers/specs/2026-05-01-txstatuscard-reload-hydration-design.md`

---

## Pre-flight (run once before Task 1)

Verify the branch is `fix/txstatuscard-reload-hydration` and the spec commit is at HEAD:

```bash
git branch --show-current   # expect: fix/txstatuscard-reload-hydration
git log --oneline -3        # expect: top commit is "docs(spec): clarify resume-poll useEffect..."
pnpm test:run               # baseline: 270 passing across 39 files
```

Expected baseline: **270 tests passing**. Plan target after all 4 tasks: **284 tests passing** (+14).

---

### Task 1: Add `updatePendingTransaction` to useChat

**Files:**
- Modify: `src/hooks/useChat.ts` (add method, return from hook)
- Modify: `src/hooks/useChat.test.ts` (append new describe block with 5 tests)

**Why first:** This is a pure-function-on-state utility with zero UI dependencies. Land it in isolation to validate the persistence contract before any component wiring.

- [ ] **Step 1.1: Write 5 failing tests for `updatePendingTransaction`**

Append the following describe block to `src/hooks/useChat.test.ts` (after the last existing describe, before EOF):

```ts
describe('useChat updatePendingTransaction', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function seedConversationsWithPendingTx() {
    const conv = {
      id: 'c1',
      title: 'deposit flow',
      messages: [
        { id: 'u1', role: 'user' as const, content: 'deposit 5 USDC', timestamp: 1 },
        {
          id: 'a1',
          role: 'assistant' as const,
          content: 'tx ready',
          timestamp: 2,
          pendingTransaction: {
            action: 'deposit' as const,
            protocol: 'Kamino' as const,
            symbol: 'USDC',
            amount: 5,
            reserveAddress: 'D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59',
            mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            summary: 'Deposit 5 USDC',
            base64Txn: 'AQAAAA==',
            blockhash: 'bh-1',
            lastValidBlockHeight: '300000000',
            status: 'pending' as const,
          },
        },
      ],
      createdAt: 1,
      updatedAt: 2,
    };
    localStorage.setItem('kami_conversations', JSON.stringify([conv]));
    localStorage.setItem('kami_active_conversation', 'c1');
  }

  it('patches the target message pendingTransaction with shallow merge', () => {
    seedConversationsWithPendingTx();
    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.updatePendingTransaction('a1', {
        status: 'submitted',
        signature: 'sig-abc',
      });
    });

    const msg = result.current.activeConversation.messages.find((m) => m.id === 'a1');
    expect(msg?.pendingTransaction?.status).toBe('submitted');
    expect(msg?.pendingTransaction?.signature).toBe('sig-abc');
    // Untouched fields preserved:
    expect(msg?.pendingTransaction?.base64Txn).toBe('AQAAAA==');
    expect(msg?.pendingTransaction?.amount).toBe(5);
  });

  it('persists the update to localStorage via saveConversations', () => {
    seedConversationsWithPendingTx();
    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.updatePendingTransaction('a1', { status: 'confirmed' });
    });

    const raw = localStorage.getItem('kami_conversations');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    const persistedMsg = parsed[0].messages.find((m: { id: string }) => m.id === 'a1');
    expect(persistedMsg.pendingTransaction.status).toBe('confirmed');
  });

  it('is a no-op when messageId is not found', () => {
    seedConversationsWithPendingTx();
    const { result } = renderHook(() => useChat());
    const before = JSON.stringify(result.current.conversations);

    act(() => {
      result.current.updatePendingTransaction('non-existent-id', {
        status: 'confirmed',
      });
    });

    const after = JSON.stringify(result.current.conversations);
    expect(after).toBe(before);
  });

  it('is a no-op when the message exists but has no pendingTransaction', () => {
    const conv = {
      id: 'c1',
      title: 'plain chat',
      messages: [
        { id: 'u1', role: 'user' as const, content: 'hi', timestamp: 1 },
        { id: 'a1', role: 'assistant' as const, content: 'hello', timestamp: 2 },
      ],
      createdAt: 1,
      updatedAt: 2,
    };
    localStorage.setItem('kami_conversations', JSON.stringify([conv]));
    localStorage.setItem('kami_active_conversation', 'c1');

    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.updatePendingTransaction('a1', { status: 'confirmed' });
    });

    const msg = result.current.activeConversation.messages.find((m) => m.id === 'a1');
    expect(msg?.pendingTransaction).toBeUndefined();
  });

  it('does not mutate other messages when patching one', () => {
    const conv = {
      id: 'c1',
      title: 'two txs',
      messages: [
        {
          id: 'a1',
          role: 'assistant' as const,
          content: 'tx1',
          timestamp: 1,
          pendingTransaction: {
            action: 'deposit' as const,
            protocol: 'Kamino' as const,
            symbol: 'USDC',
            amount: 1,
            reserveAddress: 'r1',
            mint: 'm1',
            summary: 's1',
            base64Txn: 'AAAA',
            blockhash: 'b1',
            lastValidBlockHeight: '100',
            status: 'pending' as const,
          },
        },
        {
          id: 'a2',
          role: 'assistant' as const,
          content: 'tx2',
          timestamp: 2,
          pendingTransaction: {
            action: 'borrow' as const,
            protocol: 'Kamino' as const,
            symbol: 'SOL',
            amount: 0.5,
            reserveAddress: 'r2',
            mint: 'm2',
            summary: 's2',
            base64Txn: 'BBBB',
            blockhash: 'b2',
            lastValidBlockHeight: '200',
            status: 'pending' as const,
          },
        },
      ],
      createdAt: 1,
      updatedAt: 2,
    };
    localStorage.setItem('kami_conversations', JSON.stringify([conv]));
    localStorage.setItem('kami_active_conversation', 'c1');

    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.updatePendingTransaction('a1', {
        status: 'confirmed',
        signature: 'sig-1',
      });
    });

    const msg1 = result.current.activeConversation.messages.find((m) => m.id === 'a1');
    const msg2 = result.current.activeConversation.messages.find((m) => m.id === 'a2');
    expect(msg1?.pendingTransaction?.status).toBe('confirmed');
    expect(msg1?.pendingTransaction?.signature).toBe('sig-1');
    expect(msg2?.pendingTransaction?.status).toBe('pending');
    expect(msg2?.pendingTransaction?.signature).toBeUndefined();
  });
});
```

- [ ] **Step 1.2: Run tests to verify they fail**

Run: `pnpm test:run -- src/hooks/useChat.test.ts`

Expected: **5 new tests fail** with `TypeError: result.current.updatePendingTransaction is not a function`. Existing tests still pass.

- [ ] **Step 1.3: Implement `updatePendingTransaction` in `useChat.ts`**

Open `src/hooks/useChat.ts`. Add the new method right after `renameConversation` (around line 137) and before `sendMessage` (line 139). Insert this block:

```ts
  const updatePendingTransaction = useCallback(
    (messageId: string, patch: Partial<PendingTransaction>) => {
      const updated = conversations.map((c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === messageId && m.pendingTransaction
            ? { ...m, pendingTransaction: { ...m.pendingTransaction, ...patch } }
            : m
        ),
      }));
      persist(updated);
    },
    [conversations, persist]
  );
```

Then add `updatePendingTransaction` to the return object at the bottom of `useChat()` (currently around lines 324-336). The return becomes:

```ts
  return {
    conversations,
    activeConversation,
    activeId,
    isStreaming,
    sendMessage,
    stopStreaming,
    newConversation,
    switchConversation,
    deleteConversation,
    clearAllConversations,
    renameConversation,
    updatePendingTransaction, // NEW
  };
```

- [ ] **Step 1.4: Run tests to verify all 5 pass**

Run: `pnpm test:run -- src/hooks/useChat.test.ts`

Expected: all useChat tests pass (existing + 5 new). Total file count: ~22 tests in this file (was 17).

- [ ] **Step 1.5: Run full typecheck + suite**

```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p server/tsconfig.json --noEmit
pnpm test:run
```

Expected: **all silent**, **275 tests passing** (was 270, now +5).

- [ ] **Step 1.6: Commit**

```bash
git add src/hooks/useChat.ts src/hooks/useChat.test.ts
git commit -m "$(cat <<'EOF'
feat(useChat): add updatePendingTransaction(messageId, patch)

Shallow-merge patch onto target message's pendingTransaction. Idempotent
no-op when messageId not found OR message has no pendingTransaction.
Persists via existing saveConversations path.

This is the foundation for TxStatusCard reload hydration: the card will
call this method on each lifecycle transition (submitted/confirmed/failed)
so the persisted state matches the on-chain reality.
EOF
)"
```

---

### Task 2: Wire `onStatusChange` callbacks into `TxStatusCard.handleSign`

**Files:**
- Modify: `src/components/chat/TxStatusCard.tsx` (add prop, add 4 callback fires)
- Modify: `src/components/chat/TxStatusCard.test.tsx` (append 4 callback-firing tests)

**Why second:** Adds the *write* side of the persistence contract (TxStatusCard → useChat) without yet touching the *read* side (mount-time hydration), keeping diffs reviewable in two halves.

- [ ] **Step 2.1: Write 4 failing tests for callback firing**

Append to `src/components/chat/TxStatusCard.test.tsx` after the last `it(...)` and before the closing `});`:

```ts
  it('fires onStatusChange with submitted+signature after sendTransaction resolves', async () => {
    wallet.sendTransaction.mockResolvedValue('sig-from-rpc-12345');
    // First poll returns null — keeps state in broadcasting so we can assert the submitted callback fired pre-confirm.
    connection.getSignatureStatuses.mockResolvedValue({ value: [null] });
    connection.getBlockHeight.mockResolvedValue(50);
    const onStatusChange = vi.fn();

    render(<TxStatusCard transaction={baseTx} onStatusChange={onStatusChange} />);
    fireEvent.click(screen.getByRole('button', { name: /sign transaction/i }));

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith({
        status: 'submitted',
        signature: 'sig-from-rpc-12345',
      });
    });
  });

  it('fires onStatusChange with confirmed when poll succeeds', async () => {
    wallet.sendTransaction.mockResolvedValue('sig-confirm-1');
    connection.getSignatureStatuses.mockResolvedValue({
      value: [{ confirmationStatus: 'confirmed', err: null }],
    });
    connection.getBlockHeight.mockResolvedValue(50);
    const onStatusChange = vi.fn();

    render(<TxStatusCard transaction={baseTx} onStatusChange={onStatusChange} />);
    fireEvent.click(screen.getByRole('button', { name: /sign transaction/i }));

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith({ status: 'confirmed' });
    });
  });

  it('fires onStatusChange with failed+error when sendTransaction throws', async () => {
    wallet.sendTransaction.mockRejectedValue(new Error('User rejected the request'));
    const onStatusChange = vi.fn();

    render(<TxStatusCard transaction={baseTx} onStatusChange={onStatusChange} />);
    fireEvent.click(screen.getByRole('button', { name: /sign transaction/i }));

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalled();
    });
    const lastCall = onStatusChange.mock.calls[onStatusChange.mock.calls.length - 1][0];
    expect(lastCall.status).toBe('failed');
    expect(typeof lastCall.error).toBe('string');
    expect(lastCall.error.length).toBeGreaterThan(0);
  });

  it('does not throw when onStatusChange prop is omitted', async () => {
    wallet.sendTransaction.mockResolvedValue('sig-orphan');
    connection.getSignatureStatuses.mockResolvedValue({
      value: [{ confirmationStatus: 'confirmed', err: null }],
    });
    connection.getBlockHeight.mockResolvedValue(50);

    render(<TxStatusCard transaction={baseTx} />);
    fireEvent.click(screen.getByRole('button', { name: /sign transaction/i }));

    // No throw → confirmed UI eventually renders.
    await waitFor(() => {
      expect(screen.getByText(/confirmed/i)).toBeInTheDocument();
    });
  });
```

- [ ] **Step 2.2: Run tests to verify they fail**

Run: `pnpm test:run -- src/components/chat/TxStatusCard.test.tsx`

Expected: 3 of the 4 new tests fail (`onStatusChange` is not yet a recognized prop, calls are not made). The 4th ("does not throw when onStatusChange omitted") may pass *coincidentally* because the prop is currently ignored — that's fine, it pins the no-throw contract for after the change.

- [ ] **Step 2.3: Implement onStatusChange prop + 4 fire sites in TxStatusCard.tsx**

Open `src/components/chat/TxStatusCard.tsx`. Apply these 4 changes:

**Change 1 — Update Props interface (around line 13):**

Replace:
```ts
interface Props {
  transaction: PendingTransaction;
}
```

With:
```ts
interface Props {
  transaction: PendingTransaction;
  onStatusChange?: (patch: Partial<PendingTransaction>) => void;
}
```

**Change 2 — Update component signature (around line 70):**

Replace:
```ts
export default function TxStatusCard({ transaction }: Props) {
```

With:
```ts
export default function TxStatusCard({ transaction, onStatusChange }: Props) {
```

**Change 3 — Fire callbacks inside `handleSign` (around lines 98-134):**

Replace the entire `handleSign` body with:

```ts
  const handleSign = async () => {
    if (!connected || !publicKey) {
      setError({ kind: 'unknown', message: 'Connect a wallet first.' });
      setPhase('failed');
      return;
    }
    setError(null);
    setPhase('signing');
    try {
      const txBytes = decodeBase64ToBytes(transaction.base64Txn);
      const tx = VersionedTransaction.deserialize(txBytes);
      const sig = await sendTransaction(tx, connection, {
        skipPreflight: false,
        maxRetries: 3,
      });
      setSignature(sig);
      setPhase('broadcasting');
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
      // eslint-disable-next-line no-console
      console.error('[Kami] sendTransaction failed', err);
      const classified = classifyWalletError(err);
      setError(classified);
      setPhase('failed');
      onStatusChange?.({ status: 'failed', error: classified.message });
    }
  };
```

(Diff vs current: 4 added `onStatusChange?.(...)` lines — no other logic changes.)

- [ ] **Step 2.4: Run tests to verify all 4 new pass + existing pass**

Run: `pnpm test:run -- src/components/chat/TxStatusCard.test.tsx`

Expected: all TxStatusCard tests pass (existing 5 + 4 new = 9 total in this file).

- [ ] **Step 2.5: Run full typecheck + suite**

```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p server/tsconfig.json --noEmit
pnpm test:run
```

Expected: **all silent**, **279 tests passing** (was 275, now +4).

- [ ] **Step 2.6: Commit**

```bash
git add src/components/chat/TxStatusCard.tsx src/components/chat/TxStatusCard.test.tsx
git commit -m "$(cat <<'EOF'
feat(TxStatusCard): fire onStatusChange on lifecycle transitions

Add optional onStatusChange prop. Fire-and-forget on each persistable
transition: submitted (post-sendTransaction), confirmed (post-poll),
failed (poll outcome OR sendTransaction throw). Optional chaining at
all call sites — TxStatusCard remains usable in test contexts that
don't supply the callback.

Mount-time hydration (resume polling) lands in the next commit so each
half stays reviewable independently.
EOF
)"
```

---

### Task 3: Add resume-polling `useEffect` on mount

**Files:**
- Modify: `src/components/chat/TxStatusCard.tsx` (extend phase initializer + add useEffect)
- Modify: `src/components/chat/TxStatusCard.test.tsx` (append 3 hydration tests)

**Why third:** This depends on the prop wiring from Task 2 (the new useEffect calls `onStatusChange?.(...)` on poll outcome). Lands the *read* side of the persistence contract.

- [ ] **Step 3.1: Write 3 failing tests for hydration + resume polling**

Append to `src/components/chat/TxStatusCard.test.tsx`:

```ts
  it('hydrates to broadcasting and resumes polling when status=submitted+signature', async () => {
    connection.getSignatureStatuses.mockResolvedValue({
      value: [{ confirmationStatus: 'confirmed', err: null }],
    });
    connection.getBlockHeight.mockResolvedValue(50);
    const onStatusChange = vi.fn();

    const tx: PendingTransaction = {
      ...baseTx,
      status: 'submitted',
      signature: 'sig-resumed-on-mount',
    };
    render(<TxStatusCard transaction={tx} onStatusChange={onStatusChange} />);

    // No "Sign Transaction" button — we're past needs-sign.
    expect(screen.queryByRole('button', { name: /sign transaction/i })).not.toBeInTheDocument();

    // Poll runs and resolves to confirmed.
    await waitFor(() => {
      expect(connection.getSignatureStatuses).toHaveBeenCalledWith(
        ['sig-resumed-on-mount'],
        expect.any(Object)
      );
    });
    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith({ status: 'confirmed' });
    });
    await waitFor(() => {
      expect(screen.getByText(/confirmed/i)).toBeInTheDocument();
    });
  });

  it('falls back to needs-sign when status=submitted but signature is missing', () => {
    const tx: PendingTransaction = {
      ...baseTx,
      status: 'submitted',
      // signature deliberately omitted
    };
    render(<TxStatusCard transaction={tx} />);

    // Defensive: missing signature → render Sign button so user can re-attempt.
    expect(screen.getByRole('button', { name: /sign transaction/i })).toBeInTheDocument();
    expect(connection.getSignatureStatuses).not.toHaveBeenCalled();
  });

  it('fires onStatusChange with failed when resumed poll detects blockhash-expired', async () => {
    // Poll returns no signature info, then blockhash check fails.
    connection.getSignatureStatuses.mockResolvedValue({ value: [null] });
    connection.getBlockHeight.mockResolvedValue(99999);
    const onStatusChange = vi.fn();

    const tx: PendingTransaction = {
      ...baseTx,
      status: 'submitted',
      signature: 'sig-stale',
      lastValidBlockHeight: '100',
    };
    render(<TxStatusCard transaction={tx} onStatusChange={onStatusChange} />);

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalled();
    });
    const lastCall = onStatusChange.mock.calls[onStatusChange.mock.calls.length - 1][0];
    expect(lastCall.status).toBe('failed');
    expect(lastCall.error).toMatch(/blockhash expired/i);
  });
```

- [ ] **Step 3.2: Run tests to verify they fail**

Run: `pnpm test:run -- src/components/chat/TxStatusCard.test.tsx`

Expected: the first and third new tests fail (no useEffect to resume polling yet, and the phase initializer doesn't recognize `submitted+signature`). The second ("falls back to needs-sign") may pass coincidentally because the phase initializer currently falls through to needs-sign anyway — that's fine, it pins the defensive contract.

- [ ] **Step 3.3: Extend phase initializer + add resume-polling useEffect in TxStatusCard.tsx**

Open `src/components/chat/TxStatusCard.tsx`. Apply two changes:

**Change A — Extend phase initializer (around lines 74-84):**

Replace:
```ts
  const [phase, setPhase] = useState<Phase>(() => {
    if (transaction.status === 'confirmed' && transaction.signature) return 'confirmed';
    if (
      transaction.status === 'failed' ||
      transaction.status === 'cancelled' ||
      transaction.error
    ) {
      return 'failed';
    }
    return 'needs-sign';
  });
```

With:
```ts
  const [phase, setPhase] = useState<Phase>(() => {
    if (transaction.status === 'confirmed' && transaction.signature) return 'confirmed';
    if (transaction.status === 'submitted' && transaction.signature) return 'broadcasting';
    if (
      transaction.status === 'failed' ||
      transaction.status === 'cancelled' ||
      transaction.error
    ) {
      return 'failed';
    }
    return 'needs-sign';
  });
```

**Change B — Insert mount-only resume `useEffect`** right after the existing cleanup `useEffect` (around lines 91-96). The cleanup useEffect is:

```ts
  useEffect(
    () => () => {
      cancelRef.current = true;
    },
    []
  );
```

Add immediately after it:

```ts
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (transaction.status !== 'submitted' || !transaction.signature) return;
    const sig = transaction.signature;
    const lastValidBlockHeight = Number(transaction.lastValidBlockHeight);
    let active = true;
    pollSignatureStatus(connection, sig, lastValidBlockHeight).then((outcome) => {
      if (!active || cancelRef.current) return;
      if (outcome.status === 'confirmed') {
        setPhase('confirmed');
        onStatusChange?.({ status: 'confirmed' });
      } else {
        const classified = classifyWalletError(new Error(outcome.reason));
        setError(classified);
        setPhase('failed');
        onStatusChange?.({ status: 'failed', error: outcome.reason });
      }
    });
    return () => {
      active = false;
    };
  }, []); // mount-only resume — never re-runs
```

The empty-deps array is deliberate — this is one-shot resume logic; subsequent transitions are driven by `handleSign`. Reading from `transaction.*` (props) rather than `phase`/`signature` (state) makes the intent explicit. The phase initializer above already mapped `status==='submitted' + signature` → `'broadcasting'`, so the UI is consistent when this effect runs.

- [ ] **Step 3.4: Run tests to verify all 3 new pass + existing pass**

Run: `pnpm test:run -- src/components/chat/TxStatusCard.test.tsx`

Expected: all TxStatusCard tests pass (existing 9 + 3 new = 12 total in this file).

- [ ] **Step 3.5: Run full typecheck + suite**

```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p server/tsconfig.json --noEmit
pnpm test:run
```

Expected: **all silent**, **282 tests passing** (was 279, now +3).

- [ ] **Step 3.6: Commit**

```bash
git add src/components/chat/TxStatusCard.tsx src/components/chat/TxStatusCard.test.tsx
git commit -m "$(cat <<'EOF'
feat(TxStatusCard): resume polling on mount when status=submitted+signature

Extend phase initializer with the broadcasting branch (status='submitted'
+ signature). New mount-only useEffect kicks pollSignatureStatus once
with the persisted signature + lastValidBlockHeight. On confirmed →
fires onStatusChange({status:'confirmed'}); on poll failure (incl.
blockhash-expired) → fires onStatusChange({status:'failed', error}).

Empty-deps useEffect is deliberate — one-shot resume; subsequent
transitions driven by handleSign. Reads transaction.* (props) rather
than state to make intent explicit.

Closes the duplicate-sign window on reload: a user who reloads while
the tx is in flight no longer sees Sign Transaction (which would
double-broadcast); they see the actual broadcasting state with
auto-resumed polling that resolves cleanly to confirmed or failed.
EOF
)"
```

---

### Task 4: Wire `onPendingTransactionChange` through MessageBubble + App.tsx

**Files:**
- Modify: `src/components/chat/MessageBubble.tsx` (add prop, forward as closure)
- Modify: `src/App.tsx` (destructure `updatePendingTransaction`, pass as prop)
- Modify: `src/components/chat/MessageBubble.test.tsx` (extend mock + 2 pass-through tests)

**Why last:** Every layer beneath this is now contract-tested. Wiring is one-line on both sides; failure modes are localized.

- [ ] **Step 4.1: Update MessageBubble test mock to capture TxStatusCard props**

The current mock at line 8-10 ignores props entirely:
```ts
vi.mock('./TxStatusCard', () => ({
  default: () => <div data-testid="tx-card" />,
}));
```

We need to capture the `onStatusChange` prop. Replace the mock with:

```ts
const txCardProps = vi.hoisted(() => ({ lastOnStatusChange: null as ((p: unknown) => void) | null }));

vi.mock('./TxStatusCard', () => ({
  default: ({ onStatusChange }: { onStatusChange?: (p: unknown) => void }) => {
    txCardProps.lastOnStatusChange = onStatusChange ?? null;
    return <div data-testid="tx-card" />;
  },
}));
```

Place this immediately after the existing `vi.mock('../../lib/markdown', ...)` block and before the existing `vi.mock('./TxStatusCard', ...)` (which you delete). The `vi.hoisted` ensures `txCardProps` is reachable in test bodies.

- [ ] **Step 4.2: Write 2 failing tests for prop forwarding**

Append to `src/components/chat/MessageBubble.test.tsx` after the last `it(...)`:

```ts
  it('forwards onPendingTransactionChange to TxStatusCard, capturing message id in closure', () => {
    const onPendingTransactionChange = vi.fn();
    const msg: ChatMessage = {
      ...assistantMsg,
      id: 'msg-with-tx',
      pendingTransaction: {
        action: 'deposit',
        protocol: 'Kamino',
        symbol: 'USDC',
        amount: 5,
        reserveAddress: 'r1',
        mint: 'm1',
        summary: 's1',
        base64Txn: 'AAAA',
        blockhash: 'b1',
        lastValidBlockHeight: '100',
      },
    };
    render(
      <MessageBubble
        message={msg}
        isStreaming={false}
        onPendingTransactionChange={onPendingTransactionChange}
      />
    );

    // The mock captured the closure that the parent passed to TxStatusCard.
    expect(txCardProps.lastOnStatusChange).toBeDefined();
    txCardProps.lastOnStatusChange!({ status: 'confirmed' });

    // The closure invoked the parent callback with the message id.
    expect(onPendingTransactionChange).toHaveBeenCalledWith('msg-with-tx', { status: 'confirmed' });
  });

  it('passes undefined onStatusChange when onPendingTransactionChange is omitted', () => {
    const msg: ChatMessage = {
      ...assistantMsg,
      pendingTransaction: {
        action: 'deposit',
        protocol: 'Kamino',
        symbol: 'USDC',
        amount: 5,
        reserveAddress: 'r1',
        mint: 'm1',
        summary: 's1',
        base64Txn: 'AAAA',
        blockhash: 'b1',
        lastValidBlockHeight: '100',
      },
    };
    txCardProps.lastOnStatusChange = null; // reset before render
    render(<MessageBubble message={msg} isStreaming={false} />);
    expect(txCardProps.lastOnStatusChange).toBeNull();
  });
```

- [ ] **Step 4.3: Run tests to verify they fail**

Run: `pnpm test:run -- src/components/chat/MessageBubble.test.tsx`

Expected: 2 new tests fail (`MessageBubble` doesn't accept `onPendingTransactionChange`, doesn't forward it). Existing 7 tests still pass.

- [ ] **Step 4.4: Implement MessageBubble prop forwarding**

Open `src/components/chat/MessageBubble.tsx`. Apply two changes:

**Change A — Update Props interface and add import (lines 1-13):**

Replace:
```ts
import { Markdown } from '../../lib/markdown';
import BentoCell from '../bento/BentoCell';
import KamiCursor from '../bento/KamiCursor';
import ToolBadge from './ToolBadge';
import TxStatusCard from './TxStatusCard';
import ConnectWalletButton from '../ConnectWalletButton';
import { groupToolCalls } from './groupToolCalls';
import type { ChatMessage } from '../../types';

interface Props {
  message: ChatMessage;
  isStreaming: boolean;
}
```

With:
```ts
import { Markdown } from '../../lib/markdown';
import BentoCell from '../bento/BentoCell';
import KamiCursor from '../bento/KamiCursor';
import ToolBadge from './ToolBadge';
import TxStatusCard from './TxStatusCard';
import ConnectWalletButton from '../ConnectWalletButton';
import { groupToolCalls } from './groupToolCalls';
import type { ChatMessage, PendingTransaction } from '../../types';

interface Props {
  message: ChatMessage;
  isStreaming: boolean;
  onPendingTransactionChange?: (messageId: string, patch: Partial<PendingTransaction>) => void;
}
```

**Change B — Update component signature + TxStatusCard render (line 15 + line 64):**

Replace:
```ts
export default function MessageBubble({ message, isStreaming }: Props) {
```

With:
```ts
export default function MessageBubble({ message, isStreaming, onPendingTransactionChange }: Props) {
```

Replace (around line 64):
```tsx
        {message.pendingTransaction && (
          <div className="mt-3">
            <TxStatusCard transaction={message.pendingTransaction} />
          </div>
        )}
```

With:
```tsx
        {message.pendingTransaction && (
          <div className="mt-3">
            <TxStatusCard
              transaction={message.pendingTransaction}
              onStatusChange={
                onPendingTransactionChange
                  ? (patch) => onPendingTransactionChange(message.id, patch)
                  : undefined
              }
            />
          </div>
        )}
```

- [ ] **Step 4.5: Run MessageBubble tests to verify all pass**

Run: `pnpm test:run -- src/components/chat/MessageBubble.test.tsx`

Expected: all MessageBubble tests pass (existing 7 + 2 new = 9 total).

- [ ] **Step 4.6: Wire updatePendingTransaction through App.tsx**

Open `src/App.tsx`. Apply two changes:

**Change A — Add to useChat destructure (around lines 19-29):**

Replace:
```ts
    activeId,
    isStreaming,
    sendMessage,
    stopStreaming,
    newConversation,
    switchConversation,
    deleteConversation,
    clearAllConversations,
    renameConversation,
  } = useChat();
```

With:
```ts
    activeId,
    isStreaming,
    sendMessage,
    stopStreaming,
    newConversation,
    switchConversation,
    deleteConversation,
    clearAllConversations,
    renameConversation,
    updatePendingTransaction,
  } = useChat();
```

**Change B — Pass onPendingTransactionChange to MessageBubble (around line 80-88):**

Replace:
```tsx
              {activeConversation.messages.map((msg, idx) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isStreaming={
                    isStreaming &&
                    msg.role === 'assistant' &&
                    idx === activeConversation.messages.length - 1
                  }
                />
              ))}
```

With:
```tsx
              {activeConversation.messages.map((msg, idx) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isStreaming={
                    isStreaming &&
                    msg.role === 'assistant' &&
                    idx === activeConversation.messages.length - 1
                  }
                  onPendingTransactionChange={updatePendingTransaction}
                />
              ))}
```

- [ ] **Step 4.7: Run full typecheck + suite + build**

```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p server/tsconfig.json --noEmit
pnpm exec tsc -b
pnpm test:run
pnpm build
```

Expected: **all silent**, **284 tests passing** (was 282, now +2). Build clean.

- [ ] **Step 4.8: Commit**

```bash
git add src/components/chat/MessageBubble.tsx src/components/chat/MessageBubble.test.tsx src/App.tsx
git commit -m "$(cat <<'EOF'
feat(chat): wire onPendingTransactionChange through MessageBubble + App

Final wiring step. App.tsx destructures updatePendingTransaction from
useChat and forwards it to MessageBubble. MessageBubble accepts the
optional onPendingTransactionChange prop and bridges into TxStatusCard's
onStatusChange via a closure that captures message.id.

Closes the contract end-to-end: TxStatusCard transitions →
onStatusChange(patch) → MessageBubble closure → updatePendingTransaction
(message.id, patch) → useChat persists → reload reads back correctly.

Test mock for TxStatusCard updated to capture the onStatusChange prop so
the prop-forwarding contract is verified directly.
EOF
)"
```

---

## Post-flight (run once after Task 4)

- [ ] **Verify test count**: `pnpm test:run` → **284 passing across 39 files** (was 270 + 14 new = 284).
- [ ] **Verify branch state**: `git log --oneline fix/txstatuscard-reload-hydration ^main` → expect 6 commits (1 spec + 1 self-review + 4 feature).
- [ ] **Verify no regressions**: open the production-state assistant flow in localdev (`pnpm dev` → http://localhost:5173 → connect → deposit). Confirm the happy-path tx flow still works end-to-end (needs-sign → signing → broadcasting → confirmed). Reload mid-broadcasting → verify it resumes polling rather than reverting to needs-sign.

---

## File summary

| File | Operation | Tests added |
|---|---|---|
| `src/hooks/useChat.ts` | modify (add `updatePendingTransaction`) | — |
| `src/hooks/useChat.test.ts` | extend (+5 tests) | 5 |
| `src/components/chat/TxStatusCard.tsx` | modify (prop, 4 callback fires, hydration branch, useEffect) | — |
| `src/components/chat/TxStatusCard.test.tsx` | extend (+7 tests) | 7 |
| `src/components/chat/MessageBubble.tsx` | modify (prop, closure forward) | — |
| `src/components/chat/MessageBubble.test.tsx` | extend (mock update + 2 tests) | 2 |
| `src/App.tsx` | modify (destructure + forward) | — |

**Totals:** 4 source files modified + 3 test files extended + 1 spec doc + 1 plan doc = 9 files. Test delta: **+14**, taking the suite from **270 → 284**. Bundle delta: negligible (callback chain + tiny useEffect, no new dependencies).

---

## Out-of-band cleanup (NOT part of this plan)

These items are pre-existing tech debt mentioned in CLAUDE.md or session handoffs and should NOT be folded into this PR:

- CLAUDE.md:227-236 file-map references deleted ChatPanel/Sidebar/etc. (Day-21 leftover)
- 9 deferred minors from Day 20-21 chat-shell PR reviews (#46 umbrella)
- D-27 useChat `[DONE]` SSE chunk inner-for-break (#45)
- Empty-msg-on-abort cosmetic UX (#39)

If the implementer notices these during review, file separately or leave alone — they're not in scope.
