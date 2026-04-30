# Spec — TxStatusCard Reload Hydration

**Date:** 2026-05-01
**Branch:** `fix/txstatuscard-reload-hydration`
**Origin:** Bug discovered during Day 21 Chrome MCP financial QA on `kami.rectorspace.com` after the PR #49 chat-shell amber redesign. Out-of-scope finding from `/quality:qa` style sweep.

---

## Problem

When a Kamino transaction confirms on-chain, the user reloads the page, and the **TxStatusCard reverts to `'needs-sign'` state** — even though the deposit is already finalized on-chain. The "Sign Transaction" button reappears.

Worst-case impact: a user who reloads waiting for confirmation can sign the transaction a second time. Solana's blockhash dedup makes a true double-spend rare, but the UX is wrong and creates support load ("did my deposit go through?").

**Root cause:** `TxStatusCard.tsx:74-89` keeps `phase` and `signature` in component-local `useState`. `useChat.ts:272` writes `pendingTransaction = { ...output.data, status: 'pending' }` exactly once when the build* tool result arrives, and **nothing ever updates the persisted message** as the card transitions through signing → broadcasting → confirmed/failed. After reload, the persisted `status` is still `'pending'`, so the phase initializer falls through to `'needs-sign'`.

---

## Goal

Persist the transaction lifecycle through the `'submitted' | 'confirmed' | 'failed'` states so TxStatusCard hydrates correctly across:

1. Page reload
2. Conversation switch (component unmount/remount)
3. Tab refocus after long idle

For any transaction that was signed but not yet confirmed at the time of unmount, **resume `pollSignatureStatus`** on remount using the persisted `signature` + `lastValidBlockHeight`.

---

## Non-Goals

- Persisting transient `'signing'` state — the wallet popup window is sub-3-second; not worth the noise of an extra persist call. UI still shows `'signing'` locally.
- Persisting `'cancelled'` state — user dismissed the popup; reverting to `'needs-sign'` lets them re-attempt cleanly.
- Cross-tab synchronization (`storage` events) — pre-existing limitation of the `localStorage`-backed conversation store.
- Detecting stale tx pre-retry — if the user clicks Retry on a card whose blockhash has expired, `pollSignatureStatus` returns `'failed'` with `'Blockhash expired before confirmation.'`. Lazy-fail with a clear message is fine.
- Multi-tab race when two open tabs persist different states — same pre-existing limitation; not worsened by this change.

---

## Architecture

Three surfaces touched. **Zero schema changes** — `PendingTransaction.status` enum already includes `'submitted' | 'confirmed' | 'failed'` and `signature` is already optional in `src/types.ts:12-28`.

### Surface 1 — `src/hooks/useChat.ts`

Add a new method:

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

Behavior:
- Idempotent no-op when `messageId` is not found in any conversation.
- Idempotent no-op when the message exists but has no `pendingTransaction` (defensive — never creates an empty pendingTransaction).
- Shallow merge: patch values overwrite, untouched fields like `base64Txn`, `mint`, `summary` are preserved.
- Persists via the existing `persist()` closure (same path as `sendMessage`).

Returned alongside existing methods at the bottom of `useChat()`.

### Surface 2 — `src/components/chat/TxStatusCard.tsx`

**New optional prop:**

```ts
interface Props {
  transaction: PendingTransaction;
  onStatusChange?: (patch: Partial<PendingTransaction>) => void;
}
```

**Phase initializer extended** — adds one new branch above the fall-through:

```ts
const [phase, setPhase] = useState<Phase>(() => {
  if (transaction.status === 'confirmed' && transaction.signature) return 'confirmed';
  if (transaction.status === 'submitted' && transaction.signature) return 'broadcasting'; // NEW
  if (transaction.status === 'failed' || transaction.status === 'cancelled' || transaction.error) {
    return 'failed';
  }
  return 'needs-sign';
});
```

**New `useEffect` on mount** — when initial phase is `'broadcasting'` AND a signature is present, resume polling:

```ts
useEffect(() => {
  if (phase !== 'broadcasting' || !signature) return;
  const lastValidBlockHeight = Number(transaction.lastValidBlockHeight);
  let active = true;
  pollSignatureStatus(connection, signature, lastValidBlockHeight).then((outcome) => {
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
  return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // mount-only; do not re-run on prop change
```

The empty-deps array is deliberate — this is one-shot resume logic; subsequent transitions are driven by `handleSign`. We carefully NOT re-fire on prop change because `transaction.signature` may legitimately update (via the parent re-render after the persist round-trip).

**`onStatusChange` calls inside `handleSign`** — fire-and-forget at three points:

