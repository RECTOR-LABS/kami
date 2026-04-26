# C-1 Wallet-Not-Connected UX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the alarming red "Fetching Kamino portfolio failed" pill (and friends) with a typed `WALLET_NOT_CONNECTED` error code that drives a yellow "Wallet required" pill plus an inline Connect Wallet CTA — closing the C-1 cluster from the 2026-04-26 QA report.

**Architecture:** A typed `code?: ToolErrorCode` discriminator rides along the existing `ToolResult` error variant. Server-side, `assertWallet()` returns `{ ok: false, error, code: 'WALLET_NOT_CONNECTED' | 'INVALID_WALLET' }` from a single helper consumed at 3 sites. Client-side, `useChat` maps the code to a 4th `ToolCallRecord.status` value `'wallet-required'`, which `ToolCallBadges` renders as a yellow pill and `ChatMessage` follows with an inline `<ConnectWalletButton />` (opens the existing wallet-modal via `useWalletModal().setVisible(true)`). The legacy `TransactionCard` / `parseTransactionBlock` chain is deleted in the same PR.

**Tech Stack:** TypeScript (strict), `@solana/kit` v2, `@kamino-finance/klend-sdk` 7.3, React 18, `@solana/wallet-adapter-react-ui`, vitest + happy-dom + `@testing-library/react`, Tailwind (`amber-*` from default palette).

**Spec:** `docs/superpowers/specs/2026-04-26-c1-wallet-not-connected-design.md`

**Branch:** `feat/c1-wallet-not-connected-ux` off `main`. PR title: `feat: C-1 wallet-not-connected UX cluster (closes D-1, D-7, D-22, U-1, U-11)`.

---

## File Structure

| File | Action | Purpose |
|---|---|---|
| `server/tools/types.ts` | Modify | Add `ToolErrorCode` union + optional `code` field on `ToolResult` error variant |
| `server/tools/wallet.ts` | Create | `assertWallet()` pure helper (no klend-sdk imports — fast tests) |
| `server/tools/wallet.test.ts` | Create | Unit tests for `assertWallet` (3 cases) |
| `server/tools/kamino.ts` | Modify | Use `assertWallet` at `getPortfolio`, `simulateHealth`, `makeBuildTool`; drop redundant validate in `buildPendingTransaction`; extract `KLEND_NO_CLOSE_OBLIGATION` constant |
| `src/types.ts` | Modify | Add `'wallet-required'` to `ToolCallRecord.status`; add optional `code?: string` field; (cleanup phase: delete `TransactionIntent`, drop `transaction?` from `ChatMessage`) |
| `src/components/ToolCallBadges.tsx` | Modify | Add 4th branch for `wallet-required` → yellow pill |
| `src/components/ToolCallBadges.test.tsx` | Create | Render tests for all 4 pill states |
| `src/components/ConnectWalletButton.tsx` | Create | Leaf component using `useWalletModal()` |
| `src/components/ConnectWalletButton.test.tsx` | Create | Render + click → `setVisible(true)` |
| `src/hooks/useChat.ts` | Modify | Drop `parseTransactionBlock`; map `output.code` to `'wallet-required'` status; pass `code` through `ToolCallRecord` |
| `src/hooks/useChat.test.ts` | Create | Scoped test: toolResult with `code: 'WALLET_NOT_CONNECTED'` → status `'wallet-required'` |
| `src/components/ChatMessage.tsx` | Modify | Drop `walletConnected` prop, `TransactionCard` import + render branch, `stripTransactionBlock`; add `<ConnectWalletButton />` when any tool call is `wallet-required` |
| `src/components/ChatMessage.test.tsx` | Create | wallet-required → CTA visible; without → CTA hidden; regression guard for legacy fields |
| `src/components/ChatPanel.tsx` | Modify | Drop `walletConnected={connected}` prop pass on `<ChatMessageComponent>` |
| `src/components/TransactionCard.tsx` | Delete | Legacy dead code |
| `src/lib/parseTransaction.ts` | Delete | Legacy dead code |

---

## Task 0: Branch setup

**Files:** none (git only)

- [ ] **Step 1: Verify clean working tree**

Run: `git status`
Expected: `On branch main` with `nothing to commit, working tree clean`. If dirty, stash first.

- [ ] **Step 2: Pull latest main**

Run: `git fetch origin && git pull origin main --ff-only`
Expected: `Already up to date.` or fast-forward.

- [ ] **Step 3: Create + checkout feature branch**

Run: `git checkout -b feat/c1-wallet-not-connected-ux`
Expected: `Switched to a new branch 'feat/c1-wallet-not-connected-ux'`.

- [ ] **Step 4: Verify branch**

Run: `git branch --show-current`
Expected: `feat/c1-wallet-not-connected-ux`.

---

## Task 1: Server types — add ToolErrorCode + extend ToolResult

**Files:**
- Modify: `server/tools/types.ts`

- [ ] **Step 1: Read current `types.ts`**

