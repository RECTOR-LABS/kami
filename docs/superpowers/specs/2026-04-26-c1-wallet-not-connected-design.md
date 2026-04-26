# Spec — C-1: Wallet-not-connected UX cluster

- **Date:** 2026-04-26
- **QA findings closed:** D-1, D-7, D-22, U-1, U-11 (also retires D-6, D-19 by deletion)
- **Branch:** `feat/c1-wallet-not-connected-ux`
- **Estimated effort:** ~4h (5–6 commits)

---

## 1. Background

The 2026-04-26 dev-QA + end-user-QA run flagged the wallet-not-connected user journey as the highest-leverage cluster for the next iteration (verdict: 🔴 Needs Attention; full report in `.qa/runs/1777171026-both-fresh+eyes/report.md`).

Five individual findings collapse into one root problem: when the user clicks a wallet-required suggestion chip without a wallet connected, the app *looks* broken even though it isn't.

| ID | Where | Today |
|---|---|---|
| D-1 | `server/tools/kamino.ts:132,334,710` | 3× tool error strings still say "connect Phantom or Solflare" despite Solflare-led brand |
| D-7 | `src/components/TransactionCard.tsx:54-60` | "Confirm & Sign" button has no `onClick` (dead UI from a legacy parsing path) |
| D-22 | `server/tools/kamino.ts` | Wallet-validation try/catch + rent-explainer paragraph duplicated across 3 sites with subtle drift |
| U-1 | Steps 12, 14 of fresh-eyes diary | Tool-call pill renders `"Fetching Kamino portfolio failed"` in **red** when the user simply hasn't connected — alarming first-time visitors |
| U-11 | Steps 5, 12, 14 | LLM tells user to "connect Solflare" but provides no inline button — user has to scroll up to the top-right "Select Wallet" |

The fix needs to (a) end the brand drift, (b) classify "wallet not connected" as a non-error UX state, (c) close the connect-wallet loop inside the chat without scrolling, and (d) clean up the dead transaction-rendering path that's been parked since the legacy `TransactionIntent` flow was replaced by `PendingTransaction`.

## 2. Architecture & data contracts

The change is a typed `code` discriminator riding along the existing `ToolResult` error variant — a sticker, not a paperwork reform. It threads through the SSE wire format, surfaces as a 4th `ToolCallRecord` status on the client, and triggers a yellow pill plus an inline Connect Wallet CTA in `ChatMessage`.

### 2.1 `server/tools/types.ts`

```ts
export type ToolErrorCode = 'WALLET_NOT_CONNECTED' | 'INVALID_WALLET';
//  Non-exhaustive union — new codes (e.g. 'OBLIGATION_TOO_SMALL', 'STALE_ORACLE')
//  may be added later without touching every consumer.

export type ToolResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: ToolErrorCode };
```

`code` is optional. All 22 existing tool returns stay backwards-compatible. The LLM still reads `error` to compose its recovery message.

### 2.2 SSE wire format (`server/chat.ts`)

No shape change. The `toolResult` event already passes `output` verbatim, so the new `code` field is forwarded automatically.

### 2.3 `src/types.ts`

```ts
export interface ToolCallRecord {
  id: string;
  name: string;
  status: 'calling' | 'done' | 'error' | 'wallet-required';  // +1
  error?: string;
  code?: string;  // new — raw passthrough
}
```

`'wallet-required'` is its own status (not a sub-type of `'error'`) because the UI treatment is meaningfully different — fewer if-conditions in the render layer.

### 2.4 Data flow (server → client)

```
server tool returns:
  { ok: false, error: "Ask the user to connect Solflare ...", code: 'WALLET_NOT_CONNECTED' }
        ↓
SSE toolResult event (verbatim)
        ↓
useChat parses; sees code → maps to status: 'wallet-required'
        ↓
ToolCallBadges renders yellow pill ("Wallet required")
ChatMessage detects any wallet-required call → renders <ConnectWalletButton />
        ↓
Click → useWalletModal().setVisible(true) → user picks wallet → done
```

## 3. Server changes

### 3.1 New file: `server/tools/wallet.ts`

