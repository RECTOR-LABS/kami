# Sprint 4.2b — P2 UI features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the chat-shell during latency and lifecycle gaps — inline the waiting dots into the empty assistant bubble (#24) and add sidebar settings-menu bulk-clear plus per-chat hover-pencil rename (#23).

**Architecture:** Three commits, one per logical change. Task 1 modifies ChatMessage/ChatPanel and deletes TypingIndicator (UI-only refactor, TDD with React Testing Library). Tasks 2 and 3 add hooks (`clearAllConversations`, `renameConversation`) to `useChat`, then wire the new affordances into Sidebar and App. Component tests use RTL `render`+`screen`+`fireEvent`/`userEvent` matching the existing `ChatMessage.test.tsx` pattern; hook tests use `renderHook`+`act` matching `useChat.test.ts`.

**Tech Stack:** React 18, TypeScript, Vitest 4.x with `@testing-library/react`, Tailwind CSS, existing `pulse-dot` keyframe in `src/index.css:79-84`.

**Branch:** `feat/p2-ui-features` (already created with the design spec at `61d896b`).

---

## File Structure

| File | Disposition | Tasks | Responsibility |
|---|---|---|---|
| `src/components/ChatMessage.tsx` | Modify | 1 | Inline 3-dot waiting indicator inside empty assistant bubble |
| `src/components/ChatMessage.test.tsx` | Modify (extend) | 1 | +2 tests: dots render when empty + no tool calls; dots hidden when content arrives |
| `src/components/ChatPanel.tsx` | Modify | 1 | Delete `showTyping` calc, `<TypingIndicator />` JSX, and import |
| `src/components/TypingIndicator.tsx` | Delete | 1 | No callers after Task 1 |
| `src/hooks/useChat.ts` | Modify | 2, 3 | Add `clearAllConversations()` (Task 2), `renameConversation(id, title)` (Task 3) |
| `src/hooks/useChat.test.ts` | Modify (extend) | 2, 3 | +1 clear-all test (Task 2), +2 rename tests (Task 3) |
| `src/components/Sidebar.tsx` | Modify | 2, 3 | Settings gear + popover + Clear-all action (Task 2); hover-pencil + inline-edit (Task 3) |
| `src/components/Sidebar.test.tsx` | Create (Task 2), Extend (Task 3) | 2, 3 | +2 settings menu tests (Task 2), +3 rename tests (Task 3) |
| `src/App.tsx` | Modify | 2, 3 | Destructure new useChat returns and pass `onClearAll` (Task 2), `onRename` (Task 3) to Sidebar |

---

## Task 1: D-24 — Inline waiting dots in empty assistant message (TDD)

**Files:**
- Modify: `src/components/ChatMessage.tsx`
- Modify: `src/components/ChatMessage.test.tsx`
- Modify: `src/components/ChatPanel.tsx`
- Delete: `src/components/TypingIndicator.tsx`

**Pattern:** TDD red → green. Write the failing tests first, run to confirm fail, implement, run to pass.

- [ ] **Step 1: Add the failing tests to `src/components/ChatMessage.test.tsx`**

Open `src/components/ChatMessage.test.tsx`. The existing file imports `render`, `screen` from `@testing-library/react`, and has 4 existing tests. Append these 2 tests inside the existing `describe('ChatMessage', ...)` block (just before the closing brace at line 53):

```typescript
  it('renders 3 pulsing dots when content is empty and no tool calls', () => {
    const { container } = render(
      <ChatMessage message={assistantMsg({ content: '' })} />
    );
    const dots = container.querySelectorAll('.typing-dot');
    expect(dots.length).toBe(3);
    // No empty markdown body alongside dots
    expect(screen.queryByText('Hi there.')).not.toBeInTheDocument();
  });

  it('hides the dots once content arrives (re-render with content)', () => {
    const { container, rerender } = render(
      <ChatMessage message={assistantMsg({ content: '' })} />
    );
    expect(container.querySelectorAll('.typing-dot').length).toBe(3);

    rerender(<ChatMessage message={assistantMsg({ content: 'Hello world.' })} />);
    expect(container.querySelectorAll('.typing-dot').length).toBe(0);
    expect(screen.getByText('Hello world.')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the new tests to confirm they fail**

Run:
```bash
pnpm test:run src/components/ChatMessage.test.tsx
```

Expected: 2 NEW tests fail (currently the empty-content message renders an empty markdown body without dots; `.typing-dot` selector matches nothing). Existing 4 tests still pass.

- [ ] **Step 3: Modify `src/components/ChatMessage.tsx` to render dots in the empty branch**

Open `src/components/ChatMessage.tsx`. The current assistant branch (lines 25-43) reads:

```typescript
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
```

Replace it with:

```typescript
  const showConnectCta = message.toolCalls?.some((c) => c.status === 'wallet-required') ?? false;
  const isWaitingForFirstToken =
    message.content === '' &&
    !message.toolCalls?.length &&
    !message.pendingTransaction &&
    !showConnectCta;

  return (
    <div className="flex mb-4 animate-fade-in">
      <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-kami-accent to-purple-400 flex items-center justify-center text-white font-bold text-xs mr-3 mt-0.5">
        K
      </div>
      <div className="max-w-[80%] lg:max-w-[70%]">
        {message.toolCalls && message.toolCalls.length > 0 && (
          <ToolCallBadges calls={message.toolCalls} />
        )}
        {isWaitingForFirstToken ? (
          <div className="flex items-center gap-1.5 px-4 py-3 bg-kami-surface rounded-2xl rounded-bl-md border border-kami-border w-fit">
            <div className="typing-dot w-2 h-2 rounded-full bg-kami-accent" />
            <div className="typing-dot w-2 h-2 rounded-full bg-kami-accent" />
            <div className="typing-dot w-2 h-2 rounded-full bg-kami-accent" />
          </div>
        ) : (
          <div className="text-sm space-y-1"><Markdown text={message.content} /></div>
        )}
        {message.pendingTransaction && (
          <SignTransactionCard transaction={message.pendingTransaction} />
        )}
        {showConnectCta && <ConnectWalletButton />}
      </div>
    </div>
  );
