# C-3 Error-Visibility Cluster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the C-3 error-visibility cluster (D-2 + D-3 + D-4): make silent server preflight RPC errors observable, format 4xx server errors with retry hints in `useChat`, and abort in-flight streams when the user switches or deletes the active conversation.

**Architecture:** Three changes in two production files (`server/tools/kamino.ts`, `src/hooks/useChat.ts`) plus expansion of one test file (`src/hooks/useChat.test.ts`). No schema changes, no new files, no UI changes. The new `formatChatError` helper is exported from `useChat.ts` alongside the existing `mapToolResultStatus` (C-1 precedent). HTTP 4xx errors continue to flow through the existing assistant-message rendering channel — no new error UX surface.

**Tech Stack:** TypeScript, React 18, Vite, Vitest 4, `@testing-library/react` 16 (`renderHook` + `act` + `waitFor`), happy-dom test environment, `vi.fn()` for fetch stubbing.

**Branch:** `feat/c3-error-visibility` (already created off `main` at `a74d30f`)
**Spec:** `docs/superpowers/specs/2026-04-27-c3-error-visibility-design.md`

---

## File Structure

| File | Responsibility | Status |
|---|---|---|
| `server/tools/kamino.ts` | Add `console.error` at the two existing catch sites in `preflightSimulate` (RPC observability) | Modify |
| `src/hooks/useChat.ts` | Export `formatChatError(status, body)` helper. Replace 4xx throw block. Simplify `errorContent` template. Add abort calls in `switchConversation` + `deleteConversation` | Modify |
| `src/hooks/useChat.test.ts` | Add 7 unit tests for `formatChatError` and 3 abort-behavior regression tests on `useChat` | Modify |

**Files explicitly NOT touched:** `src/types.ts`, `api/chat.ts`, all `src/components/*`. The C-1 type system and the api handler are already correct; the bug surface is entirely in the client hook + the server preflight helper.

**Test count:** 117 (baseline) → 127 (+10).

---

## Task 1 — D-2: Log preflight RPC errors before fail-open

