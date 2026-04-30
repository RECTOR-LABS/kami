# Kami chat-shell amber redesign — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the post-connect chat shell as a coherent extension of the bento+amber landing — three-tier folder structure (`bento/` + `landing/` + `chat/`), 13 new chat primitives, 6 legacy components deleted, no business-logic changes.

**Architecture:** Three-tier folder structure with `bento/BentoCell` and `bento/KamiCursor` as shared design-system primitives consumed by both `landing/*` and new `chat/*` components. `BentoCell` extended with `variant` (`'full' | 'compact' | 'mini'`) + `animate?` props, defaults preserve current landing behavior. `WalletPill` replaces `WalletMultiButton`; `TxStatusCard` replaces `SignTransactionCard` (same business logic, new chrome). 10 sequential commits, each shipping a green build.

**Tech Stack:** Vite + React 18 + TypeScript + Tailwind, Vitest 4.x + React Testing Library + happy-dom, `@solana/wallet-adapter-react`, `lucide-react` icons.

**Spec:** `docs/superpowers/specs/2026-04-29-kami-chat-shell-amber-design.md`

---

## Task 1: Set up `bento/` folder structure + extend `BentoCell`

**Files:**
- Create: `src/components/bento/BentoCell.tsx` (moved from `src/components/landing/BentoCell.tsx`)
- Create: `src/components/bento/BentoCell.test.tsx` (moved from `src/components/landing/BentoCell.test.tsx`)
- Create: `src/components/bento/KamiCursor.tsx` (moved from `src/components/landing/KamiCursor.tsx`)
- Create: `src/components/bento/KamiCursor.test.tsx` (moved from `src/components/landing/KamiCursor.test.tsx`)
- Delete: the 4 source files in `landing/`
- Modify: `src/components/landing/HeroCell.tsx` (line 2: import path)
- Modify: `src/components/landing/SysMetricsCell.tsx` (import path)
- Modify: `src/components/landing/LatestTxCell.tsx` (import path)
- Modify: `src/components/landing/ToolCell.tsx` (import path)
- Modify: `src/components/landing/PipelineCell.tsx` (import path)

- [ ] **Step 1.1: Move files via git mv (preserves history)**

```bash
cd /Users/rector/local-dev/kami
mkdir -p src/components/bento
git mv src/components/landing/BentoCell.tsx src/components/bento/BentoCell.tsx
git mv src/components/landing/BentoCell.test.tsx src/components/bento/BentoCell.test.tsx
git mv src/components/landing/KamiCursor.tsx src/components/bento/KamiCursor.tsx
git mv src/components/landing/KamiCursor.test.tsx src/components/bento/KamiCursor.test.tsx
```

- [ ] **Step 1.2: Update import paths in 5 landing files**

In `src/components/landing/HeroCell.tsx`, change:
```typescript
import BentoCell from './BentoCell';
import KamiCursor from './KamiCursor';
```
to:
```typescript
import BentoCell from '../bento/BentoCell';
import KamiCursor from '../bento/KamiCursor';
```

Apply the same `'./BentoCell'` → `'../bento/BentoCell'` and `'./KamiCursor'` → `'../bento/KamiCursor'` rewrite in:
- `src/components/landing/SysMetricsCell.tsx`
- `src/components/landing/LatestTxCell.tsx`
- `src/components/landing/ToolCell.tsx`
- `src/components/landing/PipelineCell.tsx`

(SponsorStrip.tsx does NOT import BentoCell — it uses Fragment. Skip it.)

- [ ] **Step 1.3: Run all 3 typecheck commands**

```bash
pnpm exec tsc --noEmit                                  # client
pnpm exec tsc -p server/tsconfig.json --noEmit          # server (sanity)
pnpm exec tsc -b                                        # project mode
```

Expected: all silent (no output).

- [ ] **Step 1.4: Run tests, verify the 226 still pass**

```bash
pnpm test:run
```

Expected output: `Test Files  31 passed (31)` and `Tests  226 passed (226)`.

- [ ] **Step 1.5: Write failing tests for the new BentoCell variants**

Append to `src/components/bento/BentoCell.test.tsx`:

```tsx
  it('applies full variant defaults (rounded-3xl + p-6 lg:p-8)', () => {
    render(
      <BentoCell delay={1} variant="full">
        <span>variant-full</span>
      </BentoCell>
    );
    const cell = screen.getByText('variant-full').parentElement!;
    expect(cell.className).toMatch(/rounded-3xl/);
    expect(cell.className).toMatch(/p-6/);
    expect(cell.className).toMatch(/lg:p-8/);
    expect(cell.className).toMatch(/animate-cascade-up/);
  });

  it('applies compact variant (rounded-3xl + p-4 lg:p-5 + 600ms cascade)', () => {
    render(
      <BentoCell delay={1} variant="compact">
        <span>variant-compact</span>
      </BentoCell>
    );
    const cell = screen.getByText('variant-compact').parentElement!;
    expect(cell.className).toMatch(/rounded-3xl/);
    expect(cell.className).toMatch(/p-4/);
    expect(cell.className).toMatch(/lg:p-5/);
    expect(cell.className).toMatch(/animate-cascade-up-compact/);
  });

  it('applies mini variant (rounded-2xl + p-3, no cascade by default)', () => {
    render(
      <BentoCell delay={1} variant="mini">
        <span>variant-mini</span>
      </BentoCell>
    );
    const cell = screen.getByText('variant-mini').parentElement!;
    expect(cell.className).toMatch(/rounded-2xl/);
    expect(cell.className).toMatch(/p-3/);
    expect(cell.className).not.toMatch(/animate-cascade-up/);
  });

  it('animate=false skips cascade-up class regardless of variant', () => {
    render(
      <BentoCell delay={1} variant="full" animate={false}>
        <span>no-anim</span>
      </BentoCell>
    );
    const cell = screen.getByText('no-anim').parentElement!;
    expect(cell.className).not.toMatch(/animate-cascade-up/);
  });

  it('animate=true on mini explicitly opts into cascade animation', () => {
    render(
      <BentoCell delay={1} variant="mini" animate={true}>
        <span>opt-in-anim</span>
      </BentoCell>
    );
    const cell = screen.getByText('opt-in-anim').parentElement!;
    expect(cell.className).toMatch(/animate-cascade-up-mini/);
  });

  it('default variant is full when prop omitted (back-compat)', () => {
    render(
      <BentoCell delay={1}>
        <span>default</span>
      </BentoCell>
    );
    const cell = screen.getByText('default').parentElement!;
    expect(cell.className).toMatch(/rounded-3xl/);
    expect(cell.className).toMatch(/p-6/);
    expect(cell.className).toMatch(/animate-cascade-up/);
  });
```

- [ ] **Step 1.6: Run tests to verify the 6 new ones fail**

```bash
pnpm test:run -- src/components/bento/BentoCell.test.tsx
```

Expected: 6 failures matching the new test names.

- [ ] **Step 1.7: Extend `BentoCell.tsx` with variant + animate props**

Replace the entire `src/components/bento/BentoCell.tsx` with:

```tsx
import React from 'react';

type Variant = 'full' | 'compact' | 'mini';

interface Props {
  delay: number;
  variant?: Variant;
  animate?: boolean;
  className?: string;
  children: React.ReactNode;
  as?: 'div' | 'section' | 'article';
}

const VARIANT_CLASSES: Record<Variant, string> = {
  full: 'rounded-3xl p-6 lg:p-8',
  compact: 'rounded-3xl p-4 lg:p-5',
  mini: 'rounded-2xl p-3',
};

const ANIMATION_CLASSES: Record<Variant, string> = {
  full: 'animate-cascade-up',
  compact: 'animate-cascade-up-compact',
  mini: 'animate-cascade-up-mini',
};

const VARIANT_DEFAULTS_ANIMATE: Record<Variant, boolean> = {
  full: true,
  compact: true,
  mini: false,
};

export default function BentoCell({
  delay,
  variant = 'full',
  animate,
  className = '',
  children,
  as: Component = 'div',
}: Props) {
  const shouldAnimate = animate ?? VARIANT_DEFAULTS_ANIMATE[variant];

  return (
    <Component
      style={{ animationDelay: `${delay * 100}ms` }}
      className={[
        'relative overflow-hidden',
        VARIANT_CLASSES[variant],
        'bg-kami-cellBase border border-kami-cellBorder',
        'transition-all duration-500 ease-smooth',
        'hover:-translate-y-[2px] hover:border-kami-amber/40',
        'hover:shadow-[0_10px_40px_-20px_rgba(255,165,0,0.15)]',
        shouldAnimate ? ANIMATION_CLASSES[variant] : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </Component>
  );
}
```

- [ ] **Step 1.8: Add the new keyframes + animations to `tailwind.config.js`**

In `tailwind.config.js`, find the `keyframes` object and confirm it already contains `'cascade-up'`. The existing animation entry is:

```js
animation: {
  'cascade-up': 'cascade-up 800ms cubic-bezier(0.175, 0.885, 0.32, 1.275) backwards',
  ...
}
```

Add two new animation entries (same keyframe, different durations) so `animate-cascade-up-compact` and `animate-cascade-up-mini` are emitted by Tailwind:

```js
animation: {
  'cascade-up': 'cascade-up 800ms cubic-bezier(0.175, 0.885, 0.32, 1.275) backwards',
  'cascade-up-compact': 'cascade-up 600ms cubic-bezier(0.175, 0.885, 0.32, 1.275) backwards',
  'cascade-up-mini': 'cascade-up 400ms cubic-bezier(0.175, 0.885, 0.32, 1.275) backwards',
  blink: 'blink 1s step-end infinite',
  'pulse-dot': 'pulse-dot 2s ease-out infinite',
},
```

- [ ] **Step 1.9: Run tests to verify all 232 pass**

```bash
pnpm test:run
```

Expected: `Tests  232 passed (232)` (was 226, +6 new).

- [ ] **Step 1.10: Run all 3 typecheck commands + build**

```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p server/tsconfig.json --noEmit
pnpm exec tsc -b
pnpm build
```

Expected: all silent / build success.

- [ ] **Step 1.11: Commit**