```ts
// After sendTransaction resolves:
setSignature(sig);
setPhase('broadcasting');
onStatusChange?.({ status: 'submitted', signature: sig });

// After pollSignatureStatus succeeds:
setPhase('confirmed');
onStatusChange?.({ status: 'confirmed' });

// After pollSignatureStatus fails:
setError(classified);
setPhase('failed');
onStatusChange?.({ status: 'failed', error: outcome.reason });

// In the catch block:
setError(classified);
setPhase('failed');
onStatusChange?.({ status: 'failed', error: classified.message });
```

All call sites use optional chaining — TxStatusCard remains usable in test contexts that don't supply the callback.

### Surface 3 — `src/components/chat/MessageBubble.tsx` + `src/App.tsx`

**MessageBubble** — accept new optional prop and forward as a closure:

```ts
interface Props {
  message: ChatMessage;
  isStreaming: boolean;
  onPendingTransactionChange?: (messageId: string, patch: Partial<PendingTransaction>) => void;
}

// in render:
<TxStatusCard
  transaction={message.pendingTransaction}
  onStatusChange={
    onPendingTransactionChange
      ? (patch) => onPendingTransactionChange(message.id, patch)
      : undefined
  }
/>
```

**App.tsx** — destructure `updatePendingTransaction` from `useChat()` (line ~29) and pass to MessageBubble (line ~80):

```ts
const {
  // ... existing destructures
  updatePendingTransaction, // NEW
} = useChat();

// ...

<MessageBubble
  key={msg.id}
  message={msg}
  isStreaming={...}
  onPendingTransactionChange={updatePendingTransaction} // NEW
/>
```

---

## Data flow

### Happy-path lifecycle (no reload)

```
1. Build* tool stream finishes
   useChat:272 sets pendingTransaction = { ...output.data, status: 'pending' }
   → message persisted with status='pending', signature=undefined
   → TxStatusCard renders phase='needs-sign'

2. User clicks Sign
   → setPhase('signing')   [UI only — NOT persisted]

3. sendTransaction resolves with sig
   → setSignature(sig); setPhase('broadcasting')
   → onStatusChange({ status: 'submitted', signature: sig })   [PERSISTED]

4. pollSignatureStatus resolves
   confirmed: setPhase('confirmed'); onStatusChange({ status: 'confirmed' })
   failed:    setError(...); setPhase('failed'); onStatusChange({ status: 'failed', error })

5. (or) sendTransaction throws (popup dismissed, network)
   → setError(...); setPhase('failed')
   → onStatusChange({ status: 'failed', error: classified.message })   [PERSISTED]
```

### Reload paths

| Persisted state at unload | Initial phase on remount | Behavior |
|---|---|---|
| `status='pending'`, no signature | `needs-sign` | Show Sign button. Existing behavior, no duplicate-sign risk because user deliberately re-attempts. |
| **`status='submitted'`, signature present** | **`broadcasting` (NEW)** | useEffect resumes `pollSignatureStatus(connection, signature, lastValidBlockHeight)`. Resolves quickly to confirmed (sig already on-chain) or fast-fails on blockhash-expired. **Closes the duplicate-sign window.** |
| `status='confirmed'`, signature present | `confirmed` (existing) | Renders Solscan link, no action. |
| `status='failed'`, error present | `failed` (existing) | Renders error + Retry button. |

### Conversation switch behavior

The existing `useEffect(() => () => { cancelRef.current = true; }, [])` cleanup fires on unmount, aborting the local async loop in `handleSign` AND the new resume `useEffect`. On switch back, the new `useEffect` re-runs (new mount), sees `status==='submitted'` + signature, resumes polling from scratch. Same mechanism as page reload.

### Race we accept

Sub-millisecond window between `setSignature(sig)` and `onStatusChange({status:'submitted', sig})`. If the user reloads in this exact window, persisted state stays `'pending'`, so on reload they see the Sign button again. If they re-sign:
- Same blockhash + same instructions + same signer → Solana RPC returns "already processed" or rejects with duplicate-tx error.
- Wallet may show its own warning before broadcasting.

This is acceptable because (a) the window is extremely small, (b) Solana's dedup catches the actual double-spend, (c) synchronizing harder (e.g., persist BEFORE setSignature) trades off latency for negligible safety.

---

## Error handling

### `updatePendingTransaction` defensive no-ops

- `messageId` not found in any conversation → silent no-op. No log spam (could happen during conversation deletion races).
- Message exists but has no `pendingTransaction` field → silent no-op via the `&& m.pendingTransaction` guard. Prevents accidentally creating empty pendingTransaction objects on unrelated messages.
- `localStorage.setItem` failure inside `saveConversations` → existing behavior preserved. Out of scope to add new try/catch here.

### Resume-polling edge cases