**Closes:** [#4](https://github.com/RECTOR-LABS/kami/issues/4)

**Files:**
- Modify: `server/tools/kamino.ts:420` and `server/tools/kamino.ts:441`

This is a pure observability change — no behavior change, no tests added. Verification is just "all 117 existing tests still pass".

- [ ] **Step 1: Verify baseline is green**

```bash
git status                    # On branch feat/c3-error-visibility, clean
pnpm exec tsc -b && pnpm test:run
```

Expected: 117/117 tests pass, zero typecheck errors.

- [ ] **Step 2: Add `console.error` to the `getBalance` catch (line 420)**

In `server/tools/kamino.ts`, locate the `preflightSimulate` function. The first catch block (around line 420) currently reads:

```ts
  let balanceLamports: bigint;
  try {
    const balResp = await rpc.getBalance(feePayer).send();
    balanceLamports = balResp.value;
  } catch (err) {
    return { ok: true };
  }
```

Change to:

```ts
  let balanceLamports: bigint;
  try {
    const balResp = await rpc.getBalance(feePayer).send();
    balanceLamports = balResp.value;
  } catch (err) {
    console.error('[preflight] getBalance threw — bypassing', err);
    return { ok: true };
  }
```

- [ ] **Step 3: Add `console.error` to the `simulateTransaction` catch (line 441)**

Still in `preflightSimulate`. The second catch block (around line 441) currently reads:

```ts
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
    return { ok: true };
  }
```

Change to:

```ts
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
```

- [ ] **Step 4: Verify nothing broke**

```bash
pnpm exec tsc -b && pnpm test:run
```

Expected: 117/117 tests still pass, zero typecheck errors.

- [ ] **Step 5: Commit**

```bash
git add server/tools/kamino.ts
git commit -m "$(cat <<'EOF'
feat(server): log preflight RPC errors before fail-open

Both getBalance and simulateTransaction catches inside preflightSimulate
silently returned { ok: true } on RPC failure, removing the safety net
for users about to sign a doomed mainnet transaction. Add console.error
so Vercel function logs surface the bypass; preserve fail-open behavior.

Closes #4
EOF
)"
```

Expected output: 1 file changed, 2 insertions(+).

---

## Task 2 — D-3: `formatChatError` helper + clean error rendering

**Closes:** [#5](https://github.com/RECTOR-LABS/kami/issues/5)

**Files:**
- Modify: `src/hooks/useChat.ts` (add export, replace throw block at lines 137-140, simplify errorContent at line 238)
- Modify: `src/hooks/useChat.test.ts` (add 7 unit tests)

- [ ] **Step 1: Write the 7 failing unit tests for `formatChatError`**

Open `src/hooks/useChat.test.ts`. The current file imports only `mapToolResultStatus` and tests it. Update the import line and append a new `describe` block.

Replace line 5 (`import { mapToolResultStatus } from './useChat';`) with:

```ts
import { formatChatError, mapToolResultStatus } from './useChat';
```

Append at the end of the file (after the existing `describe('mapToolResultStatus', ...)` block):

```ts
describe('formatChatError', () => {
  it('returns "Rate limited — try again in {N}s." for 429 with retryAfterSeconds', () => {
    expect(formatChatError(429, { error: 'Too many requests', retryAfterSeconds: 12 }))
      .toBe('Rate limited — try again in 12s.');
  });

  it('returns generic rate-limit message for 429 without retryAfterSeconds', () => {
    expect(formatChatError(429, { error: 'Too many requests' }))
      .toBe('Rate limited — please slow down and try again shortly.');
  });

  it('returns "Message too large…" for 413', () => {
    expect(formatChatError(413, { error: 'Body exceeds 262144 bytes' }))
      .toBe('Message too large — try shortening or starting a new conversation.');
  });

  it('extracts first issue message for 400 zod validation', () => {
    expect(
      formatChatError(400, {
        error: 'Invalid request body',
        issues: [{ path: 'messages', message: 'messages array is required' }],
      })
    ).toBe('Invalid request: messages array is required.');
  });

  it('returns refresh-and-retry hint for 400 with "Invalid JSON body"', () => {
    expect(formatChatError(400, { error: 'Invalid JSON body' }))
      .toBe('Request format error — please refresh and try again.');
  });

  it('returns generic 400 fallback when shape is unknown', () => {
    expect(formatChatError(400, { error: 'unexpected' }))
      .toBe('Invalid request — please check your message format.');
  });

  it('returns "Server error — HTTP {status}." for unknown status without body.error', () => {
    expect(formatChatError(502, undefined))
      .toBe('Server error — HTTP 502.');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test:run
```

Expected: All 7 new tests fail with TypeScript / module errors like `formatChatError is not exported from './useChat'`. Existing 5 `mapToolResultStatus` tests still pass.

- [ ] **Step 3: Add `formatChatError` export to `useChat.ts`**

Open `src/hooks/useChat.ts`. The file currently exports `mapToolResultStatus` between two import blocks (lines 6-17). Insert the new helper right after the existing `mapToolResultStatus` function and before the second import block.

Find this block in `src/hooks/useChat.ts`:

```ts
export function mapToolResultStatus(output: ToolStreamOutput | undefined): 'done' | 'error' | 'wallet-required' {
  if (!output) return 'done';
  if (output.ok === true) return 'done';
  if (output.code === 'WALLET_NOT_CONNECTED' || output.code === 'INVALID_WALLET') {
    return 'wallet-required';
  }
  return 'error';
}
import {
  loadConversations,
  saveConversations,
  createConversation,
  getActiveConversationId,
  setActiveConversationId,
} from '../lib/storage';
```

Insert this new function immediately after `mapToolResultStatus` (before the `import` line):

```ts
export function formatChatError(status: number, body: unknown): string {
  const obj = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};

  if (status === 429) {
    const retry = typeof obj.retryAfterSeconds === 'number' ? obj.retryAfterSeconds : null;
    return retry !== null
      ? `Rate limited — try again in ${retry}s.`
      : 'Rate limited — please slow down and try again shortly.';
  }

  if (status === 413) {
    return 'Message too large — try shortening or starting a new conversation.';
  }

  if (status === 400) {
    if (Array.isArray(obj.issues) && obj.issues.length > 0) {
      const first = obj.issues[0] as { message?: string };
      const message = typeof first?.message === 'string' ? first.message : 'request format invalid';
      return `Invalid request: ${message}.`;
    }
    if (typeof obj.error === 'string' && obj.error === 'Invalid JSON body') {
      return 'Request format error — please refresh and try again.';
    }
    return 'Invalid request — please check your message format.';
  }

  const fallback = typeof obj.error === 'string' ? obj.error : `HTTP ${status}`;
  return `Server error — ${fallback}.`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test:run
```

Expected: All 12 useChat tests pass (5 existing `mapToolResultStatus` + 7 new `formatChatError`). Total file count: 124 tests passing.

- [ ] **Step 5: Replace the 4xx throw block in `sendMessage` (line 137-140)**

Still in `src/hooks/useChat.ts`. Find this block inside `sendMessage`:

```ts
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(errText || `HTTP ${response.status}`);
        }
```

Replace with:

```ts
        if (!response.ok) {
          const text = await response.text();
          let body: unknown;
          try {
            body = JSON.parse(text);
          } catch {
            body = { error: text };
          }
          throw new Error(formatChatError(response.status, body));
        }
```

(Note: read `response.text()` first then `JSON.parse(text)`, not `response.json()` then `response.text()` — the body can only be consumed once.)

- [ ] **Step 6: Simplify the `errorContent` template (line 238)**

Still in `src/hooks/useChat.ts`. Find this line inside the catch block of `sendMessage`:

```ts
        const errorContent = `I encountered an error: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`;
```

Replace with:

```ts
        const errorContent = err instanceof Error ? err.message : 'Unknown error.';
```

This drops the verbose preamble. The user now sees the formatted message directly (e.g., `"Rate limited — try again in 12s."` instead of `"I encountered an error: Rate limited — try again in 12s.. Please try again."`).

- [ ] **Step 7: Verify all tests + typecheck pass**

```bash
pnpm exec tsc -b && pnpm test:run
```

Expected: 124/124 tests pass, zero typecheck errors.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useChat.ts src/hooks/useChat.test.ts
git commit -m "$(cat <<'EOF'
feat(chat): format 4xx server errors with retry hints in useChat

The 429/413/400 response bodies returned by api/chat.ts (with structured
fields like retryAfterSeconds and zod issues[]) were being thrown raw as
the assistant message content, so a rate-limited user saw raw JSON in
their chat bubble. Add a formatChatError helper alongside
mapToolResultStatus that branches on status code and produces a clean,
human message. Drop the verbose "I encountered an error: … Please try
again." wrapper since the formatted message is now self-contained.

Closes #5
EOF
)"
```

Expected output: 2 files changed.

---

## Task 3 — D-4: Abort in-flight stream on conversation switch/delete

**Closes:** [#6](https://github.com/RECTOR-LABS/kami/issues/6)

**Files:**
- Modify: `src/hooks/useChat.ts` (abort calls in `switchConversation` line 54 + `deleteConversation` line 67)
- Modify: `src/hooks/useChat.test.ts` (add 3 abort regression tests)

- [ ] **Step 1: Write the 3 failing abort regression tests**

Open `src/hooks/useChat.test.ts`. Update the imports at the top of the file. Replace the current import lines (lines 1-5):

```ts
import { describe, it, expect } from 'vitest';

// Pure helper extracted from useChat's toolResult handler logic.
// Imported here so we can test the mapping without the full streaming machinery.
import { formatChatError, mapToolResultStatus } from './useChat';
```

with:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { formatChatError, mapToolResultStatus, useChat } from './useChat';
```

Then append at the end of the file (after the `describe('formatChatError', ...)` block from Task 2):

```ts
describe('useChat abort behavior', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('aborts in-flight stream when newConversation is called (switchConversation path)', async () => {
    let capturedSignal: AbortSignal | undefined;
    global.fetch = vi.fn((_url: unknown, init: unknown) => {
      capturedSignal = (init as RequestInit | undefined)?.signal ?? undefined;
      return new Promise(() => {}); // never resolves — keeps stream open
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useChat());

    await act(async () => {
      result.current.sendMessage('hello');
    });

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(capturedSignal?.aborted).toBe(false);

    act(() => {
      result.current.newConversation();
    });

    expect(capturedSignal?.aborted).toBe(true);
  });

  it('aborts in-flight stream when deleteConversation is called on the active conversation', async () => {
    let capturedSignal: AbortSignal | undefined;
    global.fetch = vi.fn((_url: unknown, init: unknown) => {
      capturedSignal = (init as RequestInit | undefined)?.signal ?? undefined;
      return new Promise(() => {});
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useChat());
    const activeId = result.current.activeId;

    await act(async () => {
      result.current.sendMessage('hello');
    });
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    act(() => {
      result.current.deleteConversation(activeId);
    });

    expect(capturedSignal?.aborted).toBe(true);
  });

  it('does not abort in-flight stream when deleteConversation deletes a non-active conversation', async () => {
    const conv1 = { id: 'c1', title: 'one', messages: [], createdAt: 1, updatedAt: 1 };
    const conv2 = { id: 'c2', title: 'two', messages: [], createdAt: 2, updatedAt: 2 };
    localStorage.setItem('kami_conversations', JSON.stringify([conv1, conv2]));
    localStorage.setItem('kami_active_conversation', 'c2');

    let capturedSignal: AbortSignal | undefined;
    global.fetch = vi.fn((_url: unknown, init: unknown) => {
      capturedSignal = (init as RequestInit | undefined)?.signal ?? undefined;
      return new Promise(() => {});
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useChat());
    expect(result.current.activeId).toBe('c2');

    await act(async () => {
      result.current.sendMessage('hello');
    });
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    act(() => {
      result.current.deleteConversation('c1');
    });

    expect(capturedSignal?.aborted).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test:run
```

Expected: tests B1 (`newConversation` path) and B2 (`deleteConversation` of active) fail because `capturedSignal?.aborted` is `false` after the action — the abort calls don't exist yet. Test B3 (`deleteConversation` of non-active) PASSES because the current code doesn't abort either way (so the assertion `aborted === false` is satisfied for the wrong reason). That's fine — B3 documents the asymmetry that Task 3 must preserve.

- [ ] **Step 3: Add abort to `switchConversation` (line 54)**

Open `src/hooks/useChat.ts`. Find this block:

```ts
  const switchConversation = useCallback((id: string) => {
    setActiveId(id);
    setActiveConversationId(id);
  }, []);
```

Replace with:

```ts
  const switchConversation = useCallback((id: string) => {
    abortRef.current?.abort();
    setActiveId(id);
    setActiveConversationId(id);
  }, []);
```

- [ ] **Step 4: Add asymmetric abort to `deleteConversation` (line 67)**

Still in `src/hooks/useChat.ts`. Find this block:

```ts
  const deleteConversation = useCallback(
    (id: string) => {
      const remaining = conversations.filter((c) => c.id !== id);
      if (remaining.length === 0) {
        const fresh = createConversation();
        persist([fresh]);
        switchConversation(fresh.id);
      } else {
        persist(remaining);
        if (activeId === id) {
          switchConversation(remaining[0].id);
        }
      }
    },
    [conversations, activeId, persist, switchConversation]
  );
```

Replace with:

```ts
  const deleteConversation = useCallback(
    (id: string) => {
      if (id === activeId) {
        abortRef.current?.abort();
      }
      const remaining = conversations.filter((c) => c.id !== id);
      if (remaining.length === 0) {
        const fresh = createConversation();
        persist([fresh]);
        switchConversation(fresh.id);
      } else {
        persist(remaining);
        if (activeId === id) {
          switchConversation(remaining[0].id);
        }
      }
    },
    [conversations, activeId, persist, switchConversation]
  );
```

The asymmetry is intentional: `switchConversation` always aborts (user navigating away); `deleteConversation` only aborts when removing the active conv (deleting a non-active sidebar entry shouldn't disturb the active stream). Test B3 enforces this asymmetry.

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm test:run
```

Expected: all 15 useChat tests pass (5 `mapToolResultStatus` + 7 `formatChatError` + 3 abort).

- [ ] **Step 6: Run full typecheck + test suite**

```bash
pnpm exec tsc -b && pnpm test:run
```

Expected: 127/127 tests pass across the whole repo, zero typecheck errors.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useChat.ts src/hooks/useChat.test.ts
git commit -m "$(cat <<'EOF'
fix(chat): abort in-flight stream on conversation switch/delete

switchConversation and deleteConversation changed the active id without
calling abortRef.current?.abort(), so the previous request kept streaming
and commitToolCalls kept writing to the original assistantMsg.id. In the
worst case, deleting a streaming conversation could un-delete it via the
final saveConversations write with a stale snapshot. Wire abort into
both callbacks; deleteConversation aborts only when the deleted id is
the active one (deleting a non-active sidebar entry should not disturb
the active stream). The existing AbortError handler at the catch site
already returns silently on abort.

Closes #6
EOF
)"
```

Expected output: 2 files changed.

---

## Final Verification

After all 3 tasks are complete:

- [ ] **Verify branch state**

```bash
git log --oneline main..HEAD
```

Expected: 4 commits (the spec commit `7a9d395` + the 3 implementation commits in order).

- [ ] **Verify CI signals locally**

```bash
pnpm exec tsc -b && pnpm test:run && pnpm build
```

Expected: zero errors, 127/127 tests pass, build succeeds.

- [ ] **Push and open PR**

```bash
git push -u origin feat/c3-error-visibility
gh pr create --title "feat(chat): C-3 error-visibility cluster (D-2 + D-3 + D-4)" --body "$(cat <<'EOF'
## Summary

First sprint of the QA-backlog roadmap (chunk 1, sprint 1.1).

Closes #4 #5 #6 (P0 issues from the [QA-2026-04-26 baseline](https://github.com/RECTOR-LABS/kami/issues/3)).

- **D-2** — `server/tools/kamino.ts`: `console.error` at the two silent catch sites in `preflightSimulate` so RPC failures show up in Vercel function logs (was returning `{ ok: true }` silently, removing the safety net for users about to sign).
- **D-3** — `src/hooks/useChat.ts`: new exported `formatChatError(status, body)` helper. Branches on 429 / 413 / 400-zod / 400-other / 5xx and produces a clean human message. Drop the verbose `"I encountered an error: … Please try again."` wrapper since the formatted message is self-contained. Rate-limited users now see `"Rate limited — try again in 12s."` instead of raw JSON.
- **D-4** — `src/hooks/useChat.ts`: `abortRef.current?.abort()` in `switchConversation` (always) and `deleteConversation` (only when deleting the active conv — asymmetric to leave non-active deletions undisturbed).

## Spec
`docs/superpowers/specs/2026-04-27-c3-error-visibility-design.md`

## Tests
- `+7` unit tests for `formatChatError`
- `+3` abort regression tests using `renderHook` + fetch stub
- 117 → 127 total

## Manual smoke (Chrome MCP after merge)

- [ ] Trigger 429 by spamming requests → see `Rate limited — try again in {N}s.` clean message in chat bubble (no raw JSON)
- [ ] Send a message, click "New Chat" mid-stream → assistant bubble freezes; new conversation opens; switching back shows the partial response untouched (no ghost writes)
- [ ] Send a message, click trash icon on the active conversation mid-stream → conv removed from sidebar, no resurrect on next render

## Roadmap context
This is sprint 1.1 of 16 in the [QA-backlog roadmap](https://github.com/RECTOR-LABS/kami/blob/main/docs/superpowers/specs/2026-04-26-qa-backlog-roadmap-design.md). Chunk 2 (D-12, D-11, D-13) depends on this merging first.
EOF
)"
```

- [ ] **After PR merges**

```bash
# Tick the matching checkboxes in umbrella issue #3
gh issue view 3 --json body --jq .body  # inspect current body, then update with --body
```

Manually edit umbrella issue #3 to check `#4`, `#5`, `#6` in its checkbox list.

Run the Chrome MCP manual smoke checklist above, then mark the PR's smoke checkboxes.

---

## Spec-Coverage Self-Review (post-write check)

Cross-check this plan against `docs/superpowers/specs/2026-04-27-c3-error-visibility-design.md`:

- ✓ D-2 (server log) — Task 1
- ✓ D-3 helper code — Task 2 Step 3 (matches spec §D-3 verbatim)
- ✓ D-3 throw block replacement — Task 2 Step 5
- ✓ D-3 errorContent simplification — Task 2 Step 6
- ✓ D-4 switchConversation abort — Task 3 Step 3
- ✓ D-4 deleteConversation asymmetric abort — Task 3 Step 4
- ✓ Test plan A1-A7 (formatChatError) — Task 2 Step 1 (7 tests)
- ✓ Test plan B1-B3 (abort regressions) — Task 3 Step 1 (3 tests)
- ✓ 3-commit plan — one commit per task
- ✓ PR title + body + smoke checklist — Final Verification step
- ✓ No new files, no schema changes — confirmed in File Structure
- ✓ Branch `feat/c3-error-visibility` — already created at top of plan

No gaps. No placeholders. Method signatures consistent (`formatChatError(status: number, body: unknown): string`, abort calls use `abortRef.current?.abort()` everywhere). Plan is ready for execution.