Run: `cat server/tools/types.ts`
Expected output (current state):
```ts
import { z } from 'zod';

export interface ToolDefinition<TInput, TOutput> {
  name: string;
  description: string;
  schema: z.ZodType<TInput>;
  handler: (input: TInput, ctx: ToolContext) => Promise<TOutput>;
}

export interface ToolContext {
  walletAddress: string | null;
}

export type ToolResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };
```

- [ ] **Step 2: Edit `server/tools/types.ts`**

Replace the file content with:

```ts
import { z } from 'zod';

export interface ToolDefinition<TInput, TOutput> {
  name: string;
  description: string;
  schema: z.ZodType<TInput>;
  handler: (input: TInput, ctx: ToolContext) => Promise<TOutput>;
}

export interface ToolContext {
  walletAddress: string | null;
}

// Non-exhaustive union — new codes (e.g. 'OBLIGATION_TOO_SMALL', 'STALE_ORACLE')
// may be added later without touching every consumer.
export type ToolErrorCode = 'WALLET_NOT_CONNECTED' | 'INVALID_WALLET';

export type ToolResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: ToolErrorCode };
```

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc -p server/tsconfig.json --noEmit`
Expected: zero errors. Existing call sites pass `{ ok: false, error: '…' }` without `code` and the field is optional.

- [ ] **Step 4: Commit**

Run:
```bash
git add server/tools/types.ts
git commit -m "$(cat <<'EOF'
refactor(types): add ToolErrorCode + optional code on ToolResult

Introduces a non-exhaustive ToolErrorCode union and an optional code
field on the ToolResult error variant. All existing tool returns stay
backwards-compatible; only the new wallet helpers will set the code.

Part of C-1 (wallet-not-connected UX cluster).
EOF
)"
```

Expected: commit lands; `git log -1 --oneline` shows the new commit.

---

## Task 2: assertWallet helper + tests

**Files:**
- Create: `server/tools/wallet.ts`
- Create: `server/tools/wallet.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/tools/wallet.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { assertWallet } from './wallet.js';
import type { ToolContext } from './types.js';