```

The dot bubble's classes are copied from the existing `TypingIndicator.tsx:9-13` so the visual rhythm is identical.

- [ ] **Step 4: Run the new tests to confirm they pass**

Run:
```bash
pnpm test:run src/components/ChatMessage.test.tsx
```

Expected: 6/6 tests pass.

- [ ] **Step 5: Modify `src/components/ChatPanel.tsx` — delete `showTyping`, `<TypingIndicator />`, import**

Open `src/components/ChatPanel.tsx`. The current file imports `TypingIndicator` at line 7 and uses it at lines 32 + 64.

Make three edits:

**Edit A:** Remove the import line. Locate at line 7:

```typescript
import TypingIndicator from './TypingIndicator';
```

Delete that line entirely.

**Edit B:** Remove the `showTyping` calculation. Locate at line 32:

```typescript
  const showTyping = isStreaming && lastMsg?.role === 'assistant' && lastMsg.content === '';
```

Delete that line entirely.

The preceding line `const lastMsg = conversation.messages[conversation.messages.length - 1];` (line 31) becomes dead code if not used elsewhere — verify with `grep`. If `lastMsg` is still referenced (it is currently not after deleting `showTyping`), keep it; otherwise delete it too. Since the only reference is the removed `showTyping`, delete the `lastMsg` declaration as well.

So delete BOTH lines 31 AND 32 of the original file. After this edit, the block reads:

```typescript
  const hasMessages = conversation.messages.length > 0;
```

(directly followed by the existing `return (...)`).

**Edit C:** Remove the `<TypingIndicator />` render. Locate at line 64:

```typescript
            {showTyping && <TypingIndicator />}
```

Delete that line entirely.

After all three edits, the relevant section of `ChatPanel.tsx` reads (showing surrounding context for clarity):

```typescript
import EmptyState from './EmptyState';

interface Props {
  conversation: Conversation;
  isStreaming: boolean;
  onSend: (msg: string, walletAddress?: string | null) => void;
  onStop: () => void;
  onMenuToggle: () => void;
}