- **Blockhash already expired at remount:** `pollSignatureStatus` checks `currentHeight > lastValidBlockHeight` and returns `{status:'failed', reason:'Blockhash expired before confirmation.'}` within ~2-4 seconds. UI flips to `'failed'` with retry button. The retry on a stale tx will fail again immediately for the same reason — outside scope to detect-and-disable.
- **Signature already finalized:** `getSignatureStatuses` returns `confirmationStatus: 'confirmed' | 'finalized'` on first poll → resolves within `POLL_INTERVAL_MS` (2s). UI flickers `'broadcasting'` → `'confirmed'`.
- **RPC transient error during resume:** existing inner try/catch in `pollSignatureStatus` swallows + warns + retries. No new code path.
- **Component unmounts mid-resume:** existing `cancelRef.current = true` cleanup fires. The `if (!active || cancelRef.current) return` guard prevents post-unmount setState. The new useEffect's `active = false` cleanup adds defense-in-depth.

### `onStatusChange` invariants

- Always optional — TxStatusCard works in test contexts without provider.
- Patch is shallow and concrete — never sends `undefined` for fields that should be set; `status` and `signature` are always real values when persisted.

---

## Out of scope (deliberate)

- **Stale-tx pre-retry detection** — surfacing "this transaction is too old, ask Kami to rebuild it" before the retry click. Existing lazy-fail behavior (retry → blockhash-expired → user understands) is acceptable.
- **Multiple TxStatusCards in same conversation** — currently impossible (one `pendingTransaction` per message; one TxStatusCard per message).
- **Cross-tab sync via `storage` events** — pre-existing limitation, not introduced by this change.
- **Persist `signing` and `cancelled`** — see Non-Goals above.

---

## Testing

Tests are mandatory per the project's CLAUDE.md (80%+ coverage on new code). Distribution:

### `src/hooks/useChat.test.ts` — +5 tests

- `updatePendingTransaction` patches the target message's `pendingTransaction` only
- merges patch shallowly (preserves `base64Txn`, `mint`, etc.)
- persists via `saveConversations` (verify `localStorage` mock updated)
- no-op when `messageId` not found in any conversation
- no-op when message exists but has no `pendingTransaction` (does NOT create one)

### `src/components/chat/TxStatusCard.test.tsx` — +7 tests

- `onStatusChange` fires `{status:'submitted', signature}` after `sendTransaction` resolves
- `onStatusChange` fires `{status:'confirmed'}` after poll succeeds
- `onStatusChange` fires `{status:'failed', error}` after poll fails (blockhash-expired path)
- `onStatusChange` fires `{status:'failed', error}` after `sendTransaction` throws
- mount with `status='submitted' + signature` → initial phase is `'broadcasting'`, polling kicks off (verify mock `getSignatureStatuses` called)
- mount with `status='submitted'` but **no signature** → falls back to `'needs-sign'` (defensive guard)
- omitted `onStatusChange` prop → no errors thrown on transitions

### `src/components/chat/MessageBubble.test.tsx` — +2 tests

- `onPendingTransactionChange` forwarded to TxStatusCard with closure capturing `message.id`
- omitted prop → TxStatusCard receives `undefined` for `onStatusChange`, still renders normally

### Mocks to extend

- `connection.getSignatureStatuses` — already mocked in existing TxStatusCard tests (extend with confirmed-on-first-call shape).
- `connection.getBlockHeight` — already mocked.
- `saveConversations` from `lib/storage` — already mocked in useChat tests.

### Test count delta

270 → **~284** (+14 across 3 existing test files; **no new test files**).

### CI commands

```bash
pnpm exec tsc --noEmit                         # client typecheck
pnpm exec tsc -p server/tsconfig.json --noEmit # server typecheck
pnpm exec tsc -b                               # both, project mode (matches Vercel)
pnpm test:run                                   # full vitest suite
pnpm build                                      # tsc -b + vite build
```

---

## File list

**Source (modify):**
- `src/hooks/useChat.ts`
- `src/components/chat/TxStatusCard.tsx`
- `src/components/chat/MessageBubble.tsx`
- `src/App.tsx`

**Tests (extend):**
- `src/hooks/useChat.test.ts`
- `src/components/chat/TxStatusCard.test.tsx`
- `src/components/chat/MessageBubble.test.tsx`

**Docs (new):**
- `docs/superpowers/specs/2026-05-01-txstatuscard-reload-hydration-design.md` (this file)
- `docs/superpowers/plans/2026-05-01-txstatuscard-reload-hydration-implementation.md` (next, via writing-plans skill)

**Total:** 4 source + 3 test + 2 doc = **9 files**.

---

## Implementation order (preview for the plan)

1. **Add `updatePendingTransaction` to useChat** + 5 unit tests (no UI integration yet, isolated module).
2. **Wire `onStatusChange` into TxStatusCard** + 4 callback-firing tests (no resume-polling yet).
3. **Add resume-polling useEffect to TxStatusCard** + 3 mount-state tests.
4. **Wire `onPendingTransactionChange` through MessageBubble + App.tsx** + 2 pass-through tests.

Each task is independently committable, two-stage reviewable (general-purpose spec compliance + opus code quality), and ships a coherent slice of the fix. Plan to follow via writing-plans skill.