```ts
import { address, type Address } from '@solana/kit';
import type { ToolContext } from './types.js';
import type { ToolErrorCode } from './types.js';

type WalletAssertResult =
  | { ok: false; error: string; code: ToolErrorCode }
  | { wallet: Address };

export function assertWallet(ctx: ToolContext): WalletAssertResult {
  if (!ctx.walletAddress) {
    return {
      ok: false,
      error: 'Ask the user to connect Solflare (recommended) or another Solana wallet first.',
      code: 'WALLET_NOT_CONNECTED',
    };
  }
  try {
    return { wallet: address(ctx.walletAddress) };
  } catch {
    return {
      ok: false,
      error: `Invalid wallet address: ${ctx.walletAddress}`,
      code: 'INVALID_WALLET',
    };
  }
}
```

Pure helper, no klend-sdk imports — keeps tests fast.

### 3.2 `server/tools/kamino.ts` edits

| Call site | Today | After |
|---|---|---|
| `getPortfolio:128-141` | inline if + try/catch | `const r = assertWallet(ctx); if (!('wallet' in r)) return r;` |
| `simulateHealth:330-343` | inline if + try/catch | same |
| `makeBuildTool:706-715` | inline if only | same — and pass `r.wallet` straight to `buildPendingTransaction` |
| `buildPendingTransaction:619-624` | inline try/catch | DELETED (validated upstream by makeBuildTool) |

`buildPendingTransaction` signature changes: `walletAddress: string` → `wallet: Address`. One caller, local change.

### 3.3 `RENT_EXPLAINER` constant

The ~0.022 SOL paragraph at `kamino.ts:475` and `:480` overlaps with subtle wording drift (per D-22). Extract a single `const RENT_EXPLAINER = '…'` near the top, reuse at both sites.

### 3.4 `server/prompt.ts`

No change. Line 9 already says "Solflare (recommended)". The bug was only in the three downstream tool error strings — once `assertWallet` lands, the LLM gets consistent copy.

## 4. Client changes

### 4.1 `src/types.ts`

- `ToolCallRecord.status` gains `'wallet-required'`
- `ToolCallRecord` gains optional `code?: string`
- DELETE `interface TransactionIntent`
- DELETE `transaction?: TransactionIntent | null` from `ChatMessage`

### 4.2 `src/hooks/useChat.ts`

- DELETE `import { parseTransactionBlock } from '../lib/parseTransaction'` (line 3)
- DELETE the `parseTransactionBlock(accumulated)` call at line 174 + the `transaction: txn` plumbing
- Update toolResult handler (line 185-202): when `output.code === 'WALLET_NOT_CONNECTED'` (or `'INVALID_WALLET'`), set `status: 'wallet-required'` and pass `code` through to the record. Other code paths unchanged.

### 4.3 `src/components/ToolCallBadges.tsx`

Add a 4th branch above the `error` branch:

```tsx
if (call.status === 'wallet-required') {
  return (
    <span
      key={call.id}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md
                 bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400"
    >
      <AlertCircle className="w-3 h-3" />
      Wallet required
    </span>
  );
}
```

Tailwind `amber-*` ships in the default palette; no theme extension needed.

### 4.4 New component: `src/components/ConnectWalletButton.tsx`

```tsx
import { Wallet } from 'lucide-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

export default function ConnectWalletButton() {
  const { setVisible } = useWalletModal();
  return (
    <button
      type="button"
      onClick={() => setVisible(true)}
      className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg
                 bg-kami-accent hover:bg-kami-accentHover text-white
                 text-sm font-medium transition-colors"
    >
      <Wallet className="w-4 h-4" />
      Connect Wallet
    </button>
  );
}
```

Same `useWalletModal()` hook `EmptyState.tsx` already uses; no new wallet-adapter wiring.

### 4.5 `src/components/ChatMessage.tsx`

- DELETE imports: `TransactionCard`, `stripTransactionBlock`
- DELETE the `walletConnected` prop from `Props` and the function signature
- DELETE the `displayContent = message.transaction ? stripTransactionBlock(...) : ...` ternary; render `message.content` directly
- DELETE the `<TransactionCard ... />` render branch
- ADD: `const showConnectCta = message.toolCalls?.some(c => c.status === 'wallet-required')` — render `<ConnectWalletButton />` below `<Markdown />` when true

### 4.6 `src/components/ChatPanel.tsx`

Drop `walletConnected={connected}` prop on the `<ChatMessageComponent>` call at line 62. Remove the `connected` import if it's no longer used elsewhere in the file (verify during implementation).

## 5. Cleanup (deletions)