```bash
git add src/components/bento/ src/components/landing/HeroCell.tsx src/components/landing/SysMetricsCell.tsx src/components/landing/LatestTxCell.tsx src/components/landing/ToolCell.tsx src/components/landing/PipelineCell.tsx tailwind.config.js
git commit -m "$(cat <<'EOF'
feat(bento): extract BentoCell + KamiCursor as shared design-system primitives

Move BentoCell + KamiCursor from src/components/landing/ to
src/components/bento/. Both are not landing-specific — they are
design-system primitives consumed by future chat/ components as well.
Naming the folder bento/ keeps the design-language signal loud at every
import site.

Update 5 landing/ imports (HeroCell, SysMetricsCell, LatestTxCell,
ToolCell, PipelineCell) to point at ../bento/. SponsorStrip uses Fragment
and needs no update.

Extend BentoCell with two new props for chat-shell consumers:

  variant?: 'full' | 'compact' | 'mini'   (default 'full' for back-compat)
  animate?: boolean                        (default per variant)

Variant rules:
  full    rounded-3xl p-6 lg:p-8   cascade-up 800ms (default true)
  compact rounded-3xl p-4 lg:p-5   cascade-up 600ms (default true)
  mini    rounded-2xl p-3          no cascade       (default false)

Add 'cascade-up-compact' (600ms) and 'cascade-up-mini' (400ms) animations
to tailwind.config.js, both reusing the existing 'cascade-up' keyframe.

+6 BentoCell tests covering the 3 variants + animate prop interactions.
Tests 226 -> 232. Client + server typecheck silent. tsc -b silent.
Build succeeds.
EOF
)"
```

---

## Task 2: Atomic chat primitives — `SuggestionChip`, `ToolBadge`, `KeyValueRows`, `groupToolCalls`

**Files:**
- Create: `src/components/chat/SuggestionChip.tsx`
- Create: `src/components/chat/SuggestionChip.test.tsx`
- Create: `src/components/chat/ToolBadge.tsx`
- Create: `src/components/chat/ToolBadge.test.tsx`
- Create: `src/components/chat/KeyValueRows.tsx`
- Create: `src/components/chat/KeyValueRows.test.tsx`
- Create: `src/components/chat/groupToolCalls.ts`
- Create: `src/components/chat/groupToolCalls.test.ts`

- [ ] **Step 2.1: Create the chat/ directory and write `SuggestionChip.test.tsx`**

```bash
mkdir -p src/components/chat
```

Create `src/components/chat/SuggestionChip.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SuggestionChip from './SuggestionChip';

describe('SuggestionChip', () => {
  it('renders the label', () => {
    render(<SuggestionChip label="Show me my Kamino portfolio" onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: /show me my kamino portfolio/i })).toBeInTheDocument();
  });

  it('fires onClick when clicked', () => {
    const onClick = vi.fn();
    render(<SuggestionChip label="hello" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: /hello/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2.2: Run test to verify it fails (component does not exist yet)**

```bash
pnpm test:run -- src/components/chat/SuggestionChip.test.tsx
```

Expected: import error / test failure (component file does not exist).

- [ ] **Step 2.3: Implement `SuggestionChip.tsx`**

Create `src/components/chat/SuggestionChip.tsx`:

```tsx
interface Props {
  label: string;
  onClick: () => void;
}

