# Sprint 4.2b — P2 UI features: chat-shell polish during latency and lifecycle gaps

**Date:** 2026-04-28
**Issues:**
- [#23 — U-6 Sidebar bulk-clear + per-chat rename](https://github.com/RECTOR-LABS/kami/issues/23)
- [#24 — U-8 Streaming "thinking" indicator (3 pulsing dots before first token)](https://github.com/RECTOR-LABS/kami/issues/24)

**Priority:** P2 (`qa-2026-04-26`)
**Sprint:** 4.2b (priority-based cluster — P2 UI-features sub-cluster, 2 of 9 P2 items; server-hygiene sub-cluster #16-#22 shipped in 4.2a / PR #38)
**Estimate:** ~3-6h walltime; per-item range 1-4h
**Branch:** `feat/p2-ui-features`

---

## Problem

Two chat-shell ergonomics issues survived earlier sprints. Both are visible during ordinary use; neither blocks core flow but both degrade the demo-quality bar. Sprint 4.2b clears the remaining P2 row in the QA backlog and lands UI improvements that directly improve Phase D demo quality (post-deploy verification will produce fresher screenshots / video).

**#24 (U-8) — Dual K-avatar layout during the time-to-first-token gap.** Verified live on `kami.rectorspace.com` via Chrome MCP: after the user submits a query, two K avatars stack vertically during the ~1-2 s gap before the first text-delta arrives. The top one is the empty assistant message's avatar (no content beside it because `message.content === ''`); the bottom one is the separate `<TypingIndicator />` rendered in `ChatPanel.tsx:64` (its own K avatar + 3 pulsing dots). Once the first text-delta arrives, the typing indicator hides and the empty bubble fills with streaming content — but during the gap the user sees a confused "two avatars, one with dots, one empty" state that the QA report described as "frozen looking."

The wiring is technically correct (`showTyping = isStreaming && lastMsg?.role === 'assistant' && lastMsg.content === ''` triggers exactly when intended) — but the layout result is wrong because both the empty `<ChatMessage />` and the `<TypingIndicator />` render their OWN K avatar.

**#23 (U-6) — Sidebar fills up over days; no rename, no bulk-clear.** Today's sidebar (`src/components/Sidebar.tsx:71-110`) shows each conversation with a hover-revealed trash icon for individual deletion. Three gaps:

1. No way to rename a chat — titles are auto-generated from the first 40 characters of the user's first message ("Deposit 5 USDC into Kami…", "Show me my Kamino portfolio…"), which become unintelligible once the user has a dozen of them.
2. No "clear all" — the user must individually trash each conversation, which becomes tedious at scale.
3. The sidebar header (line 40-56) currently has only the K logo and a mobile-only close button — no surface for sidebar-scoped affordances.

## Scope

**In scope:**

- **#24 (commit 1):** In `src/components/ChatMessage.tsx` (assistant branch), when `message.content === ''` AND there are no tool calls AND no pending transaction AND no wallet-required CTA, render the 3 pulsing dots inline — replacing the empty `<Markdown text="" />` block — using the existing `pulse-dot` CSS keyframe from `src/index.css:79-84`. In `src/components/ChatPanel.tsx`, delete the `showTyping` calculation and the `<TypingIndicator />` JSX. Delete `src/components/TypingIndicator.tsx` (no longer needed). Single K avatar throughout the gap; first token replaces the dots inline within the same bubble. Add tests for the empty-content dots-render branch.
- **#23 (commit 2 — bulk-clear):** Add a settings gear icon to the sidebar header (next to the existing K logo / close-X area) that opens a small popover menu with one item: "Clear all conversations". Click → native `confirm()` dialog ("Clear all conversations? This cannot be undone.") → on confirm, call a new `clearAllConversations()` from `useChat.ts` that wipes the conversation array and creates one fresh empty conversation (matching the existing post-delete invariant at `useChat.ts:106-110`). Add tests for the hook method.
- **#23 (commit 3 — rename):** Add a hover-revealed pencil icon alongside the existing trash icon on each sidebar row. Click → inline `contenteditable` (or controlled `<input>`) edit on the chat title. Enter commits; Escape cancels; blur commits. Calls a new `renameConversation(id, title)` from `useChat.ts` that updates the conversation's `title` field. Empty-string titles are rejected (silent no-op or restored to previous title). Add tests for the hook method.

**Out of scope** (explicitly deferred):

- **Empty-assistant-message-persistence on abort.** Discovered during Chrome MCP verification — when the user aborts a stream (via the in-input stop button) or switches conversations before the first text-delta arrives, the empty assistant message stays in the conversation array forever. Old chats accumulate orphan K avatars. NOT bundled into 4.2b — needs its own brainstorm to decide whether to delete the empty message on abort or keep it as a "stream interrupted" placeholder. Will file a new GitHub issue at PR open time.
- **Custom modal for "Clear all" confirmation.** Native `confirm()` is the smallest correct implementation for an irreversible action. A custom modal would match the visual polish of `SignTransactionCard`'s gradient surfaces but adds 50+ lines for cosmetic gain. Defer until a wider modal-system pattern lands.
- **Sidebar settings menu other items** (export chats, theme toggle, etc.). The settings gear is the surface; this sprint adds only "Clear all". Future entries land there as separate sprints.
- **Rename undo / history.** Once a user renames a chat, there's no undo. Localstorage-only persistence; titles are regenerated on first message anyway. Defer.
- **Mobile-specific gesture for rename.** Hover-pencil is desktop-first; mobile users must double-tap or long-press a row to reveal the pencil (works because the existing trash icon already has the same gesture-discoverability constraint). Defer dedicated mobile rename UX.
- **Animation on dots → text transition.** The dots disappear and text appears in the same bubble — no explicit transition. Adding a fade-out for the dots is cosmetic; defer.

## Architecture

```
src/components/
  ChatMessage.tsx                              ChatPanel.tsx
  ───────────────                              ─────────────
  Assistant branch:                             - DELETE: showTyping calculation
  - Add `isWaitingForFirstToken` flag             at line 32
    when content === '' AND no tool calls       - DELETE: <TypingIndicator /> at
    AND no pendingTransaction AND no              line 64
    showConnectCta                               - DELETE: import TypingIndicator
  - When flag is true, render 3 pulsing dots
    (.typing-dot CSS) inside the bubble
    instead of <Markdown text="" />            TypingIndicator.tsx
                                                ───────────────────
  ChatMessage.test.tsx                           DELETE this file (no callers)
  ────────────────────
  +1 test: assistant message with empty
    content and no tool calls renders 3
    pulsing dots and no Markdown content
  +1 test: dots disappear once content
    becomes non-empty (re-render)

src/components/Sidebar.tsx                     src/hooks/useChat.ts
  ─────────────────────                          ───────────────────
  - Add settings gear icon button to header     - Add `clearAllConversations()`
    that toggles a popover with                   that wipes array + creates one
    "Clear all conversations" item                fresh empty conversation
  - On click, call native confirm() then        - Add `renameConversation(id,
    onClearAll() prop                              title)` that sets c.title for
  - Per-row: add hover-revealed pencil icon       the matching conversation,
    next to the existing trash icon               persisting via persist()
  - Per-row: switch title <span> between        - Reject empty trimmed titles
    static text and an inline-edit <input>        (silent no-op)
    based on per-row `editingId` state
  - Enter commits, Escape cancels, blur
    commits

  Sidebar.test.tsx (NEW)                         useChat.test.ts (extend)
  ──────────────────                             ────────────────
  - settings menu opens/closes                   - clearAllConversations replaces
  - clear-all calls onClearAll prop                array with one fresh empty
  - rename pencil click enters edit mode         - renameConversation updates
  - Enter key commits, Escape cancels              title for matching id
  - Empty title rejected                         - Empty/whitespace title rejected
```

### Key design decisions

1. **#24 = inline dots inside the empty bubble, not a separate component.** Approach A from brainstorm. The current dual-component architecture (`ChatMessage` + `TypingIndicator`) ships TWO K avatars during the gap. Folding the dots into the empty `ChatMessage` keeps a single avatar throughout the lifecycle; first token replaces the dots in-place. Smallest diff, cleanest UX, eliminates dead code (`TypingIndicator.tsx` deleted entirely).

2. **The `isWaitingForFirstToken` predicate must guard against false positives.** Specifically: an assistant message with `content === ''` could legitimately be a tool-only response (where the LLM uses tools but emits no prose), or a wallet-required CTA, or a pending transaction. The predicate is `content === '' AND no toolCalls AND no pendingTransaction AND no showConnectCta`. Verified by reading `ChatMessage.tsx:25-41` — these are the four reasons an assistant message might render content alongside the K avatar.

3. **`TypingIndicator.tsx` deletion is intentional.** Once the dots are inlined into `ChatMessage`, no other component references `TypingIndicator`. Keeping the file as a future-use component would be premature abstraction — YAGNI applies. The `pulse-dot` keyframe in `src/index.css:79-84` stays (it's a generic CSS class).

4. **#23 settings gear placement = sidebar header.** Brainstorm option A1. The header is the natural "global controls" surface; the existing close-X button on mobile already establishes the pattern. Adding a gear icon there extends the rhythm without introducing a new visual element class. Footer (A3 kebab) was the runner-up; deferred because the footer currently shows the "Solana Mainnet" status pill — adding a kebab there crowds the visual.

5. **#23 rename UX = hover pencil + inline edit.** Brainstorm option B1. Discoverable (visible alongside the existing trash icon on hover), keyboard-friendly (Enter commits, Escape cancels), matches the existing hover-icon pattern. Inline `<input>` controlled by per-row `editingId` state lives in the Sidebar component. Modal (B4) was rejected for being heavyweight; double-click (B2) is hidden; right-click (B3) feels desktop-y for a web app.

6. **Native `confirm()` for "Clear all conversations".** Smallest correct implementation for an irreversible action. The user gets a native modal blocker that's familiar across browsers. Custom modal would match `SignTransactionCard` polish but adds tableau for cosmetic gain. Defer the custom modal pattern to a future sprint when more confirmation flows accumulate.

7. **Post-clear behavior matches existing `deleteConversation` invariant.** When the last conversation is deleted, `useChat.ts:106-110` creates a fresh empty conversation and switches to it. `clearAllConversations()` reuses this exact behavior — leaves the user on a usable empty state, never a blank-list dead-end.

8. **Empty-title rejection on rename = silent no-op.** Trimmed empty titles are rejected without an error toast or visual feedback — the input simply doesn't commit and reverts to the previous title on blur. The auto-generated title rule (first 40 chars of first user message) means titles are always recoverable on next send. A future polish could surface a "Title cannot be empty" tooltip; defer.

9. **One commit per logical change, three commits total.** Per project rule. #24's TypingIndicator inline-merge is one commit; #23's bulk-clear is one commit; #23's rename is one commit. Any code-review fix commits ship in the same PR (the C-2 / 4.2a precedent).

10. **Out-of-scope discovery (empty-msg-on-abort) gets its own issue, not a bundled fix.** During Chrome MCP verification, observed that aborted streams leave empty assistant messages persisting in conversation state. NOT bundled — separate brainstorm needed to decide the desired behavior (delete on abort? mark as "stream interrupted"?). File new GitHub issue at PR open time so the discovery doesn't get lost.

## Test plan

| Coverage | Where | New tests |
|---|---|---|
| #24 dots render inside empty assistant message | `src/components/ChatMessage.test.tsx` | +1 |
| #24 dots disappear when content arrives | `src/components/ChatMessage.test.tsx` | +1 |
| #23 clearAllConversations replaces array with fresh empty | `src/hooks/useChat.test.ts` (extend) | +1 |
| #23 renameConversation updates title for matching id | `src/hooks/useChat.test.ts` | +1 |
| #23 renameConversation rejects empty/whitespace title | `src/hooks/useChat.test.ts` | +1 |
| #23 Sidebar settings menu opens/closes | `src/components/Sidebar.test.tsx` (NEW) | +1 |
| #23 Sidebar Clear-all calls onClearAll prop | `src/components/Sidebar.test.tsx` | +1 |
| #23 Sidebar rename pencil enters inline edit | `src/components/Sidebar.test.tsx` | +1 |
| #23 Sidebar Enter commits, Escape cancels | `src/components/Sidebar.test.tsx` | +2 |

**Test count delta:** 163 → ~173 across 19 → 20 files. (1 new file `src/components/Sidebar.test.tsx`; `src/hooks/useChat.test.ts` already exists from D-3/D-4 work — extend it.)

**Validation gates** (run after every commit per CLAUDE.md):
- `pnpm exec tsc --noEmit` — silent (client)
- `pnpm exec tsc -p server/tsconfig.json --noEmit` — silent (server)
- `pnpm test:run` — green, count matches commit's expected delta

**Manual smoke (post-deploy):**
- Submit a query → confirm single K avatar with 3 pulsing dots during the gap → confirm dots replaced by streaming text on first token (#24)
- Open settings menu → click "Clear all" → confirm native confirm() → confirm fresh empty conversation appears (#23 bulk-clear)
- Hover a sidebar row → click pencil → edit title → Enter → confirm new title persists across reload (#23 rename)

## Risks

**Low.** All three changes are local UI surface; no data-model or server-side changes; no concurrency or wallet flows touched.

- **#24 inline dots:** Worst case — the `isWaitingForFirstToken` predicate has a false-positive edge case (e.g., a message that legitimately should display empty content for some new code path). Mitigation: predicate explicitly requires `content === ''` AND no toolCalls AND no pendingTransaction AND no showConnectCta — the four known reasons assistant messages render. Test verifies negative cases (with content, with tool calls, etc.).
- **#23 bulk-clear:** Worst case — user accidentally clears all conversations. Mitigation: native `confirm()` is the standard Web Platform UX for irreversible actions; user must explicitly OK. The fresh-empty-conversation post-state means no dead-end UX. (Cleared conversations are NOT recoverable — localstorage is wiped — but this matches the existing single-trash flow's irreversibility.)
- **#23 rename:** Worst case — user types a long title that breaks layout. Mitigation: existing `<span className="flex-1 truncate">` (`Sidebar.tsx:92`) already truncates overflow; the inline `<input>` will need the same `truncate` discipline OR a max-length attribute (60 chars matches the auto-title's 40+...). Add `maxLength={60}` on the input.

**Mitigation across the cluster:** Project's standard typecheck-and-test gates after each commit catch regressions at commit boundary. Manual smoke in production verifies the visible UX (Chrome MCP available for cross-checks).

## Acceptance criteria

- [ ] All 3 commits land on `feat/p2-ui-features`, one per logical change.
- [ ] PR body lists `Closes #23`, `Closes #24`.
- [ ] All 3 typecheck commands silent on each commit.
- [ ] `pnpm test:run` shows ~173/173 across ~20 files at the tip of the branch.
- [ ] Cluster reviewer (`opus`) returns SHIP IT with 0 Critical / 0 Important.
- [ ] After PR merge, `gh issue list --label qa-2026-04-26 --state open --limit 30` returns 7 (6 backlog + 1 umbrella). Umbrella issue #3's P2 UI-features row shows #23-#24 ticked.
- [ ] At PR open time, file a new GitHub issue documenting the empty-assistant-message-persistence-on-abort bug (out-of-scope discovery from Chrome MCP verification). Link to PR for context.
- [ ] No AI attribution in commit messages, PR body, any added comment, or the new issue body.

## Out-of-band notes

- **Verified live in production via Chrome MCP** before designing. The tab was a fresh tab created via `tabs_create_mcp` (per memory `chrome-mcp-new-tab.md`). Screenshots confirmed the dual-K-avatar bug and the empty-msg-on-abort bug.
- **`TypingIndicator.tsx` is being deleted.** This is intentional — the component has no callers after this sprint and keeping a single-use component file shipped at low risk is YAGNI. The `pulse-dot` keyframe in `src/index.css:79-84` stays (general-purpose CSS).
- **Sprint 4.3 (P1, 6 items) remains scheduled for a separate session.** Phase D (GTM — demo video, README screenshots, tweet thread, Superteam submission) untouched and RECTOR-driven; bounty deadline 2026-05-12 (14 days from session date). Sprint 4.2b's UI improvements directly improve Phase D demo-quality screenshots/video.
- **Empty-msg-on-abort discovery summary** (for the new issue body): Each user message creates a corresponding empty assistant message in `useChat.ts:131-150` BEFORE streaming starts. If the stream is aborted (via stop button or `switchConversation`/`deleteConversation`), the empty assistant message stays in the conversation array forever. Visible in production: orphan K avatars in old chats, with no content beside them. Fix needs separate brainstorm (delete on abort? mark as "stream interrupted"? add a placeholder message?).