- DELETE file: `src/components/TransactionCard.tsx`
- DELETE file: `src/lib/parseTransaction.ts`
- DELETE type: `TransactionIntent` from `src/types.ts`
- DELETE field: `transaction?` on `ChatMessage` interface
- DELETE prop: `walletConnected` on `ChatMessage` component

These are dead code — the LLM is forbidden from emitting raw \`\`\`transaction blocks (system prompt line 14), so `parseTransactionBlock` has zero live callers. Aggressive cleanup retires backlog items D-6 and D-19 as a side effect.

## 6. Testing

| File | What it tests | New / extend |
|---|---|---|
| `server/tools/wallet.test.ts` | `assertWallet` — null wallet → `WALLET_NOT_CONNECTED`, valid bs58 → `{ wallet }`, malformed → `INVALID_WALLET` | NEW |
| `src/components/ToolCallBadges.test.tsx` | yellow `wallet-required` pill renders, error pill still red, done pill still green | NEW |
| `src/components/ConnectWalletButton.test.tsx` | renders; click → calls `setVisible(true)` (mock `useWalletModal`) | NEW |
| `src/components/ChatMessage.test.tsx` | wallet-required tool call → CTA visible; without → CTA hidden; legacy `transaction` field gone (regression guard) | NEW |
| `src/hooks/useChat.test.ts` | toolResult with `code: 'WALLET_NOT_CONNECTED'` → record status `'wallet-required'`; toolResult with `ok:false` no code → status `'error'` (regression guard) | NEW (scoped to C-1 paths only) |

**Coverage target:** ≥80% on the 5 new files (per CLAUDE.md). Existing 31% global isn't worsened.

**Wallet-adapter mocking pattern** (used inline per-test, no global setup):

```ts
vi.mock('@solana/wallet-adapter-react-ui', () => ({
  useWalletModal: () => ({ setVisible: vi.fn() }),
}));
```

D-11 (broader `useChat.test.ts` coverage) remains a separate P1 task — this PR only adds the wallet-required paths.

## 7. Commit plan

Branch: `feat/c1-wallet-not-connected-ux` off `main`. Sequenced commits, each independently passing CI:

1. `refactor(types): add ToolErrorCode + optional code on ToolResult error variant`
2. `refactor(server): extract assertWallet helper to server/tools/wallet.ts + dedupe wallet checks in kamino.ts` (with `wallet.test.ts`)
3. `feat(chat): add wallet-required status + yellow pill in ToolCallBadges` (with `ToolCallBadges.test.tsx`)
4. `feat(chat): inline ConnectWalletButton CTA after wallet-required tool error` (with `ConnectWalletButton.test.tsx` + `ChatMessage.test.tsx`)
5. `chore(legacy): delete TransactionCard, parseTransactionBlock, TransactionIntent, walletConnected prop`
6. `test(useChat): cover wallet-required status mapping in toolResult handler`

PR title: `feat: C-1 wallet-not-connected UX cluster (closes D-1, D-7, D-22, U-1, U-11)`.

## 8. Risks & out-of-scope

**Risks:**
- The yellow `amber-500` palette must contrast adequately on the dark background; visually verify in browser before merging.
- `INVALID_WALLET` shares the `'wallet-required'` status — meaning a malformed `walletAddress` shows the same pill as no-wallet. Acceptable: both states demand "connect a wallet" before retry. If we ever see a malformed-address case in the wild we revisit.
- `useWalletModal` is a hook — `ConnectWalletButton` must be rendered inside `WalletProvider` (it is, per `WalletProvider.tsx` wrapping `App`).

**Out of scope (deferred to follow-up PRs):**
- D-2 (preflight catch swallowing `simulateTransaction` errors) — separate P0 fix.
- D-3 / D-4 (`useChat` 429-handling + abort race) — separate P0 fixes; touch the same hook so coordinate ordering.
- D-11 (broader `useChat.test.ts` coverage beyond wallet-required) — separate P1.
- D-13 (oracle-staleness gate on `findYield` / `getPortfolio`) — separate P0.
- C-2 (LLM streaming text polish: paragraph breaks, list consistency, pill dedup) — separate P1.

## 9. References

- QA report: `.qa/runs/1777171026-both-fresh+eyes/report.md` (markdown) and `report.html` (rendered)
- Existing wallet-modal pattern: `src/components/EmptyState.tsx` lines 22-37
- Existing tool-result wire format: `src/hooks/useChat.ts:185-202`
- Project conventions: `CLAUDE.md` (project-level) and `~/.claude/CLAUDE.md` (global)