export default function SuggestionChip({ label, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full border border-kami-cellBorder font-mono text-kami-creamMuted hover:text-kami-amber hover:border-kami-amber/40 hover:bg-kami-amberHaze transition-colors whitespace-nowrap"
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 2.4: Run test to verify it passes**

```bash
pnpm test:run -- src/components/chat/SuggestionChip.test.tsx
```

Expected: `Tests  2 passed (2)`.

- [ ] **Step 2.5: Write `ToolBadge.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ToolBadge from './ToolBadge';

describe('ToolBadge', () => {
  it('renders the tool name', () => {
    render(<ToolBadge name="tool/findYield" status="success" />);
    expect(screen.getByText('tool/findYield')).toBeInTheDocument();
  });

  it('renders Loader2 icon for running status', () => {
    const { container } = render(<ToolBadge name="tool/x" status="running" />);
    expect(container.querySelector('svg')).toBeTruthy();
    // Loader2 from lucide-react has a `lucide-loader-2` class
    expect(container.innerHTML).toMatch(/lucide-loader/i);
  });

  it('renders CheckCircle icon for success status', () => {
    const { container } = render(<ToolBadge name="tool/x" status="success" />);
    expect(container.innerHTML).toMatch(/lucide-check-circle/i);
  });

  it('omits ×N suffix when count is 1 or undefined', () => {
    render(<ToolBadge name="tool/x" status="success" count={1} />);
    expect(screen.queryByText(/×/)).not.toBeInTheDocument();
  });

  it('renders ×N suffix when count is greater than 1', () => {
    render(<ToolBadge name="tool/x" status="success" count={3} />);
    expect(screen.getByText('×3')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2.6: Run test to verify failure, then implement `ToolBadge.tsx`**

```bash
pnpm test:run -- src/components/chat/ToolBadge.test.tsx
```

Expected: import error.

Create `src/components/chat/ToolBadge.tsx`:

```tsx
import { Loader2, CheckCircle, AlertCircle, Wallet } from 'lucide-react';

type Status = 'running' | 'success' | 'error' | 'wallet-required';

interface Props {
  name: string;
  status: Status;
  count?: number;
}

const STATUS_ICONS: Record<Status, typeof Loader2> = {
  running: Loader2,
  success: CheckCircle,
  error: AlertCircle,
  'wallet-required': Wallet,
};

const STATUS_ICON_CLASS: Record<Status, string> = {
  running: 'w-3 h-3 animate-spin',
  success: 'w-3 h-3',
  error: 'w-3 h-3',
  'wallet-required': 'w-3 h-3',
};

export default function ToolBadge({ name, status, count }: Props) {
  const Icon = STATUS_ICONS[status];
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-kami-amber/40 bg-kami-amber/8 text-kami-amber font-mono text-[11px]">
      <Icon className={STATUS_ICON_CLASS[status]} aria-hidden="true" />
      <span>{name}</span>
      {count !== undefined && count > 1 && <span className="opacity-70">×{count}</span>}
    </span>
  );
}
```

Run: `pnpm test:run -- src/components/chat/ToolBadge.test.tsx`. Expected: 5 passed.

- [ ] **Step 2.7: Write `KeyValueRows.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import KeyValueRows from './KeyValueRows';

describe('KeyValueRows', () => {
  it('renders each row with key and value', () => {
    render(
      <KeyValueRows
        rows={[
          { key: 'supply.apy', value: '8.4%' },
          { key: 'borrow.apr', value: '9.1%' },
        ]}
      />
    );
    expect(screen.getByText('supply.apy')).toBeInTheDocument();
    expect(screen.getByText('8.4%')).toBeInTheDocument();
    expect(screen.getByText('borrow.apr')).toBeInTheDocument();
    expect(screen.getByText('9.1%')).toBeInTheDocument();
  });

  it('applies amber accent class when accent="amber"', () => {
    render(<KeyValueRows rows={[{ key: 'k', value: 'v', accent: 'amber' }]} />);
    expect(screen.getByText('v').className).toMatch(/text-kami-amber/);
  });

  it('renders empty state when rows is empty array', () => {
    const { container } = render(<KeyValueRows rows={[]} />);
    expect(container.firstChild).toBeTruthy();
    expect(container.querySelectorAll('div[class*="font-mono"]').length).toBe(0);
  });
});
```

- [ ] **Step 2.8: Verify failure, implement `KeyValueRows.tsx`**

```bash
pnpm test:run -- src/components/chat/KeyValueRows.test.tsx
```

Expected: import error.

Create `src/components/chat/KeyValueRows.tsx`:

```tsx
type Accent = 'amber' | 'cream' | 'muted';

interface Row {
  key: string;
  value: string;
  accent?: Accent;
}

interface Props {
  rows: Row[];
}

const ACCENT_CLASS: Record<Accent, string> = {
  amber: 'text-kami-amber',
  cream: 'text-kami-cream',
  muted: 'text-kami-creamMuted',
};

export default function KeyValueRows({ rows }: Props) {
  return (
    <div className="bg-kami-cellElevated border border-kami-cellBorder rounded-2xl p-3">
      {rows.map((row, i) => (
        <div
          key={row.key}
          className={[
            'flex justify-between items-center py-1.5 font-mono text-xs',
            i < rows.length - 1 ? 'border-b border-kami-cellBorder/50' : '',
          ].join(' ')}
        >
          <span className="text-kami-creamMuted">{row.key}</span>
          <span className={ACCENT_CLASS[row.accent ?? 'cream']}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}
```

Run: `pnpm test:run -- src/components/chat/KeyValueRows.test.tsx`. Expected: 3 passed.

- [ ] **Step 2.9: Write `groupToolCalls.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { groupToolCalls } from './groupToolCalls';
import type { ToolCall } from '../../types';

describe('groupToolCalls', () => {
  const mk = (name: string, status: ToolCall['status']): ToolCall => ({
    id: `${name}-${status}`,
    name,
    status,
    input: {},
  });

  it('returns empty array for empty input', () => {
    expect(groupToolCalls([])).toEqual([]);
  });

  it('passes through unique calls without count suffix', () => {
    const calls = [mk('tool/a', 'success'), mk('tool/b', 'success')];
    expect(groupToolCalls(calls)).toEqual([
      { name: 'tool/a', status: 'success', count: 1 },
      { name: 'tool/b', status: 'success', count: 1 },
    ]);
  });

  it('groups consecutive duplicate calls with count', () => {
    const calls = [
      mk('tool/a', 'success'),
      mk('tool/a', 'success'),
      mk('tool/a', 'success'),
    ];
    expect(groupToolCalls(calls)).toEqual([{ name: 'tool/a', status: 'success', count: 3 }]);
  });

  it('preserves order across distinct call names', () => {
    const calls = [mk('tool/b', 'running'), mk('tool/a', 'success')];
    const result = groupToolCalls(calls);
    expect(result.map((r) => r.name)).toEqual(['tool/b', 'tool/a']);
  });
});
```

- [ ] **Step 2.10: Verify failure, implement `groupToolCalls.ts`**

```bash
pnpm test:run -- src/components/chat/groupToolCalls.test.ts
```

Expected: import error.

Create `src/components/chat/groupToolCalls.ts`:

```typescript
import type { ToolCall } from '../../types';

interface GroupedCall {
  name: string;
  status: ToolCall['status'];
  count: number;
}

export function groupToolCalls(calls: ToolCall[]): GroupedCall[] {
  if (calls.length === 0) return [];
  const result: GroupedCall[] = [];
  for (const call of calls) {
    const last = result[result.length - 1];
    if (last && last.name === call.name && last.status === call.status) {
      last.count += 1;
    } else {
      result.push({ name: call.name, status: call.status, count: 1 });
    }
  }
  return result;
}
```

Run: `pnpm test:run -- src/components/chat/groupToolCalls.test.ts`. Expected: 4 passed.

- [ ] **Step 2.11: Run full test suite + typecheck + build**

```bash
pnpm test:run                                           # expect 232 + 14 = 246 passed
pnpm exec tsc --noEmit
pnpm exec tsc -p server/tsconfig.json --noEmit
pnpm exec tsc -b
pnpm build
```

- [ ] **Step 2.12: Commit**

```bash
git add src/components/chat/
git commit -m "$(cat <<'EOF'
feat(chat): atomic primitives — SuggestionChip, ToolBadge, KeyValueRows, groupToolCalls

Four atomic primitives in the new chat/ folder, plus a pure utility:

  SuggestionChip — rounded-full pill, cellBorder, mono 12px, hover amber
  ToolBadge — single tool-call pill with status-keyed icon (Loader2 for
    running / CheckCircle for success / AlertCircle for error / Wallet for
    wallet-required) + optional ×N count suffix
  KeyValueRows — cellElevated sub-card with mono key/value rows (pattern
    extracted from landing/SysMetricsCell)
  groupToolCalls — pure helper deduping consecutive same-name same-status
    calls into { name, status, count }, preserving order across distinct
    names. Lifted from current ToolCallBadges.tsx (Day-12 logic).

Standalone — no consumer wiring yet. +14 tests across 4 files.
Tests 232 -> 246. Client + server typecheck silent. Build succeeds.
EOF
)"
```

---

## Task 3: `WalletPill` + amber modal CSS

**Files:**
- Create: `src/components/chat/WalletPill.tsx`
- Create: `src/components/chat/WalletPill.test.tsx`
- Modify: `src/components/WalletProvider.tsx` (replace purple modal CSS with amber)

- [ ] **Step 3.1: Write `WalletPill.test.tsx`**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const disconnect = vi.fn();
const writeText = vi.fn();
const open = vi.fn();

const wallet = vi.hoisted(() => ({
  connected: true,
  publicKey: { toBase58: () => 'HclZ8AaB12345678901234567890123456789012345' },
  disconnect: vi.fn(),
}));

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => wallet,
}));

import WalletPill from './WalletPill';

describe('WalletPill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wallet.connected = true;
    wallet.disconnect = disconnect;
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    vi.spyOn(window, 'open').mockImplementation(open);
  });

  it('renders truncated pubkey when connected', () => {
    render(<WalletPill />);
    expect(screen.getByText(/HclZ.*45/)).toBeInTheDocument();
  });

  it('opens dropdown when pill is clicked', () => {
    render(<WalletPill />);
    fireEvent.click(screen.getByRole('button', { name: /wallet/i }));
    expect(screen.getByRole('menuitem', { name: /copy address/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /solscan/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /disconnect/i })).toBeInTheDocument();
  });

  it('copies pubkey when "Copy address" is clicked', () => {
    render(<WalletPill />);
    fireEvent.click(screen.getByRole('button', { name: /wallet/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /copy address/i }));
    expect(writeText).toHaveBeenCalledWith('HclZ8AaB12345678901234567890123456789012345');
  });

  it('opens Solscan in new tab when "View on Solscan" is clicked', () => {
    render(<WalletPill />);
    fireEvent.click(screen.getByRole('button', { name: /wallet/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /solscan/i }));
    expect(open).toHaveBeenCalledWith(
      'https://solscan.io/account/HclZ8AaB12345678901234567890123456789012345',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('calls wallet.disconnect when "Disconnect" is clicked', () => {
    render(<WalletPill />);
    fireEvent.click(screen.getByRole('button', { name: /wallet/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /disconnect/i }));
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3.2: Verify failure, implement `WalletPill.tsx`**

Create `src/components/chat/WalletPill.tsx`:

```tsx
import { useState, useRef, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Wallet, ChevronDown, Copy, ExternalLink, LogOut } from 'lucide-react';

const SOLSCAN_BASE = 'https://solscan.io/account/';

function truncatePubkey(pubkey: string): string {
  if (pubkey.length <= 8) return pubkey;
  return `${pubkey.slice(0, 4)}..${pubkey.slice(-2)}`;
}

export default function WalletPill() {
  const { connected, publicKey, disconnect } = useWallet();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!connected || !publicKey) return null;

  const pubkey = publicKey.toBase58();
  const truncated = truncatePubkey(pubkey);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pubkey);
    } catch {
      // ignore — clipboard may be unavailable in some contexts
    }
    setOpen(false);
  };

  const handleSolscan = () => {
    window.open(`${SOLSCAN_BASE}${pubkey}`, '_blank', 'noopener,noreferrer');
    setOpen(false);
  };

  const handleDisconnect = () => {
    void disconnect();
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Wallet menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-kami-amber text-kami-sepiaBg hover:opacity-95 active:opacity-90 transition-opacity"
      >
        <Wallet className="w-3.5 h-3.5 hidden sm:inline" aria-hidden="true" />
        <span className="font-mono text-xs font-bold tracking-tight">{truncated}</span>
        <ChevronDown className="w-3.5 h-3.5 opacity-70" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 z-50 min-w-[200px] bg-kami-cellBase border border-kami-cellBorder rounded-2xl shadow-lg py-1"
        >
          <button
            role="menuitem"
            type="button"
            onClick={handleCopy}
            className="w-full text-left px-4 py-2 font-mono text-xs text-kami-cream hover:bg-kami-amberHaze hover:text-kami-amber transition-colors flex items-center gap-2"
          >
            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
            Copy address
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={handleSolscan}
            className="w-full text-left px-4 py-2 font-mono text-xs text-kami-cream hover:bg-kami-amberHaze hover:text-kami-amber transition-colors flex items-center gap-2"
          >
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            View on Solscan
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={handleDisconnect}
            className="w-full text-left px-4 py-2 font-mono text-xs text-kami-cream hover:bg-kami-amberHaze hover:text-kami-amber transition-colors flex items-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
```

Run: `pnpm test:run -- src/components/chat/WalletPill.test.tsx`. Expected: 5 passed.

- [ ] **Step 3.3: Update `WalletProvider.tsx` modal CSS to amber**

In `src/components/WalletProvider.tsx`, replace the entire `useWalletModalTheme` hook body's CSS with:

```typescript
function useWalletModalTheme() {
  useEffect(() => {
    const STYLE_ID = 'kami-wallet-modal-theme';
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .wallet-adapter-modal-wrapper {
        background: #221a14 !important;
        border: 1px solid rgba(245, 230, 211, 0.12) !important;
        border-radius: 24px !important;
        box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5) !important;
      }
      .wallet-adapter-modal-title {
        color: #F5E6D3 !important;
        font-weight: 700 !important;
      }
      .wallet-adapter-modal-list {
        gap: 6px !important;
      }
      .wallet-adapter-modal-list .wallet-adapter-button {
        background: #2a2117 !important;
        color: #F5E6D3 !important;
        border: 1px solid rgba(245, 230, 211, 0.12) !important;
        font-weight: 500 !important;
        border-radius: 16px !important;
        transition: background 0.15s, border-color 0.15s !important;
      }
      .wallet-adapter-modal-list .wallet-adapter-button:hover,
      .wallet-adapter-modal-list .wallet-adapter-button:not(:disabled):active {
        background: rgba(255, 165, 0, 0.05) !important;
        border-color: rgba(255, 165, 0, 0.4) !important;
        color: #FFA500 !important;
      }
      .wallet-adapter-modal-list-more {
        color: rgba(245, 230, 211, 0.6) !important;
      }
      .wallet-adapter-modal-button-close {
        background: transparent !important;
      }
      .wallet-adapter-modal-button-close:hover {
        background: rgba(255, 165, 0, 0.05) !important;
      }
    `;
    document.head.appendChild(style);
  }, []);
}
```

- [ ] **Step 3.4: Run all tests + typecheck**

```bash
pnpm test:run                                           # expect 251 passed
pnpm exec tsc --noEmit
pnpm exec tsc -p server/tsconfig.json --noEmit
pnpm exec tsc -b
```

- [ ] **Step 3.5: Commit**

```bash
git add src/components/chat/WalletPill.tsx src/components/chat/WalletPill.test.tsx src/components/WalletProvider.tsx
git commit -m "$(cat <<'EOF'
feat(chat): WalletPill + amber wallet-adapter modal CSS

WalletPill replaces the 3rd-party WalletMultiButton from
@solana/wallet-adapter-react-ui with a custom amber pill matching the
bento landing's CTAs. Reads useWallet() internally (zero props). Compact
icon+pubkey+chevron form with a 3-item dropdown:

  Copy address     -> navigator.clipboard.writeText(pubkey)
  View on Solscan  -> window.open('https://solscan.io/account/<pubkey>', _blank)
  Disconnect       -> wallet.disconnect()

Click-outside and Esc close the menu. Component renders nothing when not
connected (App.tsx gate prevents the chat shell from rendering anyway).

Repaint useWalletModalTheme injected CSS in WalletProvider.tsx from
purple/dark to amber/cream/sepia. The "Use another Solana wallet" modal
flow on the landing keeps working but now matches the bento palette.

+5 WalletPill tests. Tests 246 -> 251. Standalone — not yet swapped into
ChatPanel. Client + server typecheck silent.
EOF
)"
```

---

## Task 4: Composite chat primitives — `ConversationItem`, `MessageBubble`, `ChatHeader`, `ChatInputShell`

**Files:**
- Create: `src/components/chat/ConversationItem.tsx`
- Create: `src/components/chat/ConversationItem.test.tsx`
- Create: `src/components/chat/MessageBubble.tsx`
- Create: `src/components/chat/MessageBubble.test.tsx`
- Create: `src/components/chat/ChatHeader.tsx`
- Create: `src/components/chat/ChatHeader.test.tsx`
- Create: `src/components/chat/ChatInputShell.tsx`
- Create: `src/components/chat/ChatInputShell.test.tsx`

- [ ] **Step 4.1: Write `ConversationItem.test.tsx`**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ConversationItem from './ConversationItem';
import type { Conversation } from '../../types';

const conv: Conversation = {
  id: 'c1',
  title: 'USDC yield matrix',
  messages: [],
  createdAt: 1,
  updatedAt: 1,
};

const baseProps = {
  conversation: conv,
  isActive: false,
  isEditing: false,
  editingTitle: '',
  onSelect: vi.fn(),
  onStartRename: vi.fn(),
  onCommitRename: vi.fn(),
  onCancelRename: vi.fn(),
  onChangeRenameTitle: vi.fn(),
  onDelete: vi.fn(),
};

describe('ConversationItem', () => {
  it('renders conversation title', () => {
    render(<ConversationItem {...baseProps} />);
    expect(screen.getByText('USDC yield matrix')).toBeInTheDocument();
  });

  it('applies active styling when isActive is true', () => {
    render(<ConversationItem {...baseProps} isActive={true} />);
    const cell = screen.getByText('USDC yield matrix').closest('[class*="bg-kami-amberHaze"]');
    expect(cell).toBeInTheDocument();
  });

  it('fires onSelect when row is clicked', () => {
    const onSelect = vi.fn();
    render(<ConversationItem {...baseProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('USDC yield matrix'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('renders rename input when isEditing is true', () => {
    render(
      <ConversationItem
        {...baseProps}
        isEditing={true}
        editingTitle="USDC yield matrix"
      />
    );
    const input = screen.getByLabelText(/rename conversation/i) as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('USDC yield matrix');
  });
});
```

- [ ] **Step 4.2: Verify failure, implement `ConversationItem.tsx`**

Create `src/components/chat/ConversationItem.tsx`:

```tsx
import { Pencil, Trash2 } from 'lucide-react';
import BentoCell from '../bento/BentoCell';
import type { Conversation } from '../../types';

interface Props {
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

export default function ConversationItem({
  conversation,
  isActive,
  isEditing,
  editingTitle,
  onSelect,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onChangeRenameTitle,
  onDelete,
}: Props) {
  const activeClass = isActive
    ? 'bg-kami-amberHaze border-kami-amber/25 text-kami-amber'
    : 'text-kami-creamMuted hover:text-kami-cream';

  return (
    <BentoCell
      delay={0}
      variant="mini"
      animate={false}
      className={`group cursor-pointer ${activeClass}`}
    >
      <div
        onClick={isEditing ? undefined : onSelect}
        className="flex items-center gap-2 text-sm"
      >
        {isEditing ? (
          <input
            autoFocus
            value={editingTitle}
            onChange={(e) => onChangeRenameTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onCommitRename();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                onCancelRename();
              }
            }}
            onBlur={onCommitRename}
            onClick={(e) => e.stopPropagation()}
            maxLength={60}
            aria-label="Rename conversation"
            className="flex-1 min-w-0 bg-transparent border border-kami-cellBorder rounded px-1 py-0.5 text-sm text-kami-cream focus:outline-none focus:border-kami-amber/40"
          />
        ) : (
          <span className="flex-1 truncate" title={conversation.title}>
            {conversation.title}
          </span>
        )}
        {!isEditing && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStartRename();
              }}
              aria-label="Rename conversation"
              className="opacity-0 group-hover:opacity-100 p-1 text-kami-creamMuted hover:text-kami-cream transition-all"
            >
              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              aria-label="Delete conversation"
              className="opacity-0 group-hover:opacity-100 p-1 text-kami-creamMuted hover:text-kami-amber transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </BentoCell>
  );
}
```

Run: `pnpm test:run -- src/components/chat/ConversationItem.test.tsx`. Expected: 4 passed.

- [ ] **Step 4.3: Write `MessageBubble.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/markdown', () => ({
  Markdown: ({ text }: { text: string }) => <span data-testid="md">{text}</span>,
}));

vi.mock('./TxStatusCard', () => ({
  default: () => <div data-testid="tx-card" />,
}));

vi.mock('../ConnectWalletButton', () => ({
  default: () => <div data-testid="connect-btn" />,
}));

import MessageBubble from './MessageBubble';
import type { ChatMessage } from '../../types';

const userMsg: ChatMessage = {
  id: 'm1',
  role: 'user',
  content: 'find best USDC yield',
};

const assistantMsg: ChatMessage = {
  id: 'm2',
  role: 'assistant',
  content: 'Kamino Main Market — USDC supply at 8.4% APY.',
};

describe('MessageBubble', () => {
  it('renders user message right-aligned with amber haze', () => {
    const { container } = render(<MessageBubble message={userMsg} isStreaming={false} />);
    expect(container.querySelector('[class*="justify-end"]')).toBeInTheDocument();
    expect(container.querySelector('[class*="bg-kami-amberHaze"]')).toBeInTheDocument();
    expect(screen.getByText('find best USDC yield')).toBeInTheDocument();
  });

  it('renders assistant message with cellBase background', () => {
    const { container } = render(<MessageBubble message={assistantMsg} isStreaming={false} />);
    expect(container.querySelector('[class*="bg-kami-cellBase"]')).toBeInTheDocument();
    expect(screen.getByTestId('md')).toHaveTextContent(/8.4% APY/);
  });

  it('renders ToolBadge row when assistant message has toolCalls', () => {
    const msg: ChatMessage = {
      ...assistantMsg,
      toolCalls: [{ id: 't1', name: 'tool/findYield', status: 'success', input: {} }],
    };
    render(<MessageBubble message={msg} isStreaming={false} />);
    expect(screen.getByText('tool/findYield')).toBeInTheDocument();
  });

  it('appends KamiCursor when assistant is streaming', () => {
    const { container } = render(<MessageBubble message={assistantMsg} isStreaming={true} />);
    expect(container.querySelector('[class*="animate-blink"]')).toBeInTheDocument();
  });
});
```

- [ ] **Step 4.4: Verify failure, implement `MessageBubble.tsx`**

Create `src/components/chat/MessageBubble.tsx`:

```tsx
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

export default function MessageBubble({ message, isStreaming }: Props) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <BentoCell
          delay={0}
          variant="compact"
          className="max-w-[85%] md:max-w-[65%] bg-kami-amberHaze border-kami-amber/25"
        >
          <p className="text-sm text-kami-cream whitespace-pre-wrap">{message.content}</p>
        </BentoCell>
      </div>
    );
  }

  const grouped = message.toolCalls ? groupToolCalls(message.toolCalls) : [];
  const showConnectCta = message.toolCalls?.some((c) => c.status === 'wallet-required') ?? false;
  const isWaitingForFirstToken =
    message.content === '' &&
    !message.toolCalls?.length &&
    !message.pendingTransaction &&
    !showConnectCta;

  return (
    <div className="flex mb-4">
      <BentoCell
        delay={0}
        variant="compact"
        className="max-w-[95%] md:max-w-[80%] bg-kami-cellBase border-kami-cellBorder"
      >
        {grouped.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {grouped.map((g, i) => (
              <ToolBadge key={`${g.name}-${i}`} name={g.name} status={g.status} count={g.count} />
            ))}
          </div>
        )}
        {isWaitingForFirstToken ? (
          <KamiCursor />
        ) : (
          <div className="text-sm text-kami-cream space-y-1">
            <Markdown text={message.content} />
            {isStreaming && message.content && <KamiCursor />}
          </div>
        )}
        {message.pendingTransaction && (
          <div className="mt-3">
            <TxStatusCard transaction={message.pendingTransaction} />
          </div>
        )}
        {showConnectCta && (
          <div className="mt-3">
            <ConnectWalletButton />
          </div>
        )}
      </BentoCell>
    </div>
  );
}
```

Run: `pnpm test:run -- src/components/chat/MessageBubble.test.tsx`. Expected: 4 passed.

(Note: TxStatusCard does not exist yet — Task 6 creates it. The test mocks it via `vi.mock`. The implementation imports it; TypeScript will error at typecheck. To unblock, create a stub TxStatusCard for now.)

- [ ] **Step 4.5: Create stub `TxStatusCard.tsx` so MessageBubble compiles**

Create `src/components/chat/TxStatusCard.tsx`:

```tsx
import type { PendingTransaction } from '../../types';