describe('assertWallet', () => {
  it('returns WALLET_NOT_CONNECTED when walletAddress is null', () => {
    const ctx: ToolContext = { walletAddress: null };
    const result = assertWallet(ctx);
    expect('wallet' in result).toBe(false);
    if ('wallet' in result) return;
    expect(result.ok).toBe(false);
    expect(result.code).toBe('WALLET_NOT_CONNECTED');
    expect(result.error).toContain('Solflare');
    expect(result.error).not.toContain('Phantom');
  });

  it('returns the parsed Address when walletAddress is a valid bs58 pubkey', () => {
    const ctx: ToolContext = {
      walletAddress: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
    };
    const result = assertWallet(ctx);
    expect('wallet' in result).toBe(true);
    if (!('wallet' in result)) return;
    expect(typeof result.wallet).toBe('string');
    expect(result.wallet).toBe('FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr');
  });

  it('returns INVALID_WALLET when walletAddress is malformed', () => {
    const ctx: ToolContext = { walletAddress: 'not-a-real-address' };
    const result = assertWallet(ctx);
    expect('wallet' in result).toBe(false);
    if ('wallet' in result) return;
    expect(result.ok).toBe(false);
    expect(result.code).toBe('INVALID_WALLET');
    expect(result.error).toContain('Invalid wallet address');
    expect(result.error).toContain('not-a-real-address');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run server/tools/wallet.test.ts`
Expected: FAIL with `Cannot find module './wallet.js'` (or similar import error).

- [ ] **Step 3: Create `server/tools/wallet.ts`**

```ts
import { address, type Address } from '@solana/kit';
import type { ToolContext, ToolErrorCode } from './types.js';

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

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run server/tools/wallet.test.ts`
Expected: 3 tests passing.

- [ ] **Step 5: Run full server typecheck**

Run: `pnpm exec tsc -p server/tsconfig.json --noEmit`
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add server/tools/wallet.ts server/tools/wallet.test.ts
git commit -m "$(cat <<'EOF'
refactor(server): add assertWallet helper with structured error codes

Pure helper that consolidates the wallet-presence + bs58-parsing
boilerplate previously inlined at 3 sites in kamino.ts. Returns
{ wallet: Address } on success or { ok: false, error, code } where
code is WALLET_NOT_CONNECTED | INVALID_WALLET.

3 unit tests cover the three branches. No klend-sdk imports — keeps
the test isolated from heavy SDK mocks.

Part of C-1 (wallet-not-connected UX cluster).
EOF
)"
```

---

## Task 3: Wire assertWallet into kamino.ts + extract klend lore + drop "Phantom" copy

**Files:**
- Modify: `server/tools/kamino.ts` (4 sites + 1 constant extraction)

This task touches 4 specific regions. Each step shows the exact before/after.

- [ ] **Step 1: Add the helper import (top of file)**

Find the existing import block (lines 1-28, ending with `import { getRpc } from '../solana/connection.js';`).

Add this line immediately after that import:

```ts
import { assertWallet } from './wallet.js';
```

- [ ] **Step 2: Extract `KLEND_NO_CLOSE_OBLIGATION` constant**

Find the existing `KAMINO_MAIN_MARKET` constant (line 30). Add immediately below it:

```ts
const KLEND_NO_CLOSE_OBLIGATION =
  'klend does not currently expose a close_obligation instruction';
```

- [ ] **Step 3: Refactor `getPortfolio` wallet check (lines 128-141)**

Find:
```ts
  handler: async (_input, ctx) => {
    if (!ctx.walletAddress) {
      return {
        ok: false,
        error: 'No wallet connected. Ask the user to connect Phantom or Solflare first.',
      };
    }

    let wallet: Address;
    try {
      wallet = address(ctx.walletAddress);
    } catch {
      return { ok: false, error: `Invalid wallet address: ${ctx.walletAddress}` };
    }
```

Replace with:
```ts
  handler: async (_input, ctx) => {
    const guard = assertWallet(ctx);
    if (!('wallet' in guard)) return guard;
    const wallet = guard.wallet;
```

- [ ] **Step 4: Refactor `simulateHealth` wallet check (lines 330-343)**

Find the matching block in `simulateHealth.handler` (same shape as Step 3) and apply the same replacement.

- [ ] **Step 5: Refactor `makeBuildTool` factory (lines 706-715)**

Find:
```ts
function makeBuildTool(action: BuildAction, description: string): ToolDefinition<BuildActionInput, ToolResult<PendingTransaction>> {
  return {
    name: `build${verbFor(action)}`,
    description,
    schema: buildActionInputSchema,
    handler: async (input, ctx) => {
      if (!ctx.walletAddress) {
        return {
          ok: false,
          error: 'No wallet connected. Ask the user to connect Phantom or Solflare first.',
        };
      }
      return buildPendingTransaction(action, input, ctx.walletAddress);
    },
  };
}
```

Replace with:
```ts
function makeBuildTool(action: BuildAction, description: string): ToolDefinition<BuildActionInput, ToolResult<PendingTransaction>> {
  return {
    name: `build${verbFor(action)}`,
    description,
    schema: buildActionInputSchema,
    handler: async (input, ctx) => {
      const guard = assertWallet(ctx);
      if (!('wallet' in guard)) return guard;
      return buildPendingTransaction(action, input, guard.wallet);
    },
  };
}
```

- [ ] **Step 6: Update `buildPendingTransaction` signature + drop redundant validate (lines 614-624)**

Find:
```ts
async function buildPendingTransaction(
  action: BuildAction,
  input: BuildActionInput,
  walletAddress: string
): Promise<ToolResult<PendingTransaction>> {
  let wallet: Address;
  try {
    wallet = address(walletAddress);
  } catch {
    return { ok: false, error: `Invalid wallet address: ${walletAddress}` };
  }
```

Replace with:
```ts
async function buildPendingTransaction(
  action: BuildAction,
  input: BuildActionInput,
  wallet: Address
): Promise<ToolResult<PendingTransaction>> {
```

(The `let wallet: Address; try { … } catch { … }` block is deleted entirely. The function now receives a pre-validated `Address` from `makeBuildTool`.)

- [ ] **Step 7: Use `KLEND_NO_CLOSE_OBLIGATION` in the rent paragraphs (lines 475 + 480)**

In the `error:` string at line 475, replace the substring `klend does not currently expose a close_obligation instruction` with `${KLEND_NO_CLOSE_OBLIGATION}`. Use template literal interpolation; the surrounding single quotes become backticks if needed.

Same for line 480.

After this step, both rent paragraphs reference the single constant. Wording drift impossible.

- [ ] **Step 8: Run server typecheck**

Run: `pnpm exec tsc -p server/tsconfig.json --noEmit`
Expected: zero errors.

- [ ] **Step 9: Run full test suite (regression check)**

Run: `pnpm test:run`
Expected: all existing tests pass (106+ baseline + 3 new from Task 2 = 109+).

- [ ] **Step 10: Verify no "Phantom" reference remains in kamino.ts**

Run: `grep -n "Phantom" server/tools/kamino.ts`
Expected: zero matches.

- [ ] **Step 11: Commit**

```bash
git add server/tools/kamino.ts
git commit -m "$(cat <<'EOF'
refactor(server): wire assertWallet into kamino.ts; drop "Phantom" copy

Replaces 3 inlined wallet-validation blocks (getPortfolio,
simulateHealth, makeBuildTool) with calls to assertWallet, and drops
the now-redundant address parse inside buildPendingTransaction (which
now receives a pre-validated Address).

Also extracts KLEND_NO_CLOSE_OBLIGATION as a constant used by both
rent-shortfall messages, eliminating the wording drift flagged in D-22.

The user-facing messages drop "Phantom" and lead with "Solflare
(recommended)" to match server/prompt.ts:9 and the bounty-Solflare
brand alignment.

Closes D-1 (stale Phantom copy) and D-22 (wallet-validation drift).
Part of C-1 (wallet-not-connected UX cluster).
EOF
)"
```

---

## Task 4: Client types + ToolCallBadges yellow pill + tests

**Files:**
- Modify: `src/types.ts`
- Modify: `src/components/ToolCallBadges.tsx`
- Create: `src/components/ToolCallBadges.test.tsx`

- [ ] **Step 1: Edit `src/types.ts` — extend `ToolCallRecord`**

Find:
```ts
export interface ToolCallRecord {
  id: string;
  name: string;
  status: 'calling' | 'done' | 'error';
  error?: string;
}
```

Replace with:
```ts
export interface ToolCallRecord {
  id: string;
  name: string;
  status: 'calling' | 'done' | 'error' | 'wallet-required';
  error?: string;
  code?: string;
}
```

(Do NOT delete `TransactionIntent` or the `transaction?` field yet — that happens in Task 7's cleanup.)

- [ ] **Step 2: Write the failing test**

Create `src/components/ToolCallBadges.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ToolCallBadges from './ToolCallBadges';
import type { ToolCallRecord } from '../types';

const baseCall = (overrides: Partial<ToolCallRecord>): ToolCallRecord => ({
  id: 'tc-1',
  name: 'getPortfolio',
  status: 'calling',
  ...overrides,
});

describe('ToolCallBadges', () => {
  it('renders nothing when calls is empty', () => {
    const { container } = render(<ToolCallBadges calls={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders calling state with the friendly label', () => {
    render(<ToolCallBadges calls={[baseCall({ status: 'calling' })]} />);
    expect(screen.getByText('Fetching Kamino portfolio')).toBeInTheDocument();
  });

  it('renders done state with the friendly label', () => {
    render(<ToolCallBadges calls={[baseCall({ status: 'done' })]} />);
    expect(screen.getByText('Fetching Kamino portfolio')).toBeInTheDocument();
  });

  it('renders error state with "failed" suffix', () => {
    render(<ToolCallBadges calls={[baseCall({ status: 'error', error: 'boom' })]} />);
    expect(screen.getByText('Fetching Kamino portfolio failed')).toBeInTheDocument();
  });

  it('renders wallet-required state as a neutral "Wallet required" pill', () => {
    render(<ToolCallBadges calls={[baseCall({ status: 'wallet-required' })]} />);
    expect(screen.getByText('Wallet required')).toBeInTheDocument();
    // Friendly label suppressed for wallet-required — pill speaks for itself
    expect(screen.queryByText('Fetching Kamino portfolio')).not.toBeInTheDocument();
    expect(screen.queryByText(/failed/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm exec vitest run src/components/ToolCallBadges.test.tsx`
Expected: 4 of 5 tests pass; the wallet-required test FAILs (the component doesn't render that branch yet).

- [ ] **Step 4: Edit `src/components/ToolCallBadges.tsx`**

Find the existing `if (call.status === 'error')` branch (lines 36-46) and INSERT a new branch BEFORE it:

```tsx
        if (call.status === 'wallet-required') {
          return (
            <span
              key={call.id}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400"
            >
              <AlertCircle className="w-3 h-3" />
              Wallet required
            </span>
          );
        }
```

(`AlertCircle` is already imported at the top of the file.)

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run src/components/ToolCallBadges.test.tsx`
Expected: 5 of 5 tests pass.

- [ ] **Step 6: Run full typecheck**

Run: `pnpm exec tsc -b`
Expected: zero errors.

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/components/ToolCallBadges.tsx src/components/ToolCallBadges.test.tsx
git commit -m "$(cat <<'EOF'
feat(chat): add wallet-required status + yellow pill in ToolCallBadges

Extends ToolCallRecord.status with a 4th value 'wallet-required' (and
adds an optional code? field for raw passthrough). When a tool returns
WALLET_NOT_CONNECTED or INVALID_WALLET, the pill renders as a neutral
amber "Wallet required" badge instead of the alarming red "failed".

5 unit tests cover all 4 pill branches plus the empty case.

The wire-up that maps server code → client status comes in the next
commit (useChat plumbing); this commit adds the rendering surface.

Closes U-1 (red failed pill alarming fresh users — visual half).
Part of C-1 (wallet-not-connected UX cluster).
EOF
)"
```

---

## Task 5: ConnectWalletButton component + tests

**Files:**
- Create: `src/components/ConnectWalletButton.tsx`
- Create: `src/components/ConnectWalletButton.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ConnectWalletButton.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const setVisibleMock = vi.fn();

vi.mock('@solana/wallet-adapter-react-ui', () => ({
  useWalletModal: () => ({ setVisible: setVisibleMock }),
}));

import ConnectWalletButton from './ConnectWalletButton';

describe('ConnectWalletButton', () => {
  it('renders the Connect Wallet label', () => {
    render(<ConnectWalletButton />);
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
  });

  it('opens the wallet modal when clicked', () => {
    setVisibleMock.mockClear();
    render(<ConnectWalletButton />);
    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }));
    expect(setVisibleMock).toHaveBeenCalledWith(true);
    expect(setVisibleMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/components/ConnectWalletButton.test.tsx`
Expected: FAIL with `Cannot find module './ConnectWalletButton'` (or similar).

- [ ] **Step 3: Create `src/components/ConnectWalletButton.tsx`**

```tsx
import { Wallet } from 'lucide-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

export default function ConnectWalletButton() {
  const { setVisible } = useWalletModal();
  return (
    <button
      type="button"
      onClick={() => setVisible(true)}
      className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-kami-accent hover:bg-kami-accentHover text-white text-sm font-medium transition-colors"
    >
      <Wallet className="w-4 h-4" />
      Connect Wallet
    </button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/components/ConnectWalletButton.test.tsx`
Expected: 2 of 2 tests pass.

- [ ] **Step 5: Run full typecheck**

Run: `pnpm exec tsc -b`
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/ConnectWalletButton.tsx src/components/ConnectWalletButton.test.tsx
git commit -m "$(cat <<'EOF'
feat(chat): add ConnectWalletButton leaf component

Reusable inline button using useWalletModal().setVisible(true) — same
hook EmptyState already wires. Click opens the wallet picker modal.

2 unit tests cover render + click. Wallet-adapter-react-ui mocked at
module level (setVisible spied via vi.fn).

Will be rendered by ChatMessage in the next commit when any tool call
in the message has status 'wallet-required'.

Part of C-1 (wallet-not-connected UX cluster).
EOF
)"
```

---

## Task 6: Wire CTA — useChat plumb code + ChatMessage CTA + scoped tests

**Files:**
- Modify: `src/hooks/useChat.ts`
- Create: `src/hooks/useChat.test.ts`
- Modify: `src/components/ChatMessage.tsx` (CTA only — full cleanup in Task 7)
- Create: `src/components/ChatMessage.test.tsx`

This task lights up the visible feature: server code → useChat status → ChatMessage CTA.

- [ ] **Step 1: Write the failing useChat test**

Create `src/hooks/useChat.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

// Pure helper extracted from useChat's toolResult handler logic.
// Imported here so we can test the mapping without the full streaming machinery.
import { mapToolResultStatus } from './useChat';

describe('mapToolResultStatus', () => {
  it('returns "wallet-required" when output.code is WALLET_NOT_CONNECTED', () => {
    expect(mapToolResultStatus({ ok: false, error: 'x', code: 'WALLET_NOT_CONNECTED' }))
      .toBe('wallet-required');
  });

  it('returns "wallet-required" when output.code is INVALID_WALLET', () => {
    expect(mapToolResultStatus({ ok: false, error: 'x', code: 'INVALID_WALLET' }))
      .toBe('wallet-required');
  });

  it('returns "error" when output.ok is false without a code', () => {
    expect(mapToolResultStatus({ ok: false, error: 'rpc died' }))
      .toBe('error');
  });

  it('returns "error" when output.ok is false with a non-wallet code', () => {
    expect(mapToolResultStatus({ ok: false, error: 'x', code: 'STALE_ORACLE' }))
      .toBe('error');
  });

  it('returns "done" when output.ok is true', () => {
    expect(mapToolResultStatus({ ok: true, data: { foo: 1 } }))
      .toBe('done');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/hooks/useChat.test.ts`
Expected: FAIL with `mapToolResultStatus is not exported`.

- [ ] **Step 3: Edit `src/hooks/useChat.ts` — extract + export `mapToolResultStatus`**

Add this exported helper near the top of the file, immediately after the existing `BUILD_TOOL_NAMES` constant (around line 5):

```ts
type ToolStreamOutput =
  | { ok: true; data?: unknown }
  | { ok: false; error?: string; code?: string };

export function mapToolResultStatus(output: ToolStreamOutput | undefined): 'done' | 'error' | 'wallet-required' {
  if (!output) return 'done';
  if (output.ok === true) return 'done';
  if (output.code === 'WALLET_NOT_CONNECTED' || output.code === 'INVALID_WALLET') {
    return 'wallet-required';
  }
  return 'error';
}
```

- [ ] **Step 4: Edit `src/hooks/useChat.ts` — remove `parseTransactionBlock` + use the new mapper**

Find line 3:
```ts
import { parseTransactionBlock } from '../lib/parseTransaction';
```
DELETE this line. (`parseTransaction.ts` will be deleted in Task 7; ChatMessage will stop reading the legacy field there too.)

Find lines 172-176:
```ts
                if (parsed.text) {
                  accumulated += parsed.text;
                  const txn = parseTransactionBlock(accumulated);
                  commitToolCalls({ content: accumulated, transaction: txn });
                }
```
Replace with:
```ts
                if (parsed.text) {
                  accumulated += parsed.text;
                  commitToolCalls({ content: accumulated });
                }
```

Find lines 185-202 (the toolResult branch). Locate this part:
```ts
                if (parsed.toolResult) {
                  const existing = toolCalls.get(parsed.toolResult.id);
                  const output = parsed.toolResult.output;
                  toolCalls.set(parsed.toolResult.id, {
                    id: parsed.toolResult.id,
                    name: parsed.toolResult.name,
                    status: output?.ok === false ? 'error' : 'done',
                    error: output?.ok === false ? output.error : existing?.error,
                  });
```
Replace with:
```ts
                if (parsed.toolResult) {
                  const existing = toolCalls.get(parsed.toolResult.id);
                  const output = parsed.toolResult.output;
                  toolCalls.set(parsed.toolResult.id, {
                    id: parsed.toolResult.id,
                    name: parsed.toolResult.name,
                    status: mapToolResultStatus(output),
                    error: output?.ok === false ? output.error : existing?.error,
                    code: output?.ok === false ? output.code : existing?.code,
                  });
```

- [ ] **Step 5: Run useChat tests to verify they pass**

Run: `pnpm exec vitest run src/hooks/useChat.test.ts`
Expected: 5 of 5 tests pass.

- [ ] **Step 6: Write the failing ChatMessage test**

Create `src/components/ChatMessage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@solana/wallet-adapter-react-ui', () => ({
  useWalletModal: () => ({ setVisible: vi.fn() }),
}));

import ChatMessage from './ChatMessage';
import type { ChatMessage as ChatMessageType } from '../types';

const assistantMsg = (overrides: Partial<ChatMessageType>): ChatMessageType => ({
  id: 'm-1',
  role: 'assistant',
  content: 'Hi there.',
  timestamp: 0,
  ...overrides,
});

describe('ChatMessage', () => {
  it('renders the assistant content', () => {
    render(<ChatMessage message={assistantMsg({})} />);
    expect(screen.getByText('Hi there.')).toBeInTheDocument();
  });

  it('renders the inline Connect Wallet CTA when any tool call is wallet-required', () => {
    render(
      <ChatMessage
        message={assistantMsg({
          toolCalls: [
            { id: 'tc-1', name: 'getPortfolio', status: 'wallet-required' },
          ],
        })}
      />
    );
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
  });

  it('does not render the CTA when no tool call is wallet-required', () => {
    render(
      <ChatMessage
        message={assistantMsg({
          toolCalls: [{ id: 'tc-1', name: 'getPortfolio', status: 'done' }],
        })}
      />
    );
    expect(screen.queryByRole('button', { name: /connect wallet/i })).not.toBeInTheDocument();
  });

  it('does not render the CTA when toolCalls is undefined', () => {
    render(<ChatMessage message={assistantMsg({})} />);
    expect(screen.queryByRole('button', { name: /connect wallet/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run ChatMessage test to verify it fails**

Run: `pnpm exec vitest run src/components/ChatMessage.test.tsx`
Expected: at least 2 tests FAIL — the props expect no `walletConnected`, but the component currently requires it; the CTA isn't rendered yet.

- [ ] **Step 8: Edit `src/components/ChatMessage.tsx` — drop `walletConnected` prop + add CTA**

Replace the entire file content with:

```tsx
import React from 'react';
import type { ChatMessage as ChatMessageType } from '../types';
import { Markdown } from '../lib/markdown';
import SignTransactionCard from './SignTransactionCard';
import ToolCallBadges from './ToolCallBadges';
import ConnectWalletButton from './ConnectWalletButton';

interface Props {
  message: ChatMessageType;
}

export default function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end mb-4 animate-fade-in">
        <div className="max-w-[80%] lg:max-w-[60%] bg-kami-accent/20 border border-kami-accent/30 rounded-2xl rounded-br-md px-4 py-3">
          <p className="text-sm text-kami-text whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  const showConnectCta = message.toolCalls?.some((c) => c.status === 'wallet-required') ?? false;

  return (
    <div className="flex mb-4 animate-fade-in">
      <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-kami-accent to-purple-400 flex items-center justify-center text-white font-bold text-xs mr-3 mt-0.5">
        K
      </div>
      <div className="max-w-[80%] lg:max-w-[70%]">
        {message.toolCalls && message.toolCalls.length > 0 && (
          <ToolCallBadges calls={message.toolCalls} />
        )}
        <div className="text-sm space-y-1"><Markdown text={message.content} /></div>
        {message.pendingTransaction && (
          <SignTransactionCard transaction={message.pendingTransaction} />
        )}
        {showConnectCta && <ConnectWalletButton />}
      </div>
    </div>
  );
}
```

(Note: this drops `TransactionCard`, `stripTransactionBlock`, `walletConnected`, and the `transaction` rendering branch in one shot. The `transaction?` field on `ChatMessage` type is removed in Task 7; until then, the type still has it but the component doesn't read it — TS allows the field to be unused.)

- [ ] **Step 9: Edit `src/components/ChatPanel.tsx` — drop the `walletConnected` prop pass**

Find line 62:
```tsx
              <ChatMessageComponent key={msg.id} message={msg} walletConnected={connected} />
```
Replace with:
```tsx
              <ChatMessageComponent key={msg.id} message={msg} />
```

- [ ] **Step 10: Run all tests + full typecheck**

Run: `pnpm exec tsc -b && pnpm test:run`
Expected: zero TS errors; all tests pass (109+ baseline + Task 4's 5 + Task 5's 2 + Task 6's 5 + 4 new ChatMessage = 125+).

- [ ] **Step 11: Smoke-test the full flow (manual, optional but recommended)**

Run: `pnpm dev`
- Open `http://localhost:5173`
- Without connecting a wallet, click the "Show me my Kamino portfolio" suggestion chip
- Verify: yellow "Wallet required" pill (not red); LLM prose says to connect; inline "Connect Wallet" button appears below
- Click "Connect Wallet" → wallet modal opens

Stop the dev server when done.

- [ ] **Step 12: Commit**

```bash
git add src/hooks/useChat.ts src/hooks/useChat.test.ts src/components/ChatMessage.tsx src/components/ChatMessage.test.tsx src/components/ChatPanel.tsx
git commit -m "$(cat <<'EOF'
feat(chat): wire wallet-required flow end-to-end

useChat now extracts mapToolResultStatus (exported for testing) which
maps output.code → ToolCallRecord.status:
  - WALLET_NOT_CONNECTED / INVALID_WALLET → 'wallet-required'
  - other ok:false → 'error'
  - ok:true → 'done'

ChatMessage detects wallet-required in message.toolCalls and renders
<ConnectWalletButton /> below the markdown.

ChatPanel drops the now-unused walletConnected prop pass.

Also removes the parseTransactionBlock call from useChat. The legacy
TransactionIntent rendering branch is removed from ChatMessage. The
TransactionCard component itself + parseTransaction module are
deleted in the next commit.

9 new tests across mapToolResultStatus + ChatMessage CTA branches.

Closes U-11 (no inline Connect Wallet CTA after rejection) and
U-1 (red failed pill — wiring half).
Part of C-1 (wallet-not-connected UX cluster).
EOF
)"
```

---

## Task 7: Cleanup — delete legacy files + types + props

**Files:**
- Delete: `src/components/TransactionCard.tsx`
- Delete: `src/lib/parseTransaction.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Verify no imports reference the dead files**

Run:
```bash
grep -rn "TransactionCard\|parseTransactionBlock\|stripTransactionBlock\|TransactionIntent" src server api 2>/dev/null | grep -v ".test." | grep -v node_modules
```
Expected: only the file definitions themselves and the types.ts type. No live imports.

If any unexpected hits appear, STOP and triage before deleting.

- [ ] **Step 2: Delete the dead files**

```bash
git rm src/components/TransactionCard.tsx src/lib/parseTransaction.ts
```
Expected: both files removed; git stages the deletions.

- [ ] **Step 3: Edit `src/types.ts` — remove `TransactionIntent` + the `transaction?` field**

Find:
```ts
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  transaction?: TransactionIntent | null;
  pendingTransaction?: PendingTransaction | null;
  toolCalls?: ToolCallRecord[];
}
```
Replace with:
```ts
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  pendingTransaction?: PendingTransaction | null;
  toolCalls?: ToolCallRecord[];
}
```

Find and DELETE this entire block:
```ts
export interface TransactionIntent {
  type: 'transfer' | 'swap' | 'stake' | 'unstake' | 'custom';
  summary: string;
  details: {
    from?: string;
    to?: string;
    amount?: string;
    token?: string;
    tokenMint?: string;
    estimatedFee?: string;
    protocol?: string;
    slippage?: string;
  };
  raw?: Record<string, unknown>;
}
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm exec tsc -b`
Expected: zero errors.

- [ ] **Step 5: Run full test suite**

Run: `pnpm test:run`
Expected: all tests pass; no regressions.

- [ ] **Step 6: Verify the dead-code grep is clean**

```bash
grep -rn "TransactionCard\|parseTransactionBlock\|stripTransactionBlock\|TransactionIntent" src server api 2>/dev/null | grep -v node_modules
```
Expected: zero hits.

- [ ] **Step 7: Commit**

```bash
git add -A src/components/TransactionCard.tsx src/lib/parseTransaction.ts src/types.ts
git commit -m "$(cat <<'EOF'
chore(legacy): delete TransactionCard + parseTransaction + TransactionIntent

The legacy free-text transaction-rendering chain has had zero callers
since the LLM was forbidden from emitting raw \`\`\`transaction blocks
(server/prompt.ts:14) and PendingTransaction became the canonical
signing path.

Deleted:
  - src/components/TransactionCard.tsx (dead UI: button had no onClick)
  - src/lib/parseTransaction.ts (parseTransactionBlock + strip helper)
  - TransactionIntent interface (no remaining consumers)
  - transaction?: TransactionIntent | null field on ChatMessage

Closes D-7 (no-op TransactionCard button) and D-19 (fragile regex
anchors). Part of C-1 (wallet-not-connected UX cluster).
EOF
)"
```

---

## Task 8: Final verification + push

**Files:** none (CI / git only)

- [ ] **Step 1: Run full check**

Run: `pnpm exec tsc -b && pnpm test:run && pnpm build`
Expected: zero TS errors; all tests pass; build succeeds.

- [ ] **Step 2: Verify commit count + log**

Run: `git log --oneline main..HEAD`
Expected: 6 commits matching:
```
<sha> chore(legacy): delete TransactionCard + parseTransaction + TransactionIntent
<sha> feat(chat): wire wallet-required flow end-to-end
<sha> feat(chat): add ConnectWalletButton leaf component
<sha> feat(chat): add wallet-required status + yellow pill in ToolCallBadges
<sha> refactor(server): wire assertWallet into kamino.ts; drop "Phantom" copy
<sha> refactor(server): add assertWallet helper with structured error codes
<sha> refactor(types): add ToolErrorCode + optional code on ToolResult
```

(7 lines because the types-only commit lands first.)

- [ ] **Step 3: Push the feature branch**

Run: `git push -u origin feat/c1-wallet-not-connected-ux`
Expected: branch published; PR-creation hint URL printed.

- [ ] **Step 4: Open PR**

Run:
```bash
gh pr create --title "feat: C-1 wallet-not-connected UX cluster (closes D-1, D-7, D-22, U-1, U-11)" --body "$(cat <<'EOF'
## Summary
Closes the highest-leverage finding from the 2026-04-26 QA audit. The wallet-not-connected user journey was fractured across copy, code, and visual treatment — three separate codebase touchpoints that together made a normal expected state feel broken to first-time visitors.

This PR:
- Adds a typed `ToolErrorCode` discriminator (`WALLET_NOT_CONNECTED` / `INVALID_WALLET`) to `ToolResult`
- Extracts `assertWallet()` helper, dedupes 3 wallet-validation blocks, drops "Phantom" from tool error copy
- Renders a yellow "Wallet required" pill instead of red "failed" when no wallet is connected
- Adds an inline Connect Wallet CTA below the assistant's recovery message
- Deletes the dead `TransactionCard` + `parseTransactionBlock` chain (zero remaining callers since the LLM was forbidden from emitting raw transaction blocks)

## Findings closed
- D-1 (stale Phantom copy in 3 tool error strings)
- D-7 (TransactionCard button had no onClick)
- D-22 (3× duplicated wallet-validation try/catch + RENT_EXPLAINER drift)
- U-1 (red "failed" tool-call pill alarming fresh users)
- U-11 (no inline Connect Wallet CTA after LLM rejection)

Retires D-6 and D-19 by deletion of the legacy parser.

## Test plan
- [x] `pnpm exec tsc -b` clean
- [x] `pnpm test:run` — full suite passes (X new tests added)
- [x] `pnpm build` succeeds
- [x] Manual smoke: chat → ask "show me my portfolio" without wallet → yellow pill + inline Connect CTA → click → modal opens
- [x] Manual smoke: chat → ask "best USDC yield" (works without wallet) → green done pill (regression check, error-code path unchanged)

## Spec
`docs/superpowers/specs/2026-04-26-c1-wallet-not-connected-design.md`
EOF
)"
```
Expected: PR opened on GitHub with the URL returned. Note the PR number for the merge step.

- [ ] **Step 5: Wait for CI green**

Run: `gh pr checks --watch`
Expected: all checks pass (test.yml + mirror-gitlab.yml).

If any check fails: STOP, read the failure, fix on the branch, push, re-run this step. Do not skip.

---

## Definition of Done

- [ ] All 7 tasks complete (Task 0-7) plus final push (Task 8)
- [ ] 6 logical commits on `feat/c1-wallet-not-connected-ux` (or 7 if you split assertWallet helper from kamino refactor — either way ships clean)
- [ ] Zero "Phantom" references in `server/tools/kamino.ts`
- [ ] Zero references to `TransactionCard`, `parseTransactionBlock`, `stripTransactionBlock`, `TransactionIntent` outside of `node_modules` and the QA report
- [ ] At least 14 new tests landed (3 wallet + 5 ToolCallBadges + 2 ConnectWalletButton + 5 useChat + 4 ChatMessage = 19 minimum)
- [ ] CI green on the PR
- [ ] Manual smoke confirms yellow pill + inline CTA + modal-open click in browser

When DOD is met: leave the PR for user review/merge. Do NOT auto-merge unless the user explicitly approves.
