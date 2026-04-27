# C-3 Error-Visibility Cluster — Design

**Date:** 2026-04-27
**Author:** RECTOR + CIPHER (brainstorming session)
**Status:** Approved
**Sprint:** 1.1 (Chunk 1) — first sprint of the QA-backlog roadmap
**Roadmap:** `docs/superpowers/specs/2026-04-26-qa-backlog-roadmap-design.md`
**Branch:** `feat/c3-error-visibility`
**Source issues:** [#4 D-2](https://github.com/RECTOR-LABS/kami/issues/4), [#5 D-3](https://github.com/RECTOR-LABS/kami/issues/5), [#6 D-4](https://github.com/RECTOR-LABS/kami/issues/6)
**Umbrella:** [#3 QA-2026-04-26](https://github.com/RECTOR-LABS/kami/issues/3)

---

## Goal

Surface three classes of silent errors so users see real, actionable messages instead of raw JSON or ghost writes:

- **D-2** — Server preflight (`getBalance` + `simulateTransaction`) silently swallows RPC failures and returns `{ ok: true }`, removing the safety net for users about to sign a doomed mainnet transaction.
- **D-3** — Client `useChat` rethrows the entire JSON-stringified 4xx body as `"I encountered an error: {…}. Please try again."`, leaving rate-limited users staring at raw JSON with no idea they need to wait.
- **D-4** — `switchConversation` and `deleteConversation` don't call `abortRef.current?.abort()`. The previous request keeps streaming after navigation, and `commitToolCalls` keeps writing to the original `assistantMsg.id`, with a worst-case path that "un-deletes" a conversation the user just removed.

---

## Architecture

**Files touched:** 3 — no new files, no schema changes, no UI changes.

| File | Change | Lines |
|---|---|---|
| `server/tools/kamino.ts` | Two `console.error` lines at the existing catch sites (`getBalance` line 420, `simulateTransaction` line 441) | +2 |
| `src/hooks/useChat.ts` | (1) Export new `formatChatError` helper. (2) Replace 4xx throw block (lines 137-140). (3) Simplify `errorContent` template (line 238). (4) Add `abortRef.current?.abort()` to `switchConversation` (line 55) + `deleteConversation` when deleting active (line 68). | +35 / -8 |
| `src/hooks/useChat.test.ts` | +7 unit tests on `formatChatError` + 3 abort regression tests on the hook | +90 / -0 |

**Files intentionally untouched:**

- `src/types.ts` — no new `ToolErrorCode`. HTTP 4xx errors are a different conceptual layer than tool errors.
- `api/chat.ts` — response shapes already correct (already returns structured 429/413/400 bodies). The bug is on the client.
- `src/components/*` — errors continue to flow through the existing assistant-message rendering channel.

**Test count delta:** 117 → ~127 (+10).

---

## D-2: Preflight error logging

**File:** `server/tools/kamino.ts`

Two existing catch blocks currently silent:

```ts
// ~line 420 (getBalance catch):
} catch (err) {
  return { ok: true };
}

// ~line 441 (simulateTransaction catch):
} catch (err) {
  return { ok: true };
}
```

**Change** — add `console.error` before each `return { ok: true }`:

```ts
// Line 420:
} catch (err) {
  console.error('[preflight] getBalance threw — bypassing', err);
  return { ok: true };
}

// Line 441:
} catch (err) {
  console.error('[preflight] simulateTransaction threw — bypassing', err);
  return { ok: true };
}
```

**Rationale (why log-only, not warning channel or hard block):**
- QA report's language was "consider returning a soft warning" — explicitly optional.
- Keeps C-3 scope tight on *error visibility for already-existing errors that are silent* — no schema or UI churn.
- D-13 (Chunk 2 — oracle staleness) introduces the warning-channel pattern naturally with a full requirement spec; better to design it there.
- Fail-open behavior preserved (don't block legitimate transactions when RPC is flaky).

**Acceptance:**
- Both catch sites have `console.error` calls.
- Both still `return { ok: true }` (no behavior change).
- Vercel function logs surface the bypass.

**Tests:** None. Observability change only; RPC-mocking machinery for these specific helpers is out of C-3 scope.

---

## D-3: `formatChatError` helper + clean error rendering

**File:** `src/hooks/useChat.ts`

### Helper (new export, alongside `mapToolResultStatus`)

```ts
export function formatChatError(status: number, body: unknown): string {
  const obj = (body && typeof body === 'object') ? body as Record<string, unknown> : {};

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

### Replace lines 137-140 (the `if (!response.ok)` throw block)

```ts
// Before:
if (!response.ok) {
  const errText = await response.text();
  throw new Error(errText || `HTTP ${response.status}`);
}

// After:
if (!response.ok) {
  const text = await response.text();
  let body: unknown;
  try { body = JSON.parse(text); }
  catch { body = { error: text }; }
  throw new Error(formatChatError(response.status, body));
}
```

**Note:** read `response.text()` first then `JSON.parse(text)`, not `response.json()` then `response.text()` — the body can only be consumed once.

### Simplify line 238 (drop the verbose preamble)

```ts
// Before:
const errorContent = `I encountered an error: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`;

// After:
const errorContent = err instanceof Error ? err.message : 'Unknown error.';
```

### User-visible result

A rate-limited user previously saw:
> `I encountered an error: {"error":"Too many requests","limit":30,"remaining":0,"retryAfterSeconds":12}. Please try again.`

Now sees:
> `Rate limited — try again in 12s.`

**Acceptance:**
- `formatChatError` is exported from `useChat.ts` alongside `mapToolResultStatus`.
- The throw block in `sendMessage` calls `formatChatError(response.status, parsedBody)`.
- The `errorContent` template no longer wraps with the verbose preamble.
- All existing 117 tests still pass.

---

## D-4: Abort plumbing on switch + delete

**File:** `src/hooks/useChat.ts`

### `switchConversation` (line 54) — always abort

```ts
// Before:
const switchConversation = useCallback((id: string) => {
  setActiveId(id);
  setActiveConversationId(id);
}, []);

// After:
const switchConversation = useCallback((id: string) => {
  abortRef.current?.abort();
  setActiveId(id);
  setActiveConversationId(id);
}, []);
```

Rationale: navigating away from the active stream means the user has stopped caring about it; cancel it. Aborting is idempotent — safe to call when no stream is active.

### `deleteConversation` (line 67) — abort only when deleting the *active* conversation

```ts
// Before:
const deleteConversation = useCallback(
  (id: string) => {
    const remaining = conversations.filter((c) => c.id !== id);
    // ...
  },
  [conversations, activeId, persist, switchConversation]
);

// After:
const deleteConversation = useCallback(
  (id: string) => {
    if (id === activeId) {
      abortRef.current?.abort();
    }
    const remaining = conversations.filter((c) => c.id !== id);
    // ...rest unchanged
  },
  [conversations, activeId, persist, switchConversation]
);
```

Rationale: the asymmetry is intentional. `switchConversation` always aborts because the user is navigating away from the stream. `deleteConversation` only aborts when the user is removing the conversation that's actively streaming — deleting a non-active sidebar entry shouldn't disturb the active stream.

### Race window note (intentionally not handled)

The QA report's alternative fix was to "guard the final `saveConversations(current)` on `current.find(c => c.id === activeId)` still existing". The local `current` closure variable cannot see external state changes (deletion happens through `setConversations`, not `current`), so this guard does not actually defend against the race it's meant to catch.

The remaining microscopic race — stream's last frame arrives in the same microsecond as the abort signal — would write a stale snapshot. User clicks delete again; gone. Acceptable for C-3 scope; can be revisited if observed in production.

### Acceptance

- `switchConversation` calls `abortRef.current?.abort()` as its first statement.
- `deleteConversation` calls `abortRef.current?.abort()` only when `id === activeId`.
- AbortError is already handled at line 237 (silent return) — no new branch needed there.
- All existing 117 tests still pass.

---

## Test Plan — `src/hooks/useChat.test.ts`

Existing 5 tests on `mapToolResultStatus` are untouched.

### Section A — `formatChatError` unit tests (×7, pure function, no fixtures)

| # | Input | Expected output |
|---|---|---|
| A1 | `(429, { error: 'Too many requests', retryAfterSeconds: 12 })` | `'Rate limited — try again in 12s.'` |
| A2 | `(429, { error: 'Too many requests' })` (no `retryAfterSeconds`) | `'Rate limited — please slow down and try again shortly.'` |
| A3 | `(413, { error: 'Body exceeds 262144 bytes' })` | `'Message too large — try shortening or starting a new conversation.'` |
| A4 | `(400, { error: 'Invalid request body', issues: [{ path: 'messages', message: 'messages array is required' }] })` | `'Invalid request: messages array is required.'` |
| A5 | `(400, { error: 'Invalid JSON body' })` | `'Request format error — please refresh and try again.'` |
| A6 | `(400, { error: 'unexpected' })` (no `issues`, not the `'Invalid JSON body'` sentinel) | `'Invalid request — please check your message format.'` |
| A7 | `(502, undefined)` (server crash with no body) | `'Server error — HTTP 502.'` |

### Section B — Abort regression tests (×3, `renderHook` + fetch stub)

Setup pattern (each test):
1. `localStorage.clear()` (or pre-populated for B3)
2. Stub `global.fetch` with `vi.fn((_url, init) => { capturedSignal = init?.signal; return new Promise(() => {}); })` — returns a never-resolving Promise so the hook stays in streaming state.
3. `renderHook(() => useChat())`
4. `await act(async () => { result.current.sendMessage('hello'); })`
5. `await waitFor(() => expect(global.fetch).toHaveBeenCalled())`
6. Trigger the action under test inside `act(...)`.
7. Assert on `capturedSignal.aborted`.

| # | Setup (steps 1-2 above plus...) | Action | Assertion |
|---|---|---|---|
| B1 | Fresh localStorage; one auto-created conversation | `result.current.newConversation()` (which calls `switchConversation` internally) | `capturedSignal?.aborted === true` |
| B2 | Fresh localStorage; one auto-created conversation | `result.current.deleteConversation(activeId)` on the active conv | `capturedSignal?.aborted === true` |
| B3 | Pre-populated 2 convs in `localStorage` (`kami_conversations`, `kami_active_conversation` set to conv #2) | `result.current.deleteConversation(otherId)` on the *non-active* conv | `capturedSignal?.aborted === false` (asymmetry holds) |

### Coverage

Per CLAUDE.md: ≥80% on new code. `formatChatError` is fully branched by A1-A7. Abort branches are exercised by B1-B3.

---

## Commit Plan

3 commits, one per finding, on `feat/c3-error-visibility`:

```
1. feat(server): log preflight RPC errors before fail-open
   server/tools/kamino.ts (+2)
   Closes #4

2. feat(chat): format 4xx server errors with retry hints in useChat
   src/hooks/useChat.ts (+formatChatError export, replace throw block, simplify errorContent)
   src/hooks/useChat.test.ts (+7 unit tests for formatChatError)
   Closes #5

3. fix(chat): abort in-flight stream on conversation switch/delete
   src/hooks/useChat.ts (abort calls in switchConversation + deleteConversation)
   src/hooks/useChat.test.ts (+3 abort regression tests)
   Closes #6
```

**Per-commit verification (before each `git commit`):**

```bash
pnpm exec tsc -b && pnpm test:run
```

All tests must pass (117 baseline + new tests for that commit).

---

## PR Plan

- **Branch:** `feat/c3-error-visibility` (already created off `main` at `a74d30f`)
- **Title:** `feat(chat): C-3 error-visibility cluster (D-2 + D-3 + D-4)`
- **Body:**
  - Closes #4 #5 #6, links to umbrella #3
  - Brief summary of each finding
  - Manual smoke checklist (unchecked at PR creation; only check after Chrome MCP verifies post-merge)
- **Manual smoke (Chrome MCP after merge → kami.rectorspace.com):**
  - [ ] Trigger 429 by spamming requests → see `Rate limited — try again in {N}s.` clean message in chat bubble (no raw JSON)
  - [ ] Send a message, click "New Chat" mid-stream → assistant bubble freezes; new conversation opens; switching back shows the partial response untouched (no ghost writes)
  - [ ] Send a message, click trash icon on the active conversation mid-stream → conv removed from sidebar, no resurrect on next render
- **Merge:** `gh pr merge N --merge` (keep branch — global preference)
- **Post-merge:**
  - Tick #4, #5, #6 in umbrella issue [#3](https://github.com/RECTOR-LABS/kami/issues/3) checkbox list
  - Vercel auto-deploys to https://kami.rectorspace.com
  - Run Chrome MCP smoke sequence above

---

## Out of Scope for C-3

- **D-12 (AbortSignal propagation to server)** — Chunk 2, depends on this sprint's client-side abort plumbing being merged first.
- **D-11 (full `useChat.test.ts` expansion)** — Chunk 2, will extend Section A/B above to cover streaming happy-path + edge cases beyond regression seeds.
- **Soft preflight warning channel** — D-13 in Chunk 2 will introduce this for oracle-staleness; same channel can later be retrofit for D-2 if observed errors warrant it.
- **Toast notifications / inline error pills for 4xx** — current pattern (assistant-message content) is preserved; UI polish could be a future U-* finding if friction surfaces.

---

## Sanity Checks

- ✓ All 3 P0 issues (#4, #5, #6) closed by this sprint
- ✓ +10 tests, all 117 existing pass
- ✓ No schema changes (`types.ts` untouched)
- ✓ 3 commits, clean grep-history per finding
- ✓ Matches Sprint 1.1 row in roadmap (Full ceremony, 4-6h estimate)
- ✓ Dependencies for Chunk 2 (D-11, D-12) unblocked once this merges