interface Props {
  transaction: PendingTransaction;
}

// STUB — Task 6 replaces this with the full state machine.
export default function TxStatusCard({ transaction }: Props) {
  return (
    <div className="text-xs text-kami-creamMuted">tx pending: {String(transaction.signed)}</div>
  );
}
```

(Task 6 will overwrite this file completely. The stub exists only so this task's typecheck passes.)

- [ ] **Step 4.6: Write `ChatHeader.test.tsx`**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({ connected: false, publicKey: null, disconnect: vi.fn() }),
}));

import ChatHeader from './ChatHeader';

describe('ChatHeader', () => {
  it('renders the conversation title', () => {
    render(<ChatHeader conversationTitle="USDC yield matrix" onMenuToggle={vi.fn()} />);
    expect(screen.getByText('USDC yield matrix')).toBeInTheDocument();
  });

  it('renders the env overline', () => {
    render(<ChatHeader conversationTitle="x" onMenuToggle={vi.fn()} />);
    expect(screen.getByText(/KAMI · v1.0 · MAINNET/)).toBeInTheDocument();
  });

  it('renders the status indicator with pulse-dot', () => {
    const { container } = render(
      <ChatHeader conversationTitle="x" onMenuToggle={vi.fn()} />
    );
    expect(container.querySelector('[class*="animate-pulse-dot"]')).toBeInTheDocument();
    expect(screen.getByText(/sys.status: online/)).toBeInTheDocument();
  });

  it('calls onMenuToggle when hamburger is clicked', () => {
    const onMenuToggle = vi.fn();
    render(<ChatHeader conversationTitle="x" onMenuToggle={onMenuToggle} />);
    fireEvent.click(screen.getByLabelText(/menu/i));
    expect(onMenuToggle).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 4.7: Verify failure, implement `ChatHeader.tsx`**

Create `src/components/chat/ChatHeader.tsx`:

```tsx
import { Menu } from 'lucide-react';
import WalletPill from './WalletPill';

