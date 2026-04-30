# Kami chat-shell amber redesign — design spec

**Date:** 2026-04-29
**Branch:** `docs/chat-shell-amber-spec`
**Scope:** Post-connect chat shell — restyled and restructured to extend the bento+amber
pre-connect landing (PR #48, merged 2026-04-28).
**Deadline context:** Eitherway-Kamino bounty 2026-05-12 (~13 days).

## 1. Goal

The bento+amber landing now lives at `kami.rectorspace.com` for unauthenticated
visitors. The moment a user clicks "Connect with Solflare" and authorizes, the
page transitions to a chat shell that still uses the old purple/dark
(`kami.bg / kami.surface / kami.accent`) palette. The visual jump breaks the
"single coherent product" feel.

Goal: rebuild the chat shell so connect → chat is one continuous experience in
the same sepia / cream / amber design language. No purple, no electric blue,
strictly the bento vocabulary.

## 2. Constraints

- **Bounty deadline 2026-05-12.** Phase D items (screenshots, demo video, tweet
  thread, Superteam submission) are interleavable with this work but the chat
  shell rebuild ships first so the demo materials capture the new look.
- **Single PR.** One feature branch (`feat/chat-shell-amber`), one PR, sequential
  commits per the migration plan in §13.
- **Tests are mandatory.** Every new component ships with a `.test.tsx` sibling.
  CI gates the merge.
- **Three typecheck commands locally before pushing server-side changes** (per
  memory `tsc-b-skips-server-tsconfig.md`).
- **No AI attribution** in commits, PR body, or docs.
- **No business-logic changes.** Wallet flow, message streaming, tool execution,
  signature flow — all stay verbatim. This is a chrome rewrite, not a refactor of
  data flow.

## 3. Out of scope

- The pre-connect bento landing (already shipped in PR #48).
- Server-side code (`api/*`, `server/*`).
- Storage layer (`useChat` hook, localStorage schemas).
- Anything not in `src/components/`.
- Animation / motion design beyond the existing landing keyframes (`cascade-up`,
  `blink`, `pulse-dot`).
- Performance work — bundle size already at 630 kB main.js gzipped 194 kB; this
  rebuild is expected to add ~30 kB delta which stays under the existing 700 kB
  Vite warning threshold.
- New conversation features (search, pin, archive, etc.). This is restyle +
  light restructure only.

## 4. Reference

An aidesigner X "Bento Workspace" mockup was generated at brainstorm time for
visual reference (`run_id: e9890059-db5e-4c5e-bc94-fe1f86f03693`). The mockup
validates the direction (amber pill, monospace overline, bento-cell turns,
cellElevated structured-data sub-cards) and is treated as a target reference
image — we do not port its HTML.

The implementation builds from existing landing primitives (BentoCell,
KamiCursor) and the chat-domain primitives in §7 — not from the aidesigner HTML.

## 5. Architecture: three-tier folder structure

```
src/components/
├── bento/      ← NEW — shared design-system primitives
│   ├── BentoCell.tsx          (moved from landing/, extended with variant + animate props)
│   ├── BentoCell.test.tsx     (moved + extended)
│   ├── KamiCursor.tsx         (moved from landing/, unchanged)
│   └── KamiCursor.test.tsx    (moved)
│
├── landing/    ← 6 files retained (pre-connect)
│   ├── HeroCell.tsx           (import path: ../bento/BentoCell)
│   ├── SysMetricsCell.tsx     (same refactor)
│   ├── LatestTxCell.tsx       (same)
│   ├── ToolCell.tsx           (same)
│   ├── PipelineCell.tsx       (same)
│   └── SponsorStrip.tsx       (no import refactor — uses Fragment)
│
├── chat/       ← NEW — chat-shell primitives
│   ├── ChatHeader.tsx
│   ├── SidebarShell.tsx
│   ├── ConversationItem.tsx
│   ├── MessageBubble.tsx
│   ├── ToolBadge.tsx
│   ├── KeyValueRows.tsx
│   ├── TxStatusCard.tsx
│   ├── ChatInputShell.tsx
│   ├── SuggestionChip.tsx
│   ├── WalletPill.tsx
│   ├── groupToolCalls.ts      (utility extracted from current ToolCallBadges)
│   └── *.test.{tsx,ts}
│
├── App.tsx                    (refactored — imports from chat/* + bento/*)
├── App.test.tsx               (mocks updated for chat/ paths)
├── EmptyState.tsx             (UNCHANGED — already amber, used by App when !connected)
├── ConnectWalletButton.tsx    (RESTYLED — amber pill for inline error states)
├── ErrorBoundary.tsx          (RESTYLED — sepia bg + amber accent)
├── WalletProvider.tsx         (UPDATE — useWalletModalTheme CSS injection: purple → amber)
│
└── (DELETED legacy files)
    Sidebar.tsx, Sidebar.test.tsx
    ChatPanel.tsx, ChatPanel.test.tsx
    ChatInput.tsx, ChatInput.test.tsx
    ChatMessage.tsx, ChatMessage.test.tsx
    ToolCallBadges.tsx, ToolCallBadges.test.tsx
    SignTransactionCard.tsx, SignTransactionCard.test.tsx
```

**Why three tiers and not "duplicate primitives into chat/":** `BentoCell` and
`KamiCursor` are not landing-specific — they are design-system primitives that
happened to be born in the `landing/` folder because the landing was the first
consumer. Both `landing/` and `chat/` consume them; they belong in a third
shared location. Naming the folder `bento/` (not `ui/`, not `shared/`) keeps the
design-language signal loud at every import site.

## 6. Design tokens (already in `tailwind.config.js`)

No new tokens. The bento palette set in PR #48 is the complete vocabulary:

| Token | Value | Use |
|------|------|------|
| `kami.sepiaBg` | `#1a1410` | App background |
| `kami.cellBase` | `#221a14` | Bento cell default background |
| `kami.cellElevated` | `#2a2117` | Sub-cards inside cells (KeyValueRows) |
| `kami.cellBorder` | `rgba(245,230,211,0.12)` | 1px hairline borders |
| `kami.cream` | `#F5E6D3` | Default text |
| `kami.creamMuted` | `rgba(245,230,211,0.6)` | Secondary text |
| `kami.amber` | `#FFA500` | Action / highlight / status only |
| `kami.amberGlow` | `rgba(255,165,0,0.15)` | Soft amber tint |
| `kami.amberHaze` | `rgba(255,165,0,0.05)` | Even softer amber tint |

Fonts (already loaded via `index.html` Google Fonts):

- **Unbounded** (700/800) — display, used for the "Kami" wordmark and
  conversation titles.
- **Inter** (default sans) — body text and message content.
- **JetBrains Mono** (400/700) — monospace data: status indicators, timestamps,
  truncated addresses, tool names, the env overline strip.

Keyframes (already in `tailwind.config.js`):

- `cascade-up` 800ms `cubic-bezier(0.175, 0.885, 0.32, 1.275)` `backwards` —
  entrance for cells.
- `blink` 1s `step-end` infinite — KamiCursor.
- `pulse-dot` 2s `ease-out` infinite — status indicator.

## 7. Component APIs

### `bento/BentoCell` (extended)

```ts
interface BentoCellProps {
  variant?: 'full' | 'compact' | 'mini';   // default 'full' (back-compat for landing)
  delay?: number;                          // stagger delay multiplier (× 100ms), default 0
  animate?: boolean;                       // default true; pass false for instant render
  className?: string;
  as?: 'div' | 'section' | 'article';
  children: React.ReactNode;
}
```

Variant rules:

| variant | radius | padding | animation |
|--------|-------|--------|----------|
| `full` | rounded-3xl (24px) | p-6 lg:p-8 | cascade-up 800ms |
| `compact` | rounded-3xl (24px) | p-4 lg:p-5 | cascade-up 600ms |
| `mini` | rounded-2xl (16px) | p-3 | none (CRUD context) |

`animate={false}` skips the cascade animation regardless of variant. Passing
`animate={true}` on `variant="mini"` is allowed but discouraged — the variant
default reflects the intended semantics.

### `bento/KamiCursor` (unchanged)

```ts
interface KamiCursorProps { /* no props */ }
```

Renders a 2-character-wide amber `▌` block with the `animate-blink` class.

### `chat/ChatHeader`

```ts
interface ChatHeaderProps {
  conversationTitle: string;
  onMenuToggle: () => void;
}
// Internal: useWallet() for the embedded WalletPill state.
```

Layout:

- LEFT: hamburger button (mobile only, `lg:hidden`) + JetBrains Mono overline
  `> KAMI · v1.0 · MAINNET` (cream/60, 11px tracking-wider, hidden below `sm`) +
  Unbounded `conversationTitle` (cream, 18px, font-weight 700) + `[sys.status:
  online]` indicator with `animate-pulse-dot` amber dot.
- RIGHT: `<WalletPill />`.

### `chat/SidebarShell`

```ts
interface SidebarShellProps {
  conversations: Conversation[];
  activeId: string;
  isOpen: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onClearAll: () => void;
  onRename: (id: string, title: string) => void;
}
// Internal state: settingsOpen, editingId, editingTitle (parity with current Sidebar.tsx)
```

Drop-in API match for the existing `Sidebar.tsx` so `App.tsx`'s consumer code
swaps the import path only. Layout follows current Sidebar but with bento
chrome: header K avatar becomes a clean amber-on-sepia rounded square (drop the
purple→pink gradient), `+ New Chat` is a full-width pill with cellBorder + amber
hover, conversation rows are `<ConversationItem />` (mini bento cells), footer
keeps the existing green-dot "Solana Mainnet" indicator.

### `chat/ConversationItem`

```ts
interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  isEditing: boolean;
  editingTitle: string;
  onSelect: () => void;
  onStartRename: () => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onChangeRenameTitle: (v: string) => void;
  onDelete: () => void;
}
```

Wraps `<BentoCell variant="mini" animate={false}>`. Active state: amberHaze
background + amber/25 border + amber text. Hover (non-active): lift 2px +
border shifts to amber/40, reveals pencil-rename + delete icons. The
inline-rename input pattern matches the current Sidebar's editing UX.

All 9 callbacks are managed by `SidebarShell`; `ConversationItem` stays purely
presentational.

### `chat/MessageBubble`

```ts
interface MessageBubbleProps {
  message: ChatMessage;          // existing type from src/types
  isStreaming: boolean;
}
```

Wraps `<BentoCell variant="compact">`. Per role:

- `role === 'user'`: right-aligned, `max-w-[65%]`, amberHaze background +
  rgba(255,165,0,0.25) border, no avatar (right-alignment implies user).
- `role === 'assistant'`: left-aligned, `max-w-[80%]`, cellBase background +
  cellBorder hairline. Optional inner ToolBadge row at top (rendered via
  `groupToolCalls(message.toolCalls)` mapped to `<ToolBadge>`), markdown content
  body, optional `<KeyValueRows>` for structured data, optional
  `<TxStatusCard>` when `message.pendingTransaction` is set, optional
  `<ConnectWalletButton>` when any tool call has `status === 'wallet-required'`.
- `isStreaming === true` and content is non-empty: append `<KamiCursor />`
  pinned to the end of the markdown render.
- `isStreaming === true` and content is empty (waiting for first token): render
  `<KamiCursor />` alone in an empty inner cell ("thinking" state).

### `chat/ToolBadge`

```ts
interface ToolBadgeProps {
  name: string;                                                // 'tool/findYield'
  status: 'running' | 'success' | 'error' | 'wallet-required';
  count?: number;                                              // for ×N suffix when grouped
}
```

Single rounded-full pill: amber border + amber/8 background + lucide-react icon
(status-keyed: Loader2 / CheckCircle2 / AlertCircle / Wallet) + JetBrains Mono
11px name + optional `×{count}` suffix when `count > 1`.

### `chat/KeyValueRows`

```ts
interface KeyValueRowsProps {
  rows: { key: string; value: string; accent?: 'amber' | 'cream' | 'muted' }[];
}
```

Renders an inner `cellElevated` bg + cellBorder hairline sub-card. Each row
mono 12px: `text-creamMuted` key on the left, accented value on the right.
Default accent: `cream`.

Pattern lifted verbatim from `landing/SysMetricsCell.tsx`'s inner table.

### `chat/TxStatusCard`

```ts
interface TxStatusCardProps {
  transaction: PendingTransaction;          // existing type, unchanged
}
// Internal state machine:
//   needs-sign → signing → broadcasting → confirmed | failed
```

Replaces `SignTransactionCard.tsx`. Same business logic — calls
`wallet.signTransaction`, then HTTP-polls `getSignatureStatuses` per memory
`eitherway-scaffold-leftovers.md` (no WS subscription on Vercel). Only the
visual chrome is rebuilt:

- Outer: `<BentoCell variant="compact">` — cellBase + cellBorder.
- Inner state-keyed sections:
  - `needs-sign`: tx summary in `<KeyValueRows>` (action, amount, market, est. health factor) + amber CTA "Sign Transaction" (rounded-xl, amber bg, sepia text).
  - `signing`: tx summary + amber inline `<KamiCursor />` + "Signing…" mono text.
  - `broadcasting`: tx summary + `animate-pulse-dot` amber dot + "Broadcasting…" mono text.
  - `confirmed`: green ✓ amber pill (small `<BentoCell variant="mini">` with cellElevated bg) + truncated signature (`5XKeETjGfm…pUvZE`) + Solscan ↗ link + amber bullet (lifted from `landing/LatestTxCell.tsx`).
  - `failed`: red ✕ pill + error message + retry CTA.

### `chat/ChatInputShell`

```ts
interface ChatInputShellProps {
  onSend: (msg: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}
```

Drop-in API match for current `ChatInput.tsx`. Visual rebuild:

- Suggestion chip strip (only when `input === '' && !isStreaming && !disabled`):
  horizontal-scroll row of `<SuggestionChip>` instances, with mask-edges
  fade on the right edge.
- Bento-cell input shell: cellBase bg + cellBorder, rounded-2xl. Inside:
  autosizing `<textarea>` (transparent bg, no visible border, Inter 14px,
  placeholder "Ask Kami about DeFi…" in cream/40) + amber send button (40×40,
  rounded-xl, amber bg, sepia ↑ icon). When `isStreaming`, send button becomes
  a stop button (rounded-xl, danger/20 bg, danger ⏹ icon).
- Footer: cream/40 disclaimer "Kami provides information only. Always verify
  before signing transactions."

### `chat/SuggestionChip`

```ts
interface SuggestionChipProps {
  label: string;
  onClick: () => void;
}
```

Atomic. Rounded-full pill, cellBorder, JetBrains Mono 12px, cream/60. Hover:
amber border, amber text, amberHaze background. Click fires `onClick`.

### `chat/WalletPill`

```ts
interface WalletPillProps { /* no props — reads useWallet() internally */ }
// Internal state: dropdownOpen (boolean)
```

Renders only when `useWallet().connected === true` (App.tsx gate prevents this
component from mounting otherwise). Layout:

- Trigger button: rounded-full pill, amber bg, sepia text. Compact form on
  mobile (drop the Solflare icon, keep truncated pubkey + chevron). Desktop
  form: Solflare-style icon + JetBrains Mono 12px truncated pubkey
  (`HclZ..25En`) + chevron-down icon.
- Click → toggles `dropdownOpen`.
- Dropdown panel (when open): cellBase bg + cellBorder, rounded-2xl, py-1, items
  in JetBrains Mono 13px:
  1. Copy address — `navigator.clipboard.writeText(publicKey.toBase58())`
  2. View on Solscan — `window.open('https://solscan.io/account/<pubkey>')`
  3. Disconnect — `wallet.disconnect()`
- Click-outside or Esc closes dropdown.

Replaces the 3rd-party `WalletMultiButton` from
`@solana/wallet-adapter-react-ui`. The `WalletModalProvider` from the same
package stays in the tree (used for the "Connect with Solflare" flow on the
landing — no change to that side).

### `chat/groupToolCalls` (utility)

```ts
export function groupToolCalls(calls: ToolCall[]):
  { name: string; status: ToolStatus; count: number }[]
```

Pure helper. Lifted from current `ToolCallBadges.tsx` (Day-12 Sprint 3.1
addition, dedup with `×N` suffix). Same semantics, just relocated to
`chat/groupToolCalls.ts` as a standalone utility consumed by `MessageBubble`.

## 8. Animation budget

Cascade-up runs ONCE on element mount:

- First paint of bento landing (already shipped).
- First mount of chat shell when `connected` flips true → SidebarShell header,
  ChatHeader, ChatInputShell, first MessageBubble all stagger in (delays 1, 2,
  3, 4 → 100ms, 200ms, 300ms, 400ms).
- Each new MessageBubble as it arrives (cascade 600ms via `variant="compact"`).
  Since CSS animations run on element mount and not on prop changes, text
  streaming inside the bubble does NOT re-trigger the animation.

Animation OFF for:

- Sidebar conversation rows (`variant="mini" animate={false}`) — CRUD context.
- Re-renders during streaming (text-delta, tool-call status updates).
- Active-conversation switching (no remount).
- Settings dropdown open/close, rename input toggle.

Always-on micro-animations:

- `KamiCursor` blink — pinned to streaming assistant content + textarea
  placeholder (subtle).
- `animate-pulse-dot` on the ChatHeader status indicator.

Hover lift on bento cells: only on cells with explicit interactivity. Suggestion
chips lift, ToolBadges lift, sidebar conversation rows lift. Message bubbles do
NOT lift on hover (would feel weird in a chat log). Input shell does NOT lift.

## 9. Mobile strategy

Match landing breakpoints (`sm 640`, `md 768`, `lg 1024`):

- **Below `lg` (mobile + tablet, &lt; 1024px):** sidebar slides in as
  full-screen overlay with backdrop (existing pattern from `Sidebar.tsx`).
  Backdrop is `bg-black/50 backdrop-blur-sm`. Hit targets 44×44 minimum on
  interactive elements.
- **At and above `lg` (desktop, ≥ 1024px):** sidebar is a fixed 280px rail.
- **ChatHeader on mobile (`< sm`):** hamburger + Unbounded title only. Drop the
  monospace overline strip. Above `sm`: full layout as specified in §7.
- **WalletPill on mobile:** compact form (drop the Solflare icon, keep
  truncated pubkey + chevron). Dropdown opens as a full-width sheet anchored
  to the bottom of the trigger.
- **MessageBubble max-width:** `max-w-[85%]` on mobile, `max-w-[65%]` (user) /
  `max-w-[80%]` (assistant) at `md` and above.
- **SuggestionChip strip:** horizontal-scroll with `mask-image`
  fade on the right edge — works at all breakpoints.

## 10. Testing

Each new component ships with a `.test.tsx` sibling. Vitest 4.x + React Testing
Library + happy-dom.

Per-component test counts (target):

| Component | New tests | Why |
|----------|----------|-----|
| `bento/BentoCell` | +6 | variant=full default, =compact, =mini, animate=false, delay applies, as=section/article |
| `bento/KamiCursor` | 0 (existing tests preserved) | unchanged |
| `chat/ChatHeader` | 4 | renders title, hamburger fires on click, status dot renders, integrates WalletPill |
| `chat/SidebarShell` | 6 | renders conversation list, new chat fires, settings menu opens, clear-all confirm, rename happy path, delete fires |
| `chat/ConversationItem` | 4 | active state, hover reveals actions, edit toggle, callbacks fire |
| `chat/MessageBubble` | 4 | user, assistant minimal, assistant with grouped tool calls, assistant streaming with KamiCursor |
| `chat/ToolBadge` | 4 | renders 4 status icons (running/success/error/wallet-required), count=1 omits suffix, count>1 shows ×N |
| `chat/KeyValueRows` | 3 | renders rows, accent colors apply, empty rows handled |
| `chat/TxStatusCard` | 7 | 5 phase renders + 2 transitions (needs-sign → signing on click, signing → confirmed via mocked poll) |
| `chat/ChatInputShell` | 5 | autosize, send fires, stop fires when streaming, suggestion strip hidden when input non-empty, disabled state |
| `chat/SuggestionChip` | 2 | renders label, onClick fires |
| `chat/WalletPill` | 5 | renders pubkey when connected, dropdown opens, copy → clipboard.writeText, solscan → window.open, disconnect → wallet.disconnect |
| `chat/groupToolCalls` | 4 | dedup with ×N, preserves order, status precedence (running > success), empty array |

**Total new tests:** ~54.
**Existing tests removed (alongside legacy components):** 22 (Sidebar 6,
ChatMessage 6, ToolCallBadges 10; ChatPanel / ChatInput / SignTransactionCard
have no existing tests, so 0 lost from those).
**Net delta:** ~+32, target 226 → ~258.

`App.test.tsx` mocks updated to point at `chat/*` paths (mechanical refactor,
same coverage).

Existing handler tests (`api/chat.test.ts`, `api/rpc.test.ts`) unchanged — no
business-logic touches.

## 11. Migration sequence (10 commits)

Each step ships a green build (typecheck + tests + Vercel preview). The PR
stays open and accumulates commits sequentially. A team-wide squash-merge at
the end is NOT used — per `CLAUDE.md` global instruction, merge with
`gh pr merge N --merge` and keep the granular commit history.

1. **Setup `bento/`** — create `src/components/bento/`, move `BentoCell.tsx` +
   `KamiCursor.tsx` + their tests, update 6 import paths in `landing/*`,
   extend `BentoCell` with `variant` and `animate` props (defaults preserve
   current behavior), +6 new BentoCell tests for variants. *Verify: 226 tests
   still green.*
2. **Atomic chat primitives** — `SuggestionChip`, `ToolBadge`, `KeyValueRows`,
   `chat/groupToolCalls.ts` utility (extracted from current
   `ToolCallBadges.tsx`). +13 tests. Standalone — no consumer wiring yet.
3. **`WalletPill` + modal CSS** — new `WalletPill` component, repaint
   `useWalletModalTheme` CSS injection in `WalletProvider.tsx` from purple to
   amber (modal stays themed for the "Use another wallet" flow). +5 tests.
   Not yet swapped into the chat shell.
4. **Composite chat primitives** — `ConversationItem`, `MessageBubble`,
   `ChatHeader`, `ChatInputShell`. Each composes from atomics + bento
   primitives. +17 tests. Standalone — `App.tsx` still imports legacy
   components.
5. **`SidebarShell`** — new component owning settings menu + new chat +
   conversation list logic, composes `ConversationItem`. Same prop signature
   as current `Sidebar.tsx`. +6 tests.
6. **`TxStatusCard`** — replaces `SignTransactionCard.tsx`. 5-state state
   machine, reuses existing `wallet.signTransaction` +
   `pollSignatureStatus` logic verbatim. +7 tests.
7. **`App.tsx` swap-in** — replace imports: `chat/SidebarShell` for
   `Sidebar`, inline `chat/ChatHeader` + `chat/ChatInputShell` + map
   `chat/MessageBubble` for the old `ChatPanel` tree. `App.test.tsx` mocks
   updated. *Verify: full app renders end-to-end on Vercel preview.*
8. **Delete legacy** — remove `Sidebar.tsx`, `ChatPanel.tsx`, `ChatInput.tsx`,
   `ChatMessage.tsx`, `ToolCallBadges.tsx`, `SignTransactionCard.tsx` + their
   test siblings. Clean delete — no orphan imports allowed.
9. **Retheme stragglers** — `ConnectWalletButton.tsx` (inline error CTA) →
   amber pill, `ErrorBoundary.tsx` → sepia bg + amber accent.
10. **Visual QA + polish** — Chrome MCP smoke at 1280 / 1024 / 768 / 375
    viewports, animation-timing tune, a11y audit (keyboard nav for sidebar +
    dropdown + suggestion chips), final commit. Open PR.

## 12. Open risks / known gotchas

- **`@solana/wallet-adapter-react-ui` modal CSS classes are not API-stable.**
  Our `useWalletModalTheme` CSS injection targets specific class names
  (`.wallet-adapter-modal-wrapper`, `.wallet-adapter-modal-button-close`, etc.).
  A package upgrade could break the theming silently. Mitigation: pin the
  `@solana/wallet-adapter-react-ui` version in `package.json`, add a smoke test
  that opens the modal in `App.test.tsx` and asserts the wrapper class exists.
- **`WalletPill` replaces `WalletMultiButton`'s built-in disconnect dropdown.**
  The 3rd-party button has additional micro-features (e.g., wallet switching
  without explicit disconnect). Day-1 of the rebuild, Pill ships with 3 menu
  items (Copy / Solscan / Disconnect). If users miss "switch wallet inline"
  later, that's a follow-up issue — out of scope here.
- **Bundle size.** Adding 13 new chat components is ~30 kB minified delta.
  Current main.js is 630 kB / gzipped 194 kB. Should land at ~660 kB / gzipped
  ~205 kB — still under the 700 kB Vite warning. If we exceed it, the second
  fix is splitting the markdown renderer chunk further (already a separate
  chunk at 160 kB).
- **Cascade-up animation on every MessageBubble first-mount.** With long
  conversations, scrolling back up does not re-mount old bubbles (React
  preserves them in the tree), so this is fine in practice. If virtualization
  is added later, the cascade trigger would need rethinking.
- **`pollSignatureStatus` HTTP-polling loop in `TxStatusCard`.** Per memory
  `eitherway-scaffold-leftovers.md`, do NOT call `connection.confirmTransaction`
  — Vercel cannot upgrade to WS. The reused logic continues to use polling.

## 13. Acceptance criteria

The PR is ready to merge when:

1. All 10 migration steps committed in order (one commit per logical step).
2. CI green (`pnpm test:run` ~265 tests, three typecheck commands silent,
   `pnpm build` succeeds, klend-sdk pin guard passes, GitLab mirror succeeds).
3. Vercel preview deploys successfully and the chat shell renders correctly
   at 1280 / 1024 / 768 / 375 viewports.
4. Manual smoke on Vercel preview:
   - Connect with Solflare → page transitions from bento landing to chat shell
     in the same amber palette (no purple flash).
   - Send a query → MessageBubble cascade-ups in, KamiCursor blinks during
     streaming, ToolBadge row renders, response renders.
   - Click an existing tx that's confirmed → TxStatusCard shows the confirmed
     state with truncated signature + Solscan link.
   - Wallet pill click → dropdown opens with 3 items, all 3 work as specified.
   - Disconnect → page transitions back to bento landing.
   - Sidebar: new chat works, rename works, delete works, clear-all works.
   - Mobile: open hamburger → sidebar slides in, click conversation → sidebar
     auto-closes.
5. No console errors, no React warnings, no a11y violations from
   `@axe-core/react` (if available).
6. PR body links to this spec and the implementation plan.

---

**Status:** Spec drafted 2026-04-29. Awaiting user review before
`writing-plans` phase. After approval, this branch hosts the spec commit; the
implementation plan and feature branches follow per §11.