export default function ChatPanel({ conversation, isStreaming, onSend, onStop, onMenuToggle }: Props) {
  const { publicKey } = useWallet();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation.messages]);

  const handleSend = (msg: string) => {
    onSend(msg, publicKey?.toBase58() || null);
  };

  const hasMessages = conversation.messages.length > 0;

  return (
    /* ... unchanged JSX ... */
      {hasMessages ? (
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto">
            {conversation.messages.map((msg) => (
              <ChatMessageComponent key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      ) : (
        <EmptyState />
      )}
    /* ... unchanged JSX ... */
```

- [ ] **Step 6: Delete `src/components/TypingIndicator.tsx`**

Run:
```bash
rm /Users/rector/local-dev/kami/src/components/TypingIndicator.tsx
```

- [ ] **Step 7: Run the full gate set**

Run:
```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p server/tsconfig.json --noEmit
pnpm test:run
```

Expected: All commands silent. Test count: 163 → 165 across 19 files (existing test files unchanged in count; ChatMessage.test.tsx gained +2 tests).

- [ ] **Step 8: Commit**

```bash
git add src/components/ChatMessage.tsx src/components/ChatMessage.test.tsx src/components/ChatPanel.tsx src/components/TypingIndicator.tsx
git commit -m "$(cat <<'EOF'
fix(chat): inline waiting dots inside empty assistant bubble

The empty assistant message and the separate TypingIndicator each rendered
their own K avatar, producing two stacked avatars during the time-to-first-
token gap (verified live via Chrome MCP). Render the 3 pulsing dots inside
the empty assistant bubble instead, so a single K avatar carries the user
through the entire message lifecycle.

Delete TypingIndicator.tsx — no callers after this change. The pulse-dot
keyframe in src/index.css stays (general-purpose CSS class).

Closes #24
EOF
)"
```

---

## Task 2: D-23 part 1 — Settings menu + `clearAllConversations` (TDD)

**Files:**
- Modify: `src/hooks/useChat.ts` (add `clearAllConversations`)
- Modify: `src/hooks/useChat.test.ts` (extend with 1 test)
- Modify: `src/components/Sidebar.tsx` (add settings gear + popover + Clear-all button)
- Create: `src/components/Sidebar.test.tsx` (NEW with 2 tests)
- Modify: `src/App.tsx` (destructure clearAllConversations, pass as onClearAll prop)

**Pattern:** TDD red → green for the hook test; component test follows after Sidebar wiring.

- [ ] **Step 1: Add the failing hook test to `src/hooks/useChat.test.ts`**

Open `src/hooks/useChat.test.ts`. The existing file uses `renderHook` from `@testing-library/react` and seeds localStorage where needed. Append a new describe block at the end of the file (after the existing `describe('useChat 4xx error rendering integration', ...)` block):

```typescript
describe('useChat clearAllConversations', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('replaces all conversations with one fresh empty conversation', () => {
    const conv1 = { id: 'c1', title: 'one', messages: [], createdAt: 1, updatedAt: 1 };
    const conv2 = { id: 'c2', title: 'two', messages: [], createdAt: 2, updatedAt: 2 };
    const conv3 = { id: 'c3', title: 'three', messages: [], createdAt: 3, updatedAt: 3 };
    localStorage.setItem('kami_conversations', JSON.stringify([conv1, conv2, conv3]));
    localStorage.setItem('kami_active_conversation', 'c2');

    const { result } = renderHook(() => useChat());
    expect(result.current.conversations.length).toBe(3);

    act(() => {
      result.current.clearAllConversations();
    });

    expect(result.current.conversations.length).toBe(1);
    expect(result.current.conversations[0].id).not.toBe('c1');
    expect(result.current.conversations[0].id).not.toBe('c2');
    expect(result.current.conversations[0].id).not.toBe('c3');
    expect(result.current.conversations[0].messages.length).toBe(0);
    expect(result.current.activeId).toBe(result.current.conversations[0].id);
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:
```bash
pnpm test:run src/hooks/useChat.test.ts
```

Expected: TypeScript compile error or runtime error — `clearAllConversations` is not on the hook's return shape yet.

- [ ] **Step 3: Add `clearAllConversations` to `src/hooks/useChat.ts`**

Open `src/hooks/useChat.ts`. After the existing `deleteConversation` definition (currently around lines 100-118), add a new callback. Then update the return object at the bottom (around lines 305-315) to include `clearAllConversations`.

**Edit A:** Add the callback. After the closing `[conversations, activeId, persist, switchConversation]` array of `deleteConversation` (around line 118) and before `const sendMessage = useCallback(...)`, insert:

```typescript
  const clearAllConversations = useCallback(() => {
    abortRef.current?.abort();
    const fresh = createConversation();
    persist([fresh]);
    switchConversation(fresh.id);
  }, [persist, switchConversation]);
```

**Edit B:** Update the return statement. The current return (around lines 305-315) reads:

```typescript
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
  };
```

Add `clearAllConversations` to the returned object:

```typescript
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
  };
```

- [ ] **Step 4: Run the test to confirm it passes**

Run:
```bash
pnpm test:run src/hooks/useChat.test.ts
```

Expected: All useChat tests pass, including the new `clearAllConversations` test.

- [ ] **Step 5: Update `src/components/Sidebar.tsx` — add settings gear + popover + onClearAll prop**

Open `src/components/Sidebar.tsx`. Make these changes:

**Edit A:** Update imports + Props interface. The current file (line 1-12) reads:

```typescript
import React from 'react';
import type { Conversation } from '../types';

interface Props {
  conversations: Conversation[];
  activeId: string;
  isOpen: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}
```

Replace with:

```typescript
import React, { useState } from 'react';
import type { Conversation } from '../types';

interface Props {
  conversations: Conversation[];
  activeId: string;
  isOpen: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onClearAll: () => void;
}
```

**Edit B:** Update the component signature. Current (lines 14-22):

```typescript
export default function Sidebar({
  conversations,
  activeId,
  isOpen,
  onSelect,
  onNew,
  onDelete,
  onClose,
}: Props) {
```

Replace with:

```typescript
export default function Sidebar({
  conversations,
  activeId,
  isOpen,
  onSelect,
  onNew,
  onDelete,
  onClose,
  onClearAll,
}: Props) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleClearAll = () => {
    setIsSettingsOpen(false);
    if (window.confirm('Clear all conversations? This cannot be undone.')) {
      onClearAll();
    }
  };
```

**Edit C:** Add the settings gear button to the header. The current header block (lines 40-56) reads:

```typescript
        <div className="p-4 border-b border-kami-border flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-kami-accent to-purple-400 flex items-center justify-center text-white font-bold text-sm">
            K
          </div>
          <div className="flex-1">
            <h1 className="font-semibold text-white text-sm">Kami</h1>
            <p className="text-xs text-kami-muted">DeFi Co-Pilot</p>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1 text-kami-muted hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
```

Replace with:

```typescript
        <div className="p-4 border-b border-kami-border flex items-center gap-3 relative">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-kami-accent to-purple-400 flex items-center justify-center text-white font-bold text-sm">
            K
          </div>
          <div className="flex-1">
            <h1 className="font-semibold text-white text-sm">Kami</h1>
            <p className="text-xs text-kami-muted">DeFi Co-Pilot</p>
          </div>
          <button
            onClick={() => setIsSettingsOpen((v) => !v)}
            aria-label="Settings"
            className="p-1 text-kami-muted hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button
            onClick={onClose}
            aria-label="Close sidebar"
            className="lg:hidden p-1 text-kami-muted hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {isSettingsOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsSettingsOpen(false)}
                aria-hidden="true"
              />
              <div className="absolute right-3 top-full mt-2 z-50 w-56 bg-kami-surface border border-kami-border rounded-lg shadow-lg py-1">
                <button
                  onClick={handleClearAll}
                  className="w-full text-left px-4 py-2 text-sm text-kami-text hover:bg-kami-border/50 transition-colors"
                >
                  Clear all conversations
                </button>
              </div>
            </>
          )}
        </div>
```

(The gear icon SVG path is the standard Heroicons "cog" outline. The header gets `position: relative` so the popover anchors to it.)

- [ ] **Step 6: Update `src/App.tsx` — destructure clearAllConversations and pass to Sidebar**

Open `src/App.tsx`. Current useChat destructure (around lines 11-21) reads:

```typescript
  const {
    conversations,
    activeConversation,
    activeId,
    isStreaming,
    sendMessage,
    stopStreaming,
    newConversation,
    switchConversation,
    deleteConversation,
  } = useChat();
```

Add `clearAllConversations`:

```typescript
  const {
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
  } = useChat();
```

Then the existing `<Sidebar ... />` render (around lines 25-39) reads:

```typescript
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        isOpen={sidebarOpen}
        onSelect={(id) => {
          switchConversation(id);
          setSidebarOpen(false);
        }}
        onNew={() => {
          newConversation();
          setSidebarOpen(false);
        }}
        onDelete={deleteConversation}
        onClose={() => setSidebarOpen(false)}
      />
```

Add the `onClearAll` prop:

```typescript
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        isOpen={sidebarOpen}
        onSelect={(id) => {
          switchConversation(id);
          setSidebarOpen(false);
        }}
        onNew={() => {
          newConversation();
          setSidebarOpen(false);
        }}
        onDelete={deleteConversation}
        onClose={() => setSidebarOpen(false)}
        onClearAll={clearAllConversations}
      />
```

- [ ] **Step 7: Create `src/components/Sidebar.test.tsx` with the 2 settings menu tests**

Create the new file `src/components/Sidebar.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Sidebar from './Sidebar';
import type { Conversation } from '../types';

const sampleConvs: Conversation[] = [
  { id: 'c1', title: 'first chat', messages: [], createdAt: 1, updatedAt: 1 },
  { id: 'c2', title: 'second chat', messages: [], createdAt: 2, updatedAt: 2 },
];

const noopProps = {
  conversations: sampleConvs,
  activeId: 'c1',
  isOpen: true,
  onSelect: vi.fn(),
  onNew: vi.fn(),
  onDelete: vi.fn(),
  onClose: vi.fn(),
  onClearAll: vi.fn(),
};

describe('Sidebar settings menu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens and closes the settings popover when the gear is clicked', () => {
    render(<Sidebar {...noopProps} />);

    expect(screen.queryByRole('button', { name: /clear all conversations/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    expect(screen.getByRole('button', { name: /clear all conversations/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    expect(screen.queryByRole('button', { name: /clear all conversations/i })).not.toBeInTheDocument();
  });

  it('calls onClearAll after the user confirms the native dialog', () => {
    const onClearAll = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<Sidebar {...noopProps} onClearAll={onClearAll} />);

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    fireEvent.click(screen.getByRole('button', { name: /clear all conversations/i }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(onClearAll).toHaveBeenCalledTimes(1);

    confirmSpy.mockRestore();
  });
});
```

- [ ] **Step 8: Run the full gate set**

Run:
```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p server/tsconfig.json --noEmit
pnpm test:run
```

Expected: All commands silent. Test count: 165 → 168 across 19 → 20 files (Sidebar.test.tsx is new with 2 tests; useChat.test.ts gained +1 test).

- [ ] **Step 9: Commit**

```bash
git add src/hooks/useChat.ts src/hooks/useChat.test.ts src/components/Sidebar.tsx src/components/Sidebar.test.tsx src/App.tsx
git commit -m "$(cat <<'EOF'
feat(sidebar): add settings menu with bulk-clear conversations

Add a sidebar settings gear icon that toggles a popover with "Clear all
conversations". Click triggers a native confirm() — on confirm, the new
clearAllConversations() useChat callback wipes the array and creates one
fresh empty conversation (matching the existing post-delete invariant).

Tests cover the popover open/close behavior, the confirm path, and the
hook's array-replacement semantics.

Closes #23 (part 1 of 2; rename ships in next commit)
EOF
)"
```

---

## Task 3: D-23 part 2 — Hover pencil + `renameConversation` (TDD)

**Files:**
- Modify: `src/hooks/useChat.ts` (add `renameConversation`)
- Modify: `src/hooks/useChat.test.ts` (extend with 2 tests)
- Modify: `src/components/Sidebar.tsx` (add hover-pencil + inline edit)
- Modify: `src/components/Sidebar.test.tsx` (extend with 3 tests)
- Modify: `src/App.tsx` (destructure renameConversation, pass as onRename prop)

**Pattern:** TDD red → green for the hook tests; component tests follow after Sidebar wiring.

- [ ] **Step 1: Add the failing hook tests to `src/hooks/useChat.test.ts`**

Open `src/hooks/useChat.test.ts`. Append a new describe block at the end of the file (after the `useChat clearAllConversations` block from Task 2):

```typescript
describe('useChat renameConversation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('updates the title for the matching conversation id', () => {
    const conv1 = { id: 'c1', title: 'old title', messages: [], createdAt: 1, updatedAt: 1 };
    const conv2 = { id: 'c2', title: 'untouched', messages: [], createdAt: 2, updatedAt: 2 };
    localStorage.setItem('kami_conversations', JSON.stringify([conv1, conv2]));
    localStorage.setItem('kami_active_conversation', 'c1');

    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.renameConversation('c1', 'fresh title');
    });

    const c1 = result.current.conversations.find((c) => c.id === 'c1');
    const c2 = result.current.conversations.find((c) => c.id === 'c2');
    expect(c1?.title).toBe('fresh title');
    expect(c2?.title).toBe('untouched');
  });

  it('rejects empty or whitespace-only titles as a silent no-op', () => {
    const conv1 = { id: 'c1', title: 'keep this', messages: [], createdAt: 1, updatedAt: 1 };
    localStorage.setItem('kami_conversations', JSON.stringify([conv1]));
    localStorage.setItem('kami_active_conversation', 'c1');

    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.renameConversation('c1', '   ');
    });

    expect(result.current.conversations[0].title).toBe('keep this');

    act(() => {
      result.current.renameConversation('c1', '');
    });

    expect(result.current.conversations[0].title).toBe('keep this');
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run:
```bash
pnpm test:run src/hooks/useChat.test.ts
```

Expected: TypeScript compile error or runtime error — `renameConversation` is not on the hook's return shape yet.

- [ ] **Step 3: Add `renameConversation` to `src/hooks/useChat.ts`**

Open `src/hooks/useChat.ts`. After the `clearAllConversations` definition (added in Task 2), add another callback. Then update the return object to include `renameConversation`.

**Edit A:** Add the callback. After the closing `[persist, switchConversation]` array of `clearAllConversations`, insert:

```typescript
  const renameConversation = useCallback(
    (id: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      const updated = conversations.map((c) =>
        c.id === id ? { ...c, title: trimmed } : c
      );
      persist(updated);
    },
    [conversations, persist]
  );
```

**Edit B:** Update the return statement. After Task 2, the return reads:

```typescript
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
  };
```

Add `renameConversation`:

```typescript
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
  };
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run:
```bash
pnpm test:run src/hooks/useChat.test.ts
```

Expected: All useChat tests pass, including the 2 new `renameConversation` tests.

- [ ] **Step 5: Update `src/components/Sidebar.tsx` — add hover-pencil + inline edit**

Open `src/components/Sidebar.tsx`. Make these changes:

**Edit A:** Update imports + Props interface. After Task 2, the file has:

```typescript
import React, { useState } from 'react';
import type { Conversation } from '../types';

interface Props {
  conversations: Conversation[];
  activeId: string;
  isOpen: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onClearAll: () => void;
}
```

Add `onRename`:

```typescript
import React, { useState } from 'react';
import type { Conversation } from '../types';

interface Props {
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
```

**Edit B:** Update the component signature + state + commit/cancel helpers. The current top of the component (after Task 2) reads:

```typescript
export default function Sidebar({
  conversations,
  activeId,
  isOpen,
  onSelect,
  onNew,
  onDelete,
  onClose,
  onClearAll,
}: Props) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleClearAll = () => {
    setIsSettingsOpen(false);
    if (window.confirm('Clear all conversations? This cannot be undone.')) {
      onClearAll();
    }
  };
```

Replace with:

```typescript
export default function Sidebar({
  conversations,
  activeId,
  isOpen,
  onSelect,
  onNew,
  onDelete,
  onClose,
  onClearAll,
  onRename,
}: Props) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const handleClearAll = () => {
    setIsSettingsOpen(false);
    if (window.confirm('Clear all conversations? This cannot be undone.')) {
      onClearAll();
    }
  };

  const startRename = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditingTitle(conv.title);
  };

  const commitRename = () => {
    if (!editingId) return;
    const trimmed = editingTitle.trim();
    if (trimmed) onRename(editingId, trimmed);
    setEditingId(null);
    setEditingTitle('');
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditingTitle('');
  };
```

**Edit C:** Update the per-row render. The current row JSX (after Task 2; matches the file's lines 71-110 structure pre-change) reads:

```typescript
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`
                group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-colors
                ${
                  conv.id === activeId
                    ? 'bg-kami-accent/15 text-white'
                    : 'text-kami-muted hover:bg-kami-border/30 hover:text-kami-text'
                }
              `}
              onClick={() => onSelect(conv.id)}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
              <span className="flex-1 truncate">{conv.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(conv.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-kami-muted hover:text-kami-danger transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          ))}
```

Replace with:

```typescript
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`
                group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-colors
                ${
                  conv.id === activeId
                    ? 'bg-kami-accent/15 text-white'
                    : 'text-kami-muted hover:bg-kami-border/30 hover:text-kami-text'
                }
              `}
              onClick={() => onSelect(conv.id)}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
              {editingId === conv.id ? (
                <input
                  autoFocus
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitRename();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      cancelRename();
                    }
                  }}
                  onBlur={commitRename}
                  onClick={(e) => e.stopPropagation()}
                  maxLength={60}
                  aria-label="Rename conversation"
                  className="flex-1 min-w-0 bg-transparent border border-kami-border rounded px-1 py-0.5 text-sm text-white focus:outline-none focus:border-kami-accent"
                />
              ) : (
                <span className="flex-1 truncate">{conv.title}</span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startRename(conv);
                }}
                aria-label="Rename conversation"
                className="opacity-0 group-hover:opacity-100 p-1 text-kami-muted hover:text-white transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(conv.id);
                }}
                aria-label="Delete conversation"
                className="opacity-0 group-hover:opacity-100 p-1 text-kami-muted hover:text-kami-danger transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          ))}
```

(The pencil icon SVG path is the standard Heroicons "pencil-square" outline. Both action buttons gain `aria-label` attributes for testability.)

- [ ] **Step 6: Update `src/App.tsx` — destructure renameConversation and pass to Sidebar**

Open `src/App.tsx`. After Task 2, the destructure reads:

```typescript
  const {
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
  } = useChat();
```

Add `renameConversation`:

```typescript
  const {
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
  } = useChat();
```

Then the existing `<Sidebar ... />` render now includes `onClearAll` (added Task 2). Add `onRename`:

```typescript
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        isOpen={sidebarOpen}
        onSelect={(id) => {
          switchConversation(id);
          setSidebarOpen(false);
        }}
        onNew={() => {
          newConversation();
          setSidebarOpen(false);
        }}
        onDelete={deleteConversation}
        onClose={() => setSidebarOpen(false)}
        onClearAll={clearAllConversations}
        onRename={renameConversation}
      />
```

- [ ] **Step 7: Extend `src/components/Sidebar.test.tsx` with the 3 rename tests**

Open `src/components/Sidebar.test.tsx`. The file (after Task 2) has the 2 settings tests inside `describe('Sidebar settings menu', ...)`. Update the noopProps object to include `onRename`, then append a new describe block.

**Edit A:** Update `noopProps` to include `onRename`:

```typescript
const noopProps = {
  conversations: sampleConvs,
  activeId: 'c1',
  isOpen: true,
  onSelect: vi.fn(),
  onNew: vi.fn(),
  onDelete: vi.fn(),
  onClose: vi.fn(),
  onClearAll: vi.fn(),
  onRename: vi.fn(),
};
```

**Edit B:** Append the new describe block at the end of the file:

```typescript
describe('Sidebar rename', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('switches the row to an inline input when the pencil is clicked', () => {
    render(<Sidebar {...noopProps} />);

    expect(screen.queryByRole('textbox', { name: /rename conversation/i })).not.toBeInTheDocument();

    const pencilButtons = screen.getAllByRole('button', { name: /rename conversation/i });
    fireEvent.click(pencilButtons[0]);

    const input = screen.getByRole('textbox', { name: /rename conversation/i });
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('first chat');
  });

  it('calls onRename and commits when Enter is pressed', () => {
    const onRename = vi.fn();
    render(<Sidebar {...noopProps} onRename={onRename} />);

    const pencilButtons = screen.getAllByRole('button', { name: /rename conversation/i });
    fireEvent.click(pencilButtons[0]);

    const input = screen.getByRole('textbox', { name: /rename conversation/i });
    fireEvent.change(input, { target: { value: 'updated title' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onRename).toHaveBeenCalledWith('c1', 'updated title');
    expect(screen.queryByRole('textbox', { name: /rename conversation/i })).not.toBeInTheDocument();
  });

  it('cancels without calling onRename when Escape is pressed', () => {
    const onRename = vi.fn();
    render(<Sidebar {...noopProps} onRename={onRename} />);

    const pencilButtons = screen.getAllByRole('button', { name: /rename conversation/i });
    fireEvent.click(pencilButtons[0]);

    const input = screen.getByRole('textbox', { name: /rename conversation/i });
    fireEvent.change(input, { target: { value: 'changed but cancelled' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox', { name: /rename conversation/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 8: Run the full gate set**

Run:
```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p server/tsconfig.json --noEmit
pnpm test:run
```

Expected: All commands silent. Test count: 168 → 173 across 20 files (Sidebar.test.tsx gains +3 tests; useChat.test.ts gains +2 tests).

- [ ] **Step 9: Commit**

```bash
git add src/hooks/useChat.ts src/hooks/useChat.test.ts src/components/Sidebar.tsx src/components/Sidebar.test.tsx src/App.tsx
git commit -m "$(cat <<'EOF'
feat(sidebar): add hover-pencil rename for individual conversations

A hover-revealed pencil icon alongside the existing trash icon switches the
row title into an inline input. Enter commits via the new renameConversation
useChat callback; Escape cancels; blur commits. Empty/whitespace titles are
silently rejected. maxLength=60 matches the auto-title's character budget.

Tests cover the inline-input toggle, Enter commit, Escape cancel, and the
hook's title-update + empty-rejection contract.

Closes #23
EOF
)"
```

---

## Final verification — full PR readiness

- [ ] **Step 1: Verify the 4-commit shape**

Run:
```bash
git log --oneline main..HEAD
```

Expected output (commit hashes will differ):
```
<hash> feat(sidebar): add hover-pencil rename for individual conversations
<hash> feat(sidebar): add settings menu with bulk-clear conversations
<hash> fix(chat): inline waiting dots inside empty assistant bubble
<hash> docs(spec): add Sprint 4.2b P2 UI features design
```

(4 commits total: 1 spec + 3 implementation.)

- [ ] **Step 2: Run the full gate set one more time**

Run:
```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p server/tsconfig.json --noEmit
pnpm test:run
```

Expected: silent / silent / 173 tests passing across 20 files.

- [ ] **Step 3: File the out-of-scope discovery as a separate GitHub issue**

The Chrome MCP verification surfaced a related-but-separate bug: empty assistant messages persist in conversation state when streams are aborted. Open a new GitHub issue documenting it (so the discovery doesn't get lost when the PR ships).

```bash
gh issue create --title "[D-26] Empty assistant message persists when stream is aborted before first token" --body "$(cat <<'EOF'
**Discovered during Sprint 4.2b Chrome MCP verification** (PR for #23 + #24).

## Issue

When the user submits a query, \`useChat.ts:131-150\` pushes BOTH the user message AND an empty assistant message into the conversation array BEFORE streaming starts. If the stream is then aborted (via the in-input stop button, or via \`switchConversation\`/\`deleteConversation\`), the empty assistant message stays in the conversation array forever.

**Visible in production:** opening any old chat shows orphan K avatars with no content beside them — one per aborted stream.

## Repro

1. Open https://kami.rectorspace.com
2. Submit any query
3. Click the stop button BEFORE the first token arrives (~2s window)
4. Observe: the user message stays visible; an orphan K avatar persists alongside it
5. Switch to another conversation and back — the orphan stays

## Suggested fix (needs brainstorm)

Two reasonable approaches, neither obviously correct without more thought:

- **A:** Delete the empty assistant message on abort. Simple but loses the breadcrumb that "the user asked X but it was interrupted."
- **B:** Replace the empty content with a placeholder string (e.g., \"_Stream interrupted._\") so the row remains visually meaningful. Slightly more work; preserves history.

## Files

- \`src/hooks/useChat.ts:131-150\` (push empty assistant message)
- \`src/hooks/useChat.ts:86-90\` (switchConversation aborts)
- \`src/hooks/useChat.ts:100-118\` (deleteConversation aborts)
- \`src/hooks/useChat.ts:300-303\` (stopStreaming)

## Effort

~1-2h once the brainstorm picks an approach.

## Tracked by

Not part of the 2026-04-26 QA umbrella (#3) — discovered later. Stand-alone issue.
EOF
)"
```

(The exact issue number will be assigned by GitHub. Capture it for reference in the PR body.)

- [ ] **Step 4: Push branch and open PR**

```bash
git push -u origin feat/p2-ui-features
gh pr create --title "feat: P2 UI features — chat-shell polish (thinking indicator + sidebar bulk-clear/rename)" --body "$(cat <<'EOF'
## Summary

Sprint 4.2b — clears the remaining 2 P2 items in the \`qa-2026-04-26\` backlog (UI features sub-cluster). Server-hygiene sub-cluster (#16-#22) shipped in Sprint 4.2a / PR #38.

Three sub-changes:

- **#24 thinking indicator (commit 1):** Inline the 3 pulsing dots into the empty assistant message bubble. Eliminates the dual-K-avatar layout bug (verified live via Chrome MCP — two stacked avatars during the time-to-first-token gap). Single K avatar carries through the entire message lifecycle. \`TypingIndicator.tsx\` deleted (no callers).
- **#23 bulk-clear (commit 2):** Settings gear icon in the sidebar header opens a popover with "Clear all conversations". Native \`confirm()\` dialog gates the irreversible action; on confirm, the new \`clearAllConversations()\` useChat callback wipes the array and creates one fresh empty conversation.
- **#23 rename (commit 3):** Hover-revealed pencil icon alongside the existing trash. Click switches the row title into an inline input — Enter commits via the new \`renameConversation()\` useChat callback, Escape cancels, blur commits. Empty/whitespace titles silently rejected. \`maxLength=60\`.

## Test plan

- 10 new tests across 3 test files (\`ChatMessage.test.tsx\` +2, \`useChat.test.ts\` +3, \`Sidebar.test.tsx\` NEW +5)
- \`pnpm test:run\`: 163 → 173 across 19 → 20 files
- TDD red → green on all 3 tasks
- [ ] Manual smoke post-deploy: confirm single K avatar with dots during gap, then dots replaced by streaming text on first token (#24)
- [ ] Manual smoke post-deploy: settings gear → Clear all → confirm dialog → fresh empty conversation (#23 bulk-clear)
- [ ] Manual smoke post-deploy: hover row → pencil → edit title → Enter → reload → confirm new title persists (#23 rename)

## Out-of-scope discovery filed as separate issue

Chrome MCP verification surfaced a related bug: empty assistant messages persist in conversation state when streams are aborted before the first token. Filed as a separate issue (linked in commit 1's reference). NOT bundled here — needs its own brainstorm to decide between "delete on abort" and "stream-interrupted placeholder."

Closes #23
Closes #24
EOF
)"
```

- [ ] **Step 5: Watch CI**

Run:
```bash
gh pr checks --watch
```

Expected: green across `test`, `mirror-gitlab`, and any other configured checks.

- [ ] **Step 6: Tick umbrella issue #3's P2 UI-features row after PR merges**

After merge, edit `gh issue view 3` to tick \`#23\` and \`#24\` checkboxes in the P2 section. The umbrella issue's P2 row will then be fully cleared (server-hygiene already ticked from PR #38).

---

## Notes for the executing engineer

- **`pnpm exec tsc -b` does NOT validate `server/tsconfig.json`.** Always run all 3 typecheck commands separately. (Memory: `tsc-b-skips-server-tsconfig.md`.) None of Task 2/3's changes touch server code, but the gate set protocol is unchanged.
- **`Array.prototype.at()` does NOT work in `src/`** (ES2020 lib target). Use `arr[arr.length - 1]`. None of the current tasks need this — flagged for awareness.
- **HEREDOC commit messages** per global CLAUDE.md. No AI attribution in any commit, comment, or PR body.
- **One commit per logical change.** Each task ends in exactly one commit. If a task fails the gate set, fix and re-stage before committing — do NOT amend the prior task's commit.
- **`Sidebar.test.tsx` is new in Task 2.** Task 3 extends it. The plan already accounts for this — Task 2's commit creates the file with 2 tests; Task 3's commit appends 3 tests. Both commits include the file in their `git add`.
- **`window.confirm()` works in jsdom** (the default Vitest browser environment for `.test.tsx` files). The Sidebar test mocks `window.confirm` via `vi.spyOn`. No special setup needed.
- **Aria labels on the action buttons** make the rename and delete tests robust against icon-only buttons. The existing trash icon was previously unlabeled — this task adds `aria-label` to BOTH the rename pencil and the delete trash for symmetry.