interface Props {
  conversationTitle: string;
  onMenuToggle: () => void;
}

export default function ChatHeader({ conversationTitle, onMenuToggle }: Props) {
  return (
    <header className="flex items-center justify-between px-4 lg:px-6 py-3 border-b border-kami-cellBorder bg-kami-sepiaBg/80 backdrop-blur-sm flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onMenuToggle}
          aria-label="Toggle menu"
          className="lg:hidden p-1 text-kami-creamMuted hover:text-kami-cream transition-colors"
        >
          <Menu className="w-5 h-5" aria-hidden="true" />
        </button>
        <div className="flex flex-col min-w-0">
          <span className="hidden sm:block font-mono text-[11px] uppercase tracking-widest text-kami-creamMuted leading-tight mb-0.5">
            &gt; KAMI · v1.0 · MAINNET
          </span>
          <h1 className="font-display font-bold text-base lg:text-lg text-kami-cream leading-none truncate">
            {conversationTitle}
          </h1>
        </div>
        <span className="hidden md:inline-flex items-center gap-1.5 ml-3 font-mono text-[10px] uppercase tracking-widest text-kami-creamMuted">
          [sys.status: online]
          <span
            className="w-1.5 h-1.5 rounded-full bg-kami-amber animate-pulse-dot"
            aria-hidden="true"
          />
        </span>
      </div>
      <WalletPill />
    </header>
  );
}
```

Run: `pnpm test:run -- src/components/chat/ChatHeader.test.tsx`. Expected: 4 passed.

- [ ] **Step 4.8: Write `ChatInputShell.test.tsx`**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ChatInputShell from './ChatInputShell';

describe('ChatInputShell', () => {
  it('renders the textarea with placeholder', () => {
    render(
      <ChatInputShell onSend={vi.fn()} onStop={vi.fn()} isStreaming={false} />
    );
    expect(screen.getByPlaceholderText(/ask kami about defi/i)).toBeInTheDocument();
  });

  it('renders suggestion chips when input is empty and not streaming', () => {
    render(
      <ChatInputShell onSend={vi.fn()} onStop={vi.fn()} isStreaming={false} />
    );
    expect(screen.getByRole('button', { name: /show me my kamino portfolio/i })).toBeInTheDocument();
  });

  it('hides suggestion chips when streaming', () => {
    render(<ChatInputShell onSend={vi.fn()} onStop={vi.fn()} isStreaming={true} />);
    expect(screen.queryByRole('button', { name: /show me my kamino portfolio/i })).not.toBeInTheDocument();
  });

  it('fires onSend with input text on Enter', () => {
    const onSend = vi.fn();
    render(<ChatInputShell onSend={onSend} onStop={vi.fn()} isStreaming={false} />);
    const textarea = screen.getByPlaceholderText(/ask kami about defi/i);
    fireEvent.change(textarea, { target: { value: 'test query' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(onSend).toHaveBeenCalledWith('test query');
  });

  it('fires onStop when stop button is clicked while streaming', () => {
    const onStop = vi.fn();
    render(<ChatInputShell onSend={vi.fn()} onStop={onStop} isStreaming={true} />);
    fireEvent.click(screen.getByLabelText(/stop streaming/i));
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 4.9: Verify failure, implement `ChatInputShell.tsx`**

Create `src/components/chat/ChatInputShell.tsx`:

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { Square, ArrowUp } from 'lucide-react';
import SuggestionChip from './SuggestionChip';

interface Props {
  onSend: (msg: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

const SUGGESTIONS = [
  'Show me my Kamino portfolio',
  "What's the best USDC supply APY on Kamino right now?",
  'Deposit 0.1 USDC into Kamino',
  'Simulate my health factor if I borrow 5 USDC',
];

export default function ChatInputShell({ onSend, onStop, isStreaming, disabled }: Props) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const handleSubmit = (text?: string) => {
    const value = (text ?? input).trim();
    if (!value || disabled) return;
    onSend(value);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-kami-cellBorder bg-kami-sepiaBg/80 backdrop-blur-sm px-4 py-4">
      {!disabled && input === '' && !isStreaming && (
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1 max-w-3xl mx-auto no-scrollbar">
          {SUGGESTIONS.map((s) => (
            <SuggestionChip key={s} label={s} onClick={() => handleSubmit(s)} />
          ))}
        </div>
      )}
      <div className="max-w-3xl mx-auto bg-kami-cellBase border border-kami-cellBorder rounded-2xl p-2 flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Kami about DeFi…"
          rows={1}
          disabled={disabled}
          className="flex-1 bg-transparent outline-none border-none resize-none px-3 py-2 text-sm text-kami-cream placeholder-kami-creamMuted/60 max-h-[160px] no-scrollbar"
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop streaming"
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-kami-amber/15 border border-kami-amber/40 text-kami-amber hover:bg-kami-amber/25 transition-colors flex items-center justify-center"
          >
            <Square className="w-4 h-4 fill-current" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={!input.trim() || disabled}
            aria-label="Send message"
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-kami-amber text-kami-sepiaBg disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-95 transition-opacity flex items-center justify-center"
          >
            <ArrowUp className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="text-center text-[10px] text-kami-creamMuted/70 mt-2 max-w-3xl mx-auto">
        Kami provides information only. Always verify before signing transactions.
      </p>
    </div>
  );
}
```

Run: `pnpm test:run -- src/components/chat/ChatInputShell.test.tsx`. Expected: 5 passed.

- [ ] **Step 4.10: Run full test suite + typecheck + build**

```bash
pnpm test:run                                           # expect 268 passed
pnpm exec tsc --noEmit
pnpm exec tsc -p server/tsconfig.json --noEmit
pnpm exec tsc -b
pnpm build
```

- [ ] **Step 4.11: Commit**

```bash
git add src/components/chat/ConversationItem.tsx src/components/chat/ConversationItem.test.tsx src/components/chat/MessageBubble.tsx src/components/chat/MessageBubble.test.tsx src/components/chat/ChatHeader.tsx src/components/chat/ChatHeader.test.tsx src/components/chat/ChatInputShell.tsx src/components/chat/ChatInputShell.test.tsx src/components/chat/TxStatusCard.tsx
git commit -m "$(cat <<'EOF'
feat(chat): composite primitives — ConversationItem, MessageBubble, ChatHeader, ChatInputShell

Four composite components in chat/ assembled from the bento/ + chat/
atomics. Plus a stub TxStatusCard so MessageBubble compiles (Task 6
replaces it).

  ConversationItem — wraps BentoCell variant=mini, animate=false. Active
    state amberHaze + amber/25 border. Hover reveals pencil-rename + delete
    icons. Inline-rename input pattern preserved from existing Sidebar.

  MessageBubble — wraps BentoCell variant=compact. User: right-aligned
    amberHaze. Assistant: left-aligned cellBase, with optional ToolBadge
    row (via groupToolCalls), markdown content, optional KamiCursor when
    streaming, optional TxStatusCard, optional ConnectWalletButton.

  ChatHeader — > KAMI · v1.0 · MAINNET overline + Unbounded title +
    [sys.status: online] indicator with animate-pulse-dot + WalletPill on
    the right. Hamburger on mobile.

  ChatInputShell — drop-in API of current ChatInput.tsx. SuggestionChip
    strip when input is empty + not streaming. Bento input shell with
    autosize textarea + amber send button (or amber/red Square stop button
    when streaming).

+17 tests across 4 files. Tests 251 -> 268. Standalone — App.tsx still
imports the legacy chat components. Client + server typecheck silent.
EOF
)"
```

---

## Task 5: `SidebarShell`

**Files:**
- Create: `src/components/chat/SidebarShell.tsx`
- Create: `src/components/chat/SidebarShell.test.tsx`

- [ ] **Step 5.1: Write `SidebarShell.test.tsx`**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SidebarShell from './SidebarShell';
import type { Conversation } from '../../types';

const conversations: Conversation[] = [
  { id: 'c1', title: 'first chat', messages: [], createdAt: 1, updatedAt: 1 },
  { id: 'c2', title: 'second chat', messages: [], createdAt: 2, updatedAt: 2 },
];

const baseProps = {
  conversations,
  activeId: 'c1',
  isOpen: true,
  onSelect: vi.fn(),
  onNew: vi.fn(),
  onDelete: vi.fn(),
  onClose: vi.fn(),
  onClearAll: vi.fn(),
  onRename: vi.fn(),
};

describe('SidebarShell', () => {
  let originalConfirm: typeof window.confirm;
  beforeEach(() => {
    originalConfirm = window.confirm;
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.confirm = originalConfirm;
  });

  it('renders the Kami brand header with amber K avatar', () => {
    const { container } = render(<SidebarShell {...baseProps} />);
    expect(screen.getByText('Kami')).toBeInTheDocument();
    expect(screen.getByText(/v1.0/i)).toBeInTheDocument();
    expect(container.querySelector('[class*="bg-kami-amber"]')).toBeInTheDocument();
  });

  it('renders conversation list', () => {
    render(<SidebarShell {...baseProps} />);
    expect(screen.getByText('first chat')).toBeInTheDocument();
    expect(screen.getByText('second chat')).toBeInTheDocument();
  });

  it('fires onNew when New Chat is clicked', () => {
    const onNew = vi.fn();
    render(<SidebarShell {...baseProps} onNew={onNew} />);
    fireEvent.click(screen.getByRole('button', { name: /new chat/i }));
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it('opens settings menu and shows Clear all option', () => {
    render(<SidebarShell {...baseProps} />);
    fireEvent.click(screen.getByLabelText(/settings/i));
    expect(screen.getByRole('button', { name: /clear all conversations/i })).toBeInTheDocument();
  });

  it('fires onClearAll after window.confirm accepts', () => {
    const onClearAll = vi.fn();
    window.confirm = vi.fn(() => true);
    render(<SidebarShell {...baseProps} onClearAll={onClearAll} />);
    fireEvent.click(screen.getByLabelText(/settings/i));
    fireEvent.click(screen.getByRole('button', { name: /clear all conversations/i }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it('does not fire onClearAll when window.confirm declines', () => {
    const onClearAll = vi.fn();
    window.confirm = vi.fn(() => false);
    render(<SidebarShell {...baseProps} onClearAll={onClearAll} />);
    fireEvent.click(screen.getByLabelText(/settings/i));
    fireEvent.click(screen.getByRole('button', { name: /clear all conversations/i }));
    expect(onClearAll).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 5.2: Verify failure, implement `SidebarShell.tsx`**

Create `src/components/chat/SidebarShell.tsx`:

```tsx
import React, { useState } from 'react';
import { Settings, Plus, X } from 'lucide-react';
import ConversationItem from './ConversationItem';
import type { Conversation } from '../../types';

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

export default function SidebarShell({
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

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`
          fixed top-0 left-0 h-full w-72 bg-kami-sepiaBg border-r border-kami-cellBorder z-40
          transform transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 lg:z-0
          flex flex-col
        `}
      >
        <div className="p-4 border-b border-kami-cellBorder flex items-center gap-3 relative">
          <div className="w-8 h-8 rounded-lg bg-kami-amber flex items-center justify-center text-kami-sepiaBg font-display font-bold text-sm">
            K
          </div>
          <div className="flex-1">
            <h1 className="font-display font-bold text-kami-cream text-sm leading-none">Kami</h1>
            <p className="font-mono text-[9px] uppercase tracking-widest text-kami-creamMuted mt-1">
              v1.0 · mainnet
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsSettingsOpen((v) => !v)}
            aria-label="Settings"
            className="p-1 text-kami-creamMuted hover:text-kami-cream transition-colors"
          >
            <Settings className="w-5 h-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            className="lg:hidden p-1 text-kami-creamMuted hover:text-kami-cream transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
          {isSettingsOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsSettingsOpen(false)}
                aria-hidden="true"
              />
              <div className="absolute right-3 top-full mt-2 z-50 w-56 bg-kami-cellBase border border-kami-cellBorder rounded-2xl shadow-lg py-1">
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="w-full text-left px-4 py-2 font-mono text-xs text-kami-cream hover:bg-kami-amberHaze hover:text-kami-amber transition-colors"
                >
                  Clear all conversations
                </button>
              </div>
            </>
          )}
        </div>

        <div className="p-3">
          <button
            type="button"
            onClick={onNew}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-2xl border border-kami-cellBorder text-sm text-kami-cream hover:bg-kami-amberHaze hover:border-kami-amber/40 hover:text-kami-amber transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
          {conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === activeId}
              isEditing={editingId === conv.id}
              editingTitle={editingTitle}
              onSelect={() => onSelect(conv.id)}
              onStartRename={() => startRename(conv)}
              onCommitRename={commitRename}
              onCancelRename={cancelRename}
              onChangeRenameTitle={setEditingTitle}
              onDelete={() => onDelete(conv.id)}
            />
          ))}
        </div>

        <div className="p-3 border-t border-kami-cellBorder">
          <div className="flex items-center gap-2 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-kami-creamMuted">
            <div className="w-2 h-2 rounded-full bg-kami-amber animate-pulse-dot" />
            Solana Mainnet
          </div>
        </div>
      </aside>
    </>
  );
}
```

Run: `pnpm test:run -- src/components/chat/SidebarShell.test.tsx`. Expected: 6 passed.

- [ ] **Step 5.3: Run full suite + typecheck + commit**

```bash
pnpm test:run                                           # expect 274 passed
pnpm exec tsc --noEmit
pnpm exec tsc -p server/tsconfig.json --noEmit
pnpm exec tsc -b

git add src/components/chat/SidebarShell.tsx src/components/chat/SidebarShell.test.tsx
git commit -m "$(cat <<'EOF'
feat(chat): SidebarShell — bento sidebar replacement

Drop-in API match for current Sidebar.tsx. Replaces the gradient
purple→pink K avatar with a clean amber-on-sepia rounded square. New chat
button is a pill with cellBorder and amber-haze hover. Conversation rows
use ConversationItem (BentoCell variant=mini animate=false). Settings
dropdown (Clear all conversations) keeps the existing window.confirm
gate. Footer keeps the Solana Mainnet indicator with animate-pulse-dot.

+6 tests. Tests 268 -> 274. Standalone — App.tsx still imports the
legacy Sidebar. Client + server typecheck silent.
EOF
)"
```

---

## Task 6: `TxStatusCard` — full state machine replacing `SignTransactionCard`

**Files:**
- Modify: `src/components/chat/TxStatusCard.tsx` (overwrite the stub from Task 4)
- Create: `src/components/chat/TxStatusCard.test.tsx`

**Reference:** Read the current `src/components/SignTransactionCard.tsx` first to mirror its `wallet.signTransaction` + `pollSignatureStatus` flow.

- [ ] **Step 6.1: Write `TxStatusCard.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PendingTransaction } from '../../types';

const signTransaction = vi.fn();
const wallet = vi.hoisted(() => ({
  publicKey: { toBase58: () => 'PubKey1234567890' },
  signTransaction: vi.fn(),
}));

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => wallet,
  useConnection: () => ({ connection: { rpcEndpoint: 'https://x' } }),
}));

vi.mock('../../lib/walletError', () => ({
  classifyWalletError: () => ({ code: 'unknown', message: 'fail' }),
}));

import TxStatusCard from './TxStatusCard';

const baseTx: PendingTransaction = {
  base64: 'AAAA',
  summary: { action: 'deposit', amount: '0.1', symbol: 'USDC', market: 'Main' },
  signed: false,
};

describe('TxStatusCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wallet.signTransaction = signTransaction;
  });

  it('renders the needs-sign state with action summary', () => {
    render(<TxStatusCard transaction={baseTx} />);
    expect(screen.getByText(/sign transaction/i)).toBeInTheDocument();
    expect(screen.getByText(/deposit/i)).toBeInTheDocument();
    expect(screen.getByText(/0.1/)).toBeInTheDocument();
    expect(screen.getByText(/USDC/)).toBeInTheDocument();
  });

  it('renders the confirmed state with signature and Solscan link', () => {
    const tx: PendingTransaction = {
      ...baseTx,
      signed: true,
      signature: '5XKeETjGfm12345pUvZE',
    };
    render(<TxStatusCard transaction={tx} />);
    expect(screen.getByText(/confirmed/i)).toBeInTheDocument();
    expect(screen.getByText(/5XKeETjGfm…pUvZE/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /solscan/i })).toBeInTheDocument();
  });

  it('renders the failed state with error message', () => {
    const tx: PendingTransaction = {
      ...baseTx,
      signed: false,
      error: 'Transaction simulation failed: insufficient funds',
    };
    render(<TxStatusCard transaction={tx} />);
    expect(screen.getByText(/failed/i)).toBeInTheDocument();
    expect(screen.getByText(/insufficient funds/i)).toBeInTheDocument();
  });

  it('flips to signing state when CTA is clicked', async () => {
    signTransaction.mockImplementation(() => new Promise(() => {})); // never resolves
    render(<TxStatusCard transaction={baseTx} />);
    fireEvent.click(screen.getByRole('button', { name: /sign transaction/i }));
    await waitFor(() => {
      expect(screen.getByText(/signing/i)).toBeInTheDocument();
    });
  });

  it('shows broadcasting state after sign succeeds', async () => {
    signTransaction.mockResolvedValue({});
    // Mock fetch for getSignatureStatuses
    global.fetch = vi.fn(async () =>
      ({ ok: true, json: async () => ({ result: { value: [null] } }) }) as Response
    );
    render(<TxStatusCard transaction={baseTx} />);
    fireEvent.click(screen.getByRole('button', { name: /sign transaction/i }));
    await waitFor(() => {
      expect(screen.getByText(/broadcasting/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 6.2: Read the current SignTransactionCard implementation for reference**

```bash
cat /Users/rector/local-dev/kami/src/components/SignTransactionCard.tsx | head -200
```

(The new TxStatusCard reuses the same `wallet.signTransaction` + `pollSignatureStatus` flow; only the JSX is rebuilt.)

- [ ] **Step 6.3: Implement `TxStatusCard.tsx`** (replace the stub from Task 4)

Read the entire current `src/components/SignTransactionCard.tsx` first — its `pollSignatureStatus`, `signTransaction` flow, and `classifyWalletError` integration are reused verbatim.

Replace the entire `src/components/chat/TxStatusCard.tsx` with this skeleton. The `// COPY FROM SignTransactionCard.tsx` placeholders are the SAME code (function bodies + effect bodies) — copy them exactly. Only the JSX render is rebuilt:

```tsx
import { useState, useEffect, useRef } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Loader2, CheckCircle2, XCircle, ExternalLink, Wallet } from 'lucide-react';
import BentoCell from '../bento/BentoCell';
import KamiCursor from '../bento/KamiCursor';
import KeyValueRows from './KeyValueRows';
import { classifyWalletError } from '../../lib/walletError';
import type { PendingTransaction } from '../../types';

type Phase = 'needs-sign' | 'signing' | 'broadcasting' | 'confirmed' | 'failed';

interface Props {
  transaction: PendingTransaction;
}

const SOLSCAN_TX = (sig: string) => `https://solscan.io/tx/${sig}`;

function truncateSig(sig: string): string {
  if (sig.length <= 16) return sig;
  return `${sig.slice(0, 10)}…${sig.slice(-5)}`;
}

export default function TxStatusCard({ transaction }: Props) {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [phase, setPhase] = useState<Phase>(() => {
    if (transaction.signed && transaction.signature) return 'confirmed';
    if (transaction.error) return 'failed';
    return 'needs-sign';
  });
  const [signature, setSignature] = useState<string | null>(transaction.signature ?? null);
  const [error, setError] = useState<string | null>(transaction.error ?? null);
  const cancelRef = useRef(false);

  useEffect(() => () => { cancelRef.current = true; }, []);

  // pollSignatureStatus — copied verbatim from SignTransactionCard.tsx.
  // Reasoning: Vercel cannot upgrade WS for connection.confirmTransaction;
  // HTTP-poll getSignatureStatuses on a budget keyed by getBlockHeight.
  // See memory eitherway-scaffold-leftovers.md.
  // COPY FROM SignTransactionCard.tsx: const pollSignatureStatus = async (sig: string): Promise<...> => { ... };

  const handleSign = async () => {
    if (!publicKey || !signTransaction) return;
    setPhase('signing');
    setError(null);
    try {
      // COPY FROM SignTransactionCard.tsx: the deserialize → signTransaction → broadcast flow.
      // After broadcast: setSignature(sig); setPhase('broadcasting');
      // After poll completes: setPhase('confirmed') OR setPhase('failed') + setError(...)
    } catch (e) {
      const classified = classifyWalletError(e);
      setError(classified.message);
      setPhase('failed');
    }
  };

  const txRows = [
    { key: 'action', value: transaction.summary?.action ?? '—' },
    { key: 'amount', value: `${transaction.summary?.amount ?? '—'} ${transaction.summary?.symbol ?? ''}`.trim() },
    { key: 'market', value: transaction.summary?.market ?? '—' },
  ];

  return (
    <BentoCell delay={0} variant="compact" className="bg-kami-cellBase border-kami-cellBorder">
      <KeyValueRows rows={txRows} />

      {phase === 'needs-sign' && (
        <button
          type="button"
          onClick={handleSign}
          className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-kami-amber text-kami-sepiaBg font-mono uppercase tracking-wider text-xs font-bold hover:opacity-95 active:opacity-90 transition-opacity"
        >
          <Wallet className="w-4 h-4" aria-hidden="true" />
          Sign Transaction
        </button>
      )}

      {phase === 'signing' && (
        <div className="mt-3 inline-flex items-center gap-2 font-mono text-xs text-kami-amber">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          Signing<KamiCursor />
        </div>
      )}

      {phase === 'broadcasting' && (
        <div className="mt-3 inline-flex items-center gap-2 font-mono text-xs text-kami-amber">
          <span className="w-2 h-2 rounded-full bg-kami-amber animate-pulse-dot" aria-hidden="true" />
          Broadcasting…
        </div>
      )}

      {phase === 'confirmed' && signature && (
        <div className="mt-3 flex items-center gap-3 p-3 rounded-xl bg-kami-cellElevated border border-kami-cellBorder">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-kami-amber/15 text-kami-amber font-mono text-[10px] uppercase tracking-widest">
            <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
            Confirmed
          </span>
          <span className="font-mono text-xs text-kami-cream">{truncateSig(signature)}</span>
          <a
            href={SOLSCAN_TX(signature)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View ${truncateSig(signature)} on Solscan`}
            className="inline-flex items-center gap-1 text-kami-amber hover:opacity-80 transition-opacity ml-auto"
          >
            <span className="font-mono text-[11px]">Solscan</span>
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
        </div>
      )}

      {phase === 'failed' && (
        <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-kami-amber/5 border border-kami-amber/30">
          <XCircle className="w-4 h-4 text-kami-amber flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-widest text-kami-amber mb-1">Failed</div>
            <p className="font-mono text-xs text-kami-cream/80 break-words">{error ?? 'Unknown error'}</p>
            {phase === 'failed' && (
              <button
                type="button"
                onClick={handleSign}
                className="mt-2 font-mono text-[11px] text-kami-amber hover:underline"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}
    </BentoCell>
  );
}
```

The `// COPY FROM SignTransactionCard.tsx` comments mark places where the existing business logic must be transplanted verbatim. The current SignTransactionCard's `pollSignatureStatus` is roughly 30-40 lines and the broadcast flow inside `handleSign` is roughly 15-20 lines — copy both blocks exactly, then update `setPhase('confirmed' | 'failed')` calls per the new state machine names.

- [ ] **Step 6.4: Run TxStatusCard tests + full suite**

```bash
pnpm test:run -- src/components/chat/TxStatusCard.test.tsx     # expect 5 passed
pnpm test:run                                                   # expect 279 passed
pnpm exec tsc --noEmit
pnpm exec tsc -p server/tsconfig.json --noEmit
pnpm exec tsc -b
pnpm build
```

- [ ] **Step 6.5: Commit**

```bash
git add src/components/chat/TxStatusCard.tsx src/components/chat/TxStatusCard.test.tsx
git commit -m "$(cat <<'EOF'
feat(chat): TxStatusCard — bento replacement for SignTransactionCard

5-state card: needs-sign → signing → broadcasting → confirmed | failed.
Wraps BentoCell variant=compact. Tx summary in KeyValueRows
(action / amount / market / health). Confirmed state lifts the
LatestTxCell visual: ✓ amber pill + truncated signature
(5XKeETjGfm…pUvZE) + Solscan ↗ link + amber bullet. Failed state shows
red ✕ pill + classified error message.

Business logic preserved verbatim from SignTransactionCard.tsx:
wallet.signTransaction → HTTP-poll getSignatureStatuses (NOT
connection.confirmTransaction; Vercel cannot upgrade to WS — see memory
eitherway-scaffold-leftovers.md). classifyWalletError for friendly
error copy.

+5 tests covering all 5 phases + the needs-sign → signing transition.
Tests 274 -> 279. Standalone — MessageBubble already imports it via the
Task 4 stub, which is now overwritten with the full implementation.
EOF
)"
```

---

## Task 7: `App.tsx` swap-in

**Files:**
- Modify: `src/App.tsx` (replace legacy chat-shell imports with chat/ equivalents)
- Modify: `src/App.test.tsx` (mocks updated for chat/ paths)

- [ ] **Step 7.1: Read current `App.tsx` to understand the consumer signature**

(Already known from Task 1 reads — confirm current imports:
`Sidebar`, `ChatPanel`, `EmptyState` from `./components/`.)

- [ ] **Step 7.2: Update `src/App.tsx`**

Replace the imports + AppContent return as follows:

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import SolanaWalletProvider from './components/WalletProvider';
import SidebarShell from './components/chat/SidebarShell';
import ChatHeader from './components/chat/ChatHeader';
import ChatInputShell from './components/chat/ChatInputShell';
import MessageBubble from './components/chat/MessageBubble';
import EmptyState from './components/EmptyState';
import { useChat } from './hooks/useChat';

function AppContent() {
  const { connected, publicKey } = useWallet();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages]);

  if (!connected) {
    return (
      <div className="flex h-screen bg-kami-sepiaBg text-kami-cream overflow-hidden">
        <EmptyState />
      </div>
    );
  }

  if (!activeConversation) {
    return (
      <div className="flex h-screen bg-kami-sepiaBg text-kami-cream overflow-hidden" />
    );
  }

  const hasMessages = activeConversation.messages.length > 0;
  const handleSend = (msg: string) => sendMessage(msg, publicKey?.toBase58() || null);

  return (
    <div className="flex h-screen bg-kami-sepiaBg text-kami-cream overflow-hidden">
      <SidebarShell
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
      <div className="flex-1 flex flex-col h-full min-w-0">
        <ChatHeader
          conversationTitle={activeConversation.title}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        {hasMessages ? (
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="max-w-3xl mx-auto">
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
              <div ref={messagesEndRef} />
            </div>
          </div>
        ) : (
          <div className="flex-1" />
        )}
        <ChatInputShell onSend={handleSend} onStop={stopStreaming} isStreaming={isStreaming} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <SolanaWalletProvider>
      <AppContent />
      <Analytics />
      <SpeedInsights />
    </SolanaWalletProvider>
  );
}
```

- [ ] **Step 7.3: Update `src/App.test.tsx` mocks**

The current `App.test.tsx` mocks `./hooks/useChat` and `./components/WalletProvider`. Add a mock for `./components/chat/SidebarShell` so the App test doesn't try to render the full sidebar tree:

```tsx
vi.mock('./components/chat/SidebarShell', () => ({
  default: () => <div data-testid="sidebar-shell" />,
}));

vi.mock('./components/chat/ChatHeader', () => ({
  default: ({ conversationTitle }: { conversationTitle: string }) => (
    <div data-testid="chat-header">{conversationTitle}</div>
  ),
}));

vi.mock('./components/chat/ChatInputShell', () => ({
  default: () => <div data-testid="chat-input-shell" />,
}));

vi.mock('./components/chat/MessageBubble', () => ({
  default: () => <div data-testid="message-bubble" />,
}));
```

Then update the existing assertion in the connected test from `getAllByText('first chat')` to `getByTestId('chat-header')`:

```tsx
it('renders the chat shell when wallet is connected', () => {
  mockWallet.connected = true;
  render(<App />);
  expect(screen.getByTestId('sidebar-shell')).toBeInTheDocument();
  expect(screen.getByTestId('chat-header')).toBeInTheDocument();
  expect(screen.getByTestId('chat-input-shell')).toBeInTheDocument();
});
```

- [ ] **Step 7.4: Run all tests + typecheck + build**

```bash
pnpm test:run                                           # expect 279 passed (App tests adjusted, no net delta)
pnpm exec tsc --noEmit
pnpm exec tsc -p server/tsconfig.json --noEmit
pnpm exec tsc -b
pnpm build
```

- [ ] **Step 7.5: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "$(cat <<'EOF'
feat(chat): wire chat/ primitives into App.tsx

Swap out the legacy chat-shell imports (Sidebar, ChatPanel) for the new
chat/ primitives (SidebarShell, ChatHeader, ChatInputShell,
MessageBubble). The empty-conversation case keeps a flex-1 spacer (no
welcome card per spec; suggestion chips on the input strip handle
post-connect-empty UX). The unconnected case still renders the bento
EmptyState (already amber, unchanged).

App.test.tsx mocks updated to point at chat/ paths. Test count unchanged
(legacy mocks replaced 1-for-1).

The legacy components (Sidebar/ChatPanel/ChatInput/ChatMessage/
ToolCallBadges/SignTransactionCard) are now orphaned in
src/components/. Task 8 deletes them.
EOF
)"
```

---

## Task 8: Delete legacy components

**Files:**
- Delete: `src/components/Sidebar.tsx`, `src/components/Sidebar.test.tsx`
- Delete: `src/components/ChatPanel.tsx`
- Delete: `src/components/ChatInput.tsx`
- Delete: `src/components/ChatMessage.tsx`, `src/components/ChatMessage.test.tsx`
- Delete: `src/components/ToolCallBadges.tsx`, `src/components/ToolCallBadges.test.tsx`
- Delete: `src/components/SignTransactionCard.tsx`

- [ ] **Step 8.1: Verify no remaining imports of the legacy files**

```bash
grep -RIn "from.*\(Sidebar\|ChatPanel\|ChatInput\|ChatMessage\|ToolCallBadges\|SignTransactionCard\)" src/ --include='*.ts' --include='*.tsx' | grep -v 'node_modules' | grep -v 'src/components/chat/' | grep -v '.test.'
```

Expected: NO output. If any line appears that imports from `src/components/Sidebar` or similar paths, those are orphaned and must be fixed before proceeding.

- [ ] **Step 8.2: Delete the 8 legacy files via git rm**

```bash
git rm src/components/Sidebar.tsx src/components/Sidebar.test.tsx
git rm src/components/ChatPanel.tsx
git rm src/components/ChatInput.tsx
git rm src/components/ChatMessage.tsx src/components/ChatMessage.test.tsx
git rm src/components/ToolCallBadges.tsx src/components/ToolCallBadges.test.tsx
git rm src/components/SignTransactionCard.tsx
```

- [ ] **Step 8.3: Run all tests + typecheck + build**

```bash
pnpm test:run                                           # expect 257 passed (279 - 22 legacy tests removed)
pnpm exec tsc --noEmit
pnpm exec tsc -p server/tsconfig.json --noEmit
pnpm exec tsc -b
pnpm build
```

If any error mentions a legacy path, the orphan-imports check in Step 8.1 missed something. Fix and re-run.

- [ ] **Step 8.4: Commit**

```bash
git commit -m "$(cat <<'EOF'
chore(chat): delete legacy components superseded by chat/

  src/components/Sidebar.tsx + test            (replaced by chat/SidebarShell)
  src/components/ChatPanel.tsx                  (composed inline in App.tsx)
  src/components/ChatInput.tsx                  (replaced by chat/ChatInputShell)
  src/components/ChatMessage.tsx + test         (replaced by chat/MessageBubble)
  src/components/ToolCallBadges.tsx + test      (replaced by chat/ToolBadge + groupToolCalls)
  src/components/SignTransactionCard.tsx        (replaced by chat/TxStatusCard)

22 legacy tests removed (Sidebar 6 + ChatMessage 6 + ToolCallBadges 10);
ChatPanel, ChatInput, SignTransactionCard had no existing tests, so 0
lost from those. Tests 279 -> 257.

Cumulative net delta this branch: 226 (start) -> 257 (now) = +31, on
target with the spec's ~+32 estimate.
EOF
)"
```

---

## Task 9: Retheme stragglers — `ConnectWalletButton` + `ErrorBoundary`

**Files:**
- Modify: `src/components/ConnectWalletButton.tsx` (palette swap to amber)
- Modify: `src/components/ErrorBoundary.tsx` (sepia bg + amber accent)

- [ ] **Step 9.1: Update `ConnectWalletButton.tsx`**

Replace its `className` content to use amber palette:

```tsx
import { Wallet } from 'lucide-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

export default function ConnectWalletButton() {
  const { setVisible } = useWalletModal();
  return (
    <button
      type="button"
      onClick={() => setVisible(true)}
      className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-kami-amber text-kami-sepiaBg hover:opacity-95 active:opacity-90 text-sm font-mono font-bold transition-opacity"
    >
      <Wallet className="w-4 h-4" />
      Connect Wallet
    </button>
  );
}
```

- [ ] **Step 9.2: Update `ErrorBoundary.tsx`**

Read the current file first. Update its render method's wrapper className to use sepia + amber. The error message text uses `text-kami-cream`, the title uses `text-kami-amber`, the bg uses `bg-kami-sepiaBg`.

(Specific rewrites: replace `bg-kami-bg` → `bg-kami-sepiaBg`, `text-kami-text` → `text-kami-cream`, `text-kami-danger` → `text-kami-amber`, and similar token swaps. Keep the layout + try/again logic verbatim.)

- [ ] **Step 9.3: Run all tests + typecheck**

Existing `ConnectWalletButton.test.tsx` and `ErrorBoundary.test.tsx` should still pass (semantic content unchanged):

```bash
pnpm test:run                                           # expect 257 passed
pnpm exec tsc --noEmit
pnpm exec tsc -p server/tsconfig.json --noEmit
pnpm exec tsc -b
```

- [ ] **Step 9.4: Commit**

```bash
git add src/components/ConnectWalletButton.tsx src/components/ErrorBoundary.tsx
git commit -m "$(cat <<'EOF'
style(chat): retheme ConnectWalletButton + ErrorBoundary to amber palette

Token swap only. ConnectWalletButton (used inline when an assistant
tool call returns wallet-required) is now an amber pill matching the
landing CTAs. ErrorBoundary (top-level React error catcher) uses sepia
background, cream text, and amber for the title.

Existing tests pass without changes — semantic content unchanged.
EOF
)"
```

---

## Task 10: Visual QA + final polish

**Goal:** Verify everything renders correctly across breakpoints + animation timing on the Vercel preview.

- [ ] **Step 10.1: Push branch + open PR**

```bash
git push origin docs/chat-shell-amber-spec
gh pr create --title "feat(chat): bento amber chat-shell redesign" --body "$(cat <<'EOF'
## Summary

Rebuilds the post-connect chat shell as a coherent extension of the bento+amber landing (PR #48). Three-tier folder structure (`bento/` + `landing/` + `chat/`), 13 new chat primitives, 6 legacy components deleted, no business-logic changes.

Spec: \`docs/superpowers/specs/2026-04-29-kami-chat-shell-amber-design.md\`
Plan: \`docs/superpowers/plans/2026-04-29-kami-chat-shell-amber-implementation.md\`

## Migration commits (10)

1. \`feat(bento): extract BentoCell + KamiCursor as shared design-system primitives\`
2. \`feat(chat): atomic primitives — SuggestionChip, ToolBadge, KeyValueRows, groupToolCalls\`
3. \`feat(chat): WalletPill + amber wallet-adapter modal CSS\`
4. \`feat(chat): composite primitives — ConversationItem, MessageBubble, ChatHeader, ChatInputShell\`
5. \`feat(chat): SidebarShell — bento sidebar replacement\`
6. \`feat(chat): TxStatusCard — bento replacement for SignTransactionCard\`
7. \`feat(chat): wire chat/ primitives into App.tsx\`
8. \`chore(chat): delete legacy components superseded by chat/\`
9. \`style(chat): retheme ConnectWalletButton + ErrorBoundary to amber palette\`
10. (Visual QA polish — this commit, see below)

## Test plan

- [ ] Vercel preview renders chat shell at 1280×720
- [ ] Sidebar opens/closes on mobile (375×667) via hamburger
- [ ] WalletPill dropdown: copy address / Solscan / disconnect all work
- [ ] Sending a message: cascade-up animation on new bubble, KamiCursor blinks during streaming
- [ ] Tool call: ToolBadge row renders with correct status icons
- [ ] Confirmed transaction: ✓ pill + truncated signature + Solscan link
- [ ] No purple anywhere in the connect → chat flow
- [ ] All 257 tests pass on CI
- [ ] Bundle size under 700 kB main.js
EOF
)"
```

- [ ] **Step 10.2: Cross-viewport visual QA via Chrome MCP**

Open the Vercel preview URL in a fresh Chrome MCP tab. Verify each of these manually (smoke test, not blocking but flagged for follow-up):

- 1280×720 desktop: sidebar visible as fixed rail, ChatHeader full layout with overline + title + status, ChatInputShell with suggestion chip strip.
- 1024×768 small desktop: same as 1280 but tighter.
- 768×1024 tablet: sidebar in overlay mode, hamburger toggles it.
- 375×667 mobile: ChatHeader compact (no overline), WalletPill compact (no Solflare icon).
- Trigger a streaming response: KamiCursor blinks during streaming, MessageBubble cascade-ups in.
- Trigger a wallet-required tool call: ConnectWalletButton renders inline, amber palette.
- Disconnect via WalletPill dropdown: page transitions back to bento landing (EmptyState).

If any animation timing feels off or any element has wrong padding, fix in this same commit.

- [ ] **Step 10.3: Final commit (if any polish needed) + push**

```bash
# If visual QA found issues, fix them, then:
git add -A
git commit -m "$(cat <<'EOF'
polish(chat): cross-viewport tuning from visual QA pass

[Describe any specific polish: animation timing, padding tweaks, mobile
layout fixes, a11y improvements, etc.]
EOF
)"
git push origin docs/chat-shell-amber-spec
```

If no polish needed, skip this step.

- [ ] **Step 10.4: Mark PR ready, monitor CI, merge**

```bash
gh pr view --json mergeStateStatus,mergeable,statusCheckRollup
gh pr merge --merge        # per CLAUDE.md global: --merge, not squash, keep branches
```

---

## Acceptance criteria check

After all 10 tasks complete:

- [ ] All commits on branch `docs/chat-shell-amber-spec` in order.
- [ ] CI green: `pnpm test:run` shows ~257 tests, three typecheck commands silent, build succeeds, klend-sdk pin guard passes, GitLab mirror succeeds.
- [ ] Vercel preview renders chat shell correctly at 4 viewports.
- [ ] Manual smoke list in PR body all checked.
- [ ] No purple anywhere in connect → chat flow.
- [ ] No console errors in Chrome DevTools.

If all green: merge with `gh pr merge --merge`, production auto-deploys to `kami.rectorspace.com`.
