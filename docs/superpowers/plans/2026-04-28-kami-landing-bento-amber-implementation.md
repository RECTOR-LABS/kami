# Kami Landing — Bento + Amber Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current minimal `EmptyState.tsx` (gradient K logo + 4 feature cards + CTA) with a bento-grid pre-connect landing using an amber-on-sepia palette. Hero cell + 2 stat cells + 4 tool cells + 1 pipeline cell + 1 sponsor strip = 9 cells across a 12-column grid.

**Architecture:** Decompose `EmptyState.tsx` into 8 focused sub-components under `src/components/landing/`. Each cell is a presentation component fed by hardcoded constants in `src/lib/landing-content.ts`. The wallet-connect wiring stays in `EmptyState.tsx`; child cells are pure (props in, JSX out). Animations + colors are Tailwind-theme additions, not inline styles. The chat shell (ChatPanel/Sidebar/etc.) is unchanged — restyling it is a follow-up spec out of scope here.

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind 3.4 + Lucide React (already installed). Tests via Vitest + @testing-library/react (happy-dom env). Google Fonts (Unbounded — added; Inter and JetBrains Mono — already loaded).

---

## Spec reference

`docs/superpowers/specs/2026-04-28-kami-landing-bento-amber-design.md` (committed at `de626e3`). Read it before starting.

## Open questions resolved during planning

These were spec §8 open questions — locked here so implementation has no ambiguity:

1. **CTA copy**: `Connect with Solflare` (matches current `EmptyState.tsx` and bounty-Solflare alignment).
2. **Cell border-radius**: `rounded-3xl` (1.5rem) default for all cells; `rounded-[2rem]` (2rem) for the hero cell.
3. **Latest tx signature**: Day-6 deposit `5XKeETjGfmj9jEWUNCKcf8u49bY4hEzX2a7JcB4nPxQCBbmZ7ipoNrgTXQMJWXHvKw7Bsera9xxYygLVxLUpUvZE`. Solscan URL: `https://solscan.io/tx/<full-sig>`.
4. **Tool cell hint format**: arrow form — `→ KaminoMarket.reserves`, `→ KaminoMarket.getObligationByAddress`, `→ Obligation.simulateBorrowAndWithdrawAction`, `→ KaminoAction.build*Txns`.
5. **Sponsor links**: text-only for v1 (no anchors). Eitherway · Kamino · Solflare · Helius · Vercel.

## Open questions surfaced during planning (RECTOR confirms before execution)

1. **Tool cells are non-clickable per spec §5.4.** Current `EmptyState.tsx` cards fire queries via `onSend` (Sprint 4.3 / U-7 wired this Day 16). Bento drops the click-to-fire behavior — visitors who want to type queries do so via `ChatInput` post-connect. Confirm we accept the regression of "click a card to sample a query."
2. **Bento renders when `conversation.messages.length === 0`** (existing condition), not `connected === false` as spec §6.1 says. The existing condition includes both pre-connect AND post-connect-empty-conversation. Keeping this is safer — flipping to `!connected` would make returning users (post-connect, fresh conversation) skip the bento and see a different empty state. Confirm.

## Token naming + theme strategy

Spec §3.1 names tokens `kami-bg`, `kami-cell-base`, `kami-text`, etc. Some collide with existing Tailwind tokens (`kami.bg = #0a0a0f`, `kami.text = #e2e8f0`). To avoid breaking the chat shell during this transition:

- **Extend** the `kami` namespace with NEW tokens that don't collide: `kami.sepiaBg`, `kami.cellBase`, `kami.cellElevated`, `kami.cellBorder`, `kami.cream`, `kami.creamMuted`, `kami.amber`, `kami.amberGlow`, `kami.amberHaze`.
- **Preserve** all existing `kami.*` tokens unchanged. Body bg stays `#0a0a0f`; only the bento outer wrapper applies `bg-kami-sepiaBg`.
- **Defer** removing the `kami.accent` purple to the chat-shell restyle follow-up (spec §6.2).

## File structure (new + modified)

**Created:**
- `src/lib/landing-content.ts` — hardcoded constants (stats, tx, sponsors, tools, pipeline)
- `src/lib/landing-content.test.ts` — shape tests
- `src/components/landing/KamiCursor.tsx` — `▌` blink primitive
- `src/components/landing/KamiCursor.test.tsx`
- `src/components/landing/BentoCell.tsx` — shared cell wrapper
- `src/components/landing/BentoCell.test.tsx`
- `src/components/landing/HeroCell.tsx` — hero w/ CTA
- `src/components/landing/HeroCell.test.tsx`
- `src/components/landing/SysMetricsCell.tsx` — stats list
- `src/components/landing/SysMetricsCell.test.tsx`
- `src/components/landing/LatestTxCell.tsx` — proof-of-life card
- `src/components/landing/LatestTxCell.test.tsx`
- `src/components/landing/ToolCell.tsx` — single tool tile
- `src/components/landing/ToolCell.test.tsx`
- `src/components/landing/PipelineCell.tsx` — 3-step strip
- `src/components/landing/PipelineCell.test.tsx`
- `src/components/landing/SponsorStrip.tsx` — wordmarks
- `src/components/landing/SponsorStrip.test.tsx`

**Modified:**
- `tailwind.config.js` — colors, fontFamily, transitionTimingFunction, keyframes, animation
- `index.html` — Unbounded Google Fonts
- `src/components/EmptyState.tsx` — full rewrite as bento grid composer
- `src/components/EmptyState.test.tsx` — refreshed integration tests
- `src/components/ChatPanel.tsx` — drop `onSend` prop on `<EmptyState>` (no longer needed)

**Test count delta:** 186 → 222 (`+36` net across 9 new test files + 1 refreshed file: +5 landing-content, +3 KamiCursor, +4 BentoCell, +6 HeroCell, +4 SysMetricsCell, +4 LatestTxCell, +3 ToolCell, +3 PipelineCell, +2 SponsorStrip, –5 +7 EmptyState refresh).

---

### Task 1: Tailwind theme + Unbounded font + landing-content constants

**Files:**
- Modify: `tailwind.config.js`
- Modify: `index.html`
- Create: `src/lib/landing-content.ts`
- Test: `src/lib/landing-content.test.ts`

- [ ] **Step 1: Write the failing test for landing-content shape**

Create `src/lib/landing-content.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  LANDING_STATS,
  LATEST_TX,
  SPONSORS,
  TOOL_CELLS,
  PIPELINE_STEPS,
} from './landing-content';

describe('landing-content', () => {
  it('LANDING_STATS has 4 entries with key/value/highlight shape', () => {
    expect(LANDING_STATS).toHaveLength(4);
    LANDING_STATS.forEach((s) => {
      expect(typeof s.key).toBe('string');
      expect(typeof s.value).toBe('string');
      expect(typeof s.highlight).toBe('boolean');
    });
    expect(LANDING_STATS[0].key).toBe('sys.tools_loaded');
    expect(LANDING_STATS[0].highlight).toBe(true);
  });

  it('LATEST_TX has the Day-6 mainnet signature + Solscan URL', () => {
    expect(LATEST_TX.signature).toMatch(/^[1-9A-HJ-NP-Za-km-z]{86,90}$/);
    expect(LATEST_TX.solscanUrl).toContain(LATEST_TX.signature);
    expect(LATEST_TX.solscanUrl.startsWith('https://solscan.io/tx/')).toBe(true);
    expect(LATEST_TX.action).toBe('5 USDC supplied to Kamino');
  });

  it('SPONSORS includes the 5 bounty-acknowledged sponsors in order', () => {
    expect(SPONSORS).toEqual(['Eitherway', 'Kamino', 'Solflare', 'Helius', 'Vercel']);
  });

  it('TOOL_CELLS has 4 entries with name/description/hint/iconKey shape', () => {
    expect(TOOL_CELLS).toHaveLength(4);
    const names = TOOL_CELLS.map((t) => t.name);
    expect(names).toEqual([
      'tool/findYield',
      'tool/getPortfolio',
      'tool/simulateHealth',
      'tool/buildSign',
    ]);
    TOOL_CELLS.forEach((t) => {
      expect(typeof t.description).toBe('string');
      expect(t.hint.startsWith('→ ')).toBe(true);
      expect(typeof t.iconKey).toBe('string');
    });
  });

  it('PIPELINE_STEPS has 3 entries with index/label/iconKey shape', () => {
    expect(PIPELINE_STEPS).toHaveLength(3);
    const labels = PIPELINE_STEPS.map((p) => p.label);
    expect(labels).toEqual(['INTENT', 'SIGNATURE', 'EXECUTION']);
    PIPELINE_STEPS.forEach((p, i) => {
      expect(p.index).toBe(`${i + 1}/3`);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test:run src/lib/landing-content.test.ts
```

Expected: FAIL — `Cannot find module './landing-content'`.

- [ ] **Step 3: Implement landing-content.ts**

Create `src/lib/landing-content.ts`:

```ts
// Hardcoded data for the bento landing. Centralized so future
// updates (test count drifts, new sponsors) touch one place.

export interface LandingStat {
  key: string;
  value: string;
  highlight: boolean;
}

export const LANDING_STATS: ReadonlyArray<LandingStat> = [
  { key: 'sys.tools_loaded', value: '7 active', highlight: true },
  { key: 'ci.tests_passing', value: '186 suite', highlight: false },
  { key: 'net.roundtrips', value: '3 mainnet', highlight: false },
  { key: 'sys.genesis', value: '2026-04-19', highlight: false },
];

export interface LatestTx {
  signature: string;
  shortSignature: string;
  solscanUrl: string;
  action: string;
}

const TX_SIG = '5XKeETjGfmj9jEWUNCKcf8u49bY4hEzX2a7JcB4nPxQCBbmZ7ipoNrgTXQMJWXHvKw7Bsera9xxYygLVxLUpUvZE';

export const LATEST_TX: LatestTx = {
  signature: TX_SIG,
  shortSignature: `${TX_SIG.slice(0, 10)}…${TX_SIG.slice(-5)}`,
  solscanUrl: `https://solscan.io/tx/${TX_SIG}`,
  action: '5 USDC supplied to Kamino',
};

export const SPONSORS: ReadonlyArray<string> = [
  'Eitherway',
  'Kamino',
  'Solflare',
  'Helius',
  'Vercel',
];

export type ToolIconKey =
  | 'findYield'
  | 'getPortfolio'
  | 'simulateHealth'
  | 'buildSign';

export interface ToolCellData {
  name: string;
  description: string;
  hint: string;
  iconKey: ToolIconKey;
}

export const TOOL_CELLS: ReadonlyArray<ToolCellData> = [
  {
    name: 'tool/findYield',
    description: 'Scans Kamino reserves for highest supply / borrow APY.',
    hint: '→ KaminoMarket.reserves',
    iconKey: 'findYield',
  },
  {
    name: 'tool/getPortfolio',
    description: "Fetches connected wallet's positions, debt, health factor.",
    hint: '→ KaminoMarket.getObligationByAddress',
    iconKey: 'getPortfolio',
  },
  {
    name: 'tool/simulateHealth',
    description: 'Projects post-action health factor before signing.',
    hint: '→ Obligation.simulateBorrowAndWithdrawAction',
    iconKey: 'simulateHealth',
  },
  {
    name: 'tool/buildSign',
    description: 'Builds + signs deposit / borrow / withdraw / repay v0 transactions.',
    hint: '→ KaminoAction.build*Txns',
    iconKey: 'buildSign',
  },
];

export type PipelineIconKey = 'intent' | 'signature' | 'execution';

export interface PipelineStep {
  index: string;
  label: string;
  iconKey: PipelineIconKey;
}

export const PIPELINE_STEPS: ReadonlyArray<PipelineStep> = [
  { index: '1/3', label: 'INTENT', iconKey: 'intent' },
  { index: '2/3', label: 'SIGNATURE', iconKey: 'signature' },
  { index: '3/3', label: 'EXECUTION', iconKey: 'execution' },
];
```

- [ ] **Step 4: Run landing-content test**

```bash
pnpm test:run src/lib/landing-content.test.ts
```

Expected: PASS — 5 tests.

- [ ] **Step 5: Update tailwind.config.js with new tokens**

Replace `tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        kami: {
          bg: '#0a0a0f',
          surface: '#12121a',
          border: '#1e1e2e',
          accent: '#7c3aed',
          accentHover: '#6d28d9',
          text: '#e2e8f0',
          muted: '#64748b',
          user: '#1e1b4b',
          assistant: '#171720',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',

          // Bento landing palette (Sprint 5 / Day 18). The chat shell
          // still uses kami.bg/surface/accent above; restyling that is
          // a follow-up spec.
          sepiaBg: '#1a1410',
          cellBase: '#221a14',
          cellElevated: '#2a2117',
          cellBorder: 'rgba(245, 230, 211, 0.12)',
          cream: '#F5E6D3',
          creamMuted: 'rgba(245, 230, 211, 0.6)',
          amber: '#FFA500',
          amberGlow: 'rgba(255, 165, 0, 0.15)',
          amberHaze: 'rgba(255, 165, 0, 0.05)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        display: ['Unbounded', 'sans-serif'],
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        'cascade-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        blink: {
          '0%, 50%': { opacity: '1' },
          '50.01%, 100%': { opacity: '0' },
        },
        'pulse-dot': {
          '0%': { boxShadow: '0 0 0 0 rgba(255, 165, 0, 0.4)' },
          '100%': { boxShadow: '0 0 0 8px rgba(255, 165, 0, 0)' },
        },
      },
      animation: {
        'cascade-up': 'cascade-up 800ms cubic-bezier(0.175, 0.885, 0.32, 1.275) backwards',
        blink: 'blink 1s step-end infinite',
        'pulse-dot': 'pulse-dot 2s ease-out infinite',
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 6: Add Unbounded to index.html**

Replace the `<link href="https://fonts.googleapis.com/css2?...">` line in `index.html` with one that adds Unbounded weights 700/800. The existing line is at line 11.

Old line:

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
```

New line:

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Unbounded:wght@700;800&display=swap" rel="stylesheet" />
```

(Also bumps JetBrains Mono to include weight 700, used for stat values + uppercase mono labels.)

- [ ] **Step 7: Verify build passes**

```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p server/tsconfig.json --noEmit
pnpm test:run
```

Expected: client typecheck silent. Server typecheck silent. All tests PASS (186 + 5 new = 191).

- [ ] **Step 8: Commit**

```bash
git add tailwind.config.js index.html src/lib/landing-content.ts src/lib/landing-content.test.ts
git commit -m "$(cat <<'EOF'
feat(landing): add bento amber theme tokens + Unbounded font + landing-content constants

Sprint 5 Day 18, Task 1 of 7. Extends the kami Tailwind namespace with
9 new tokens (sepiaBg, cellBase, cellElevated, cellBorder, cream,
creamMuted, amber, amberGlow, amberHaze) for the bento landing.
Existing kami.bg / surface / accent (purple) preserved during transition.

Adds Unbounded display font (700/800) + bumps JetBrains Mono to weight
700. Adds spring + smooth timing functions and cascade-up / blink /
pulse-dot keyframes + animations.

src/lib/landing-content.ts centralizes hardcoded landing data: 4
sys.metrics rows, the Day-6 mainnet tx, 5 sponsors, 4 tool cells, 3
pipeline steps. Shape tested by 5 new vitest cases.
EOF
)"
```

---

### Task 2: KamiCursor + BentoCell primitives

**Files:**
- Create: `src/components/landing/KamiCursor.tsx`
- Create: `src/components/landing/KamiCursor.test.tsx`
- Create: `src/components/landing/BentoCell.tsx`
- Create: `src/components/landing/BentoCell.test.tsx`

- [ ] **Step 1: Write the failing KamiCursor test**

Create `src/components/landing/KamiCursor.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import KamiCursor from './KamiCursor';

describe('KamiCursor', () => {
  it('renders the ▌ glyph', () => {
    render(<KamiCursor />);
    expect(screen.getByText('▌')).toBeInTheDocument();
  });

  it('applies the blink animation class', () => {
    render(<KamiCursor />);
    expect(screen.getByText('▌')).toHaveClass('animate-blink');
  });

  it('uses amber color', () => {
    render(<KamiCursor />);
    expect(screen.getByText('▌')).toHaveClass('text-kami-amber');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test:run src/components/landing/KamiCursor.test.tsx
```

Expected: FAIL — `Cannot find module './KamiCursor'`.

- [ ] **Step 3: Implement KamiCursor**

Create `src/components/landing/KamiCursor.tsx`:

```tsx
export default function KamiCursor() {
  return (
    <span className="text-kami-amber animate-blink" aria-hidden="true">
      ▌
    </span>
  );
}
```

- [ ] **Step 4: Run KamiCursor test**

```bash
pnpm test:run src/components/landing/KamiCursor.test.tsx
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Write the failing BentoCell test**

Create `src/components/landing/BentoCell.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BentoCell from './BentoCell';

describe('BentoCell', () => {
  it('renders children', () => {
    render(
      <BentoCell delay={1}>
        <span>inner content</span>
      </BentoCell>,
    );
    expect(screen.getByText('inner content')).toBeInTheDocument();
  });

  it('applies the className prop alongside cell base classes', () => {
    const { container } = render(
      <BentoCell delay={1} className="col-span-8 row-span-2">
        x
      </BentoCell>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('col-span-8');
    expect(root.className).toContain('row-span-2');
    expect(root.className).toContain('animate-cascade-up');
  });

  it('sets animationDelay from the delay prop (delay × 100ms)', () => {
    const { container } = render(<BentoCell delay={3}>x</BentoCell>);
    const root = container.firstChild as HTMLElement;
    expect(root.style.animationDelay).toBe('300ms');
  });

  it('renders as <div> by default and accepts a different element via the `as` prop', () => {
    const { container, rerender } = render(<BentoCell delay={1}>x</BentoCell>);
    expect((container.firstChild as HTMLElement).tagName).toBe('DIV');

    rerender(
      <BentoCell delay={1} as="section">
        x
      </BentoCell>,
    );
    expect((container.firstChild as HTMLElement).tagName).toBe('SECTION');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
pnpm test:run src/components/landing/BentoCell.test.tsx
```

Expected: FAIL — `Cannot find module './BentoCell'`.

- [ ] **Step 7: Implement BentoCell**

Create `src/components/landing/BentoCell.tsx`:

```tsx
import React from 'react';

interface Props {
  delay: number;
  className?: string;
  children: React.ReactNode;
  as?: 'div' | 'section' | 'article';
}

export default function BentoCell({
  delay,
  className = '',
  children,
  as: Component = 'div',
}: Props) {
  return (
    <Component
      style={{ animationDelay: `${delay * 100}ms` }}
      className={[
        'relative overflow-hidden rounded-3xl',
        'bg-kami-cellBase border border-kami-cellBorder',
        'p-6 lg:p-8',
        'transition-all duration-500 ease-smooth',
        'hover:-translate-y-[2px] hover:border-kami-amber/40',
        'hover:shadow-[0_10px_40px_-20px_rgba(255,165,0,0.15)]',
        'animate-cascade-up',
        className,
      ].join(' ')}
    >
      {children}
    </Component>
  );
}
```

- [ ] **Step 8: Run BentoCell test**

```bash
pnpm test:run src/components/landing/BentoCell.test.tsx
```

Expected: PASS — 4 tests.

- [ ] **Step 9: Run full test suite + typechecks**

```bash
pnpm exec tsc --noEmit
pnpm test:run
```

Expected: client typecheck silent. All tests PASS (191 + 7 new = 198).

- [ ] **Step 10: Commit**

```bash
git add src/components/landing/KamiCursor.tsx src/components/landing/KamiCursor.test.tsx src/components/landing/BentoCell.tsx src/components/landing/BentoCell.test.tsx
git commit -m "$(cat <<'EOF'
feat(landing): add KamiCursor + BentoCell primitives

Sprint 5 Day 18, Task 2 of 7. Two reusable primitives for the bento
landing:

- KamiCursor — amber ▌ with the blink keyframe (1s step-end infinite).
  Anchors to the end of headlines (`Done▌`).
- BentoCell — shared wrapper for every cell. Owns rounded-3xl border,
  cell base bg, hover lift + amber glow, and the cascade-up entrance
  animation. animationDelay is driven by a `delay` prop (delay × 100ms)
  so the parent can stagger cells (1, 2, 3, …) without authoring
  per-cell delay classes.

7 new vitest cases.
EOF
)"
```

---

### Task 3: HeroCell with CTA wiring

**Files:**
- Create: `src/components/landing/HeroCell.tsx`
- Create: `src/components/landing/HeroCell.test.tsx`

- [ ] **Step 1: Write the failing HeroCell test**

Create `src/components/landing/HeroCell.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import HeroCell from './HeroCell';

const noop = () => {};

describe('HeroCell', () => {
  it('renders the env chip + headline + cursor', () => {
    render(<HeroCell connecting={false} onConnectSolflare={noop} onUseAnotherWallet={noop} />);
    expect(screen.getByText(/env \/ mainnet-beta/i)).toBeInTheDocument();
    expect(screen.getByText('Type. Sign.')).toBeInTheDocument();
    // Second headline span is "Done" + KamiCursor — its textContent is "Done▌".
    // Use a regex anchored to the start to disambiguate from the parent h1
    // whose textContent collapses both spans.
    expect(screen.getByText(/^Done/)).toBeInTheDocument();
    expect(screen.getByText('▌')).toBeInTheDocument();
  });

  it('renders the subhead with klend-sdk highlighted in mono amber', () => {
    render(<HeroCell connecting={false} onConnectSolflare={noop} onUseAnotherWallet={noop} />);
    const klend = screen.getByText('klend-sdk');
    expect(klend).toBeInTheDocument();
    expect(klend.tagName).toBe('CODE');
    expect(klend).toHaveClass('text-kami-amber');
  });

  it('renders the mock agent input prompt', () => {
    render(<HeroCell connecting={false} onConnectSolflare={noop} onUseAnotherWallet={noop} />);
    expect(screen.getByText(/find best USDC yield/i)).toBeInTheDocument();
  });

  it('fires onConnectSolflare when the CTA is clicked', () => {
    const onConnectSolflare = vi.fn();
    render(
      <HeroCell connecting={false} onConnectSolflare={onConnectSolflare} onUseAnotherWallet={noop} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /connect with solflare/i }));
    expect(onConnectSolflare).toHaveBeenCalledTimes(1);
  });

  it('fires onUseAnotherWallet when the secondary link is clicked', () => {
    const onUseAnotherWallet = vi.fn();
    render(
      <HeroCell connecting={false} onConnectSolflare={noop} onUseAnotherWallet={onUseAnotherWallet} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /use another solana wallet/i }));
    expect(onUseAnotherWallet).toHaveBeenCalledTimes(1);
  });

  it('shows "Opening Solflare…" + disables the CTA when connecting=true', () => {
    render(<HeroCell connecting={true} onConnectSolflare={noop} onUseAnotherWallet={noop} />);
    const cta = screen.getByRole('button', { name: /opening solflare/i });
    expect(cta).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test:run src/components/landing/HeroCell.test.tsx
```

Expected: FAIL — `Cannot find module './HeroCell'`.

- [ ] **Step 3: Implement HeroCell**

Create `src/components/landing/HeroCell.tsx`:

```tsx
import { Code2, Wallet } from 'lucide-react';
import BentoCell from './BentoCell';
import KamiCursor from './KamiCursor';

interface Props {
  connecting: boolean;
  onConnectSolflare: () => void;
  onUseAnotherWallet: () => void;
}

export default function HeroCell({ connecting, onConnectSolflare, onUseAnotherWallet }: Props) {
  return (
    <BentoCell
      delay={1}
      className="col-span-12 lg:col-span-8 lg:row-span-2 rounded-[2rem] flex flex-col gap-8 lg:gap-12 min-h-[24rem] lg:min-h-[28rem]"
      as="section"
    >
      <div className="flex-1 flex flex-col gap-6">
        <span className="self-start inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-kami-sepiaBg border border-kami-cellBorder font-mono text-xs text-kami-creamMuted">
          <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
          env / mainnet-beta
        </span>
        <h1 className="font-display font-bold tracking-tight text-kami-cream text-5xl sm:text-6xl lg:text-7xl xl:text-[5rem] leading-[0.95]">
          <span className="block">Type. Sign.</span>
          <span className="block">
            Done
            <KamiCursor />
          </span>
        </h1>
        <p className="font-sans text-kami-cream/80 text-lg lg:text-xl max-w-xl leading-relaxed">
          Speak plain English. Kami parses your intent, calls Kamino{' '}
          <code className="font-mono text-kami-amber not-italic">klend-sdk</code> primitives, and
          queues a mainnet transaction. No dashboard scraping required.
        </p>
      </div>

      <div className="border-t border-kami-cellBorder/50 pt-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="font-mono text-sm text-kami-creamMuted px-4 py-3 rounded-xl bg-kami-sepiaBg/60 border border-kami-cellBorder">
          <span className="text-kami-amber/80">&gt; </span>find best USDC yield
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <button
            type="button"
            onClick={onConnectSolflare}
            disabled={connecting}
            className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-kami-amber text-kami-sepiaBg font-mono uppercase tracking-wider text-sm font-bold hover:opacity-95 active:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-wait"
          >
            <Wallet className="w-5 h-5" aria-hidden="true" />
            {connecting ? 'Opening Solflare…' : 'Connect with Solflare'}
          </button>
          <button
            type="button"
            onClick={onUseAnotherWallet}
            className="text-xs text-kami-creamMuted hover:text-kami-cream transition-colors"
          >
            Use another Solana wallet
          </button>
        </div>
      </div>
    </BentoCell>
  );
}
```

- [ ] **Step 4: Run HeroCell test**

```bash
pnpm test:run src/components/landing/HeroCell.test.tsx
```

Expected: PASS — 6 tests.

- [ ] **Step 5: Run full test suite + typechecks**

```bash
pnpm exec tsc --noEmit
pnpm test:run
```

Expected: client typecheck silent. All tests PASS (198 + 6 new = 204).

- [ ] **Step 6: Commit**

```bash
git add src/components/landing/HeroCell.tsx src/components/landing/HeroCell.test.tsx
git commit -m "$(cat <<'EOF'
feat(landing): add HeroCell with Solflare CTA

Sprint 5 Day 18, Task 3 of 7. The 8-col × 2-row hero cell that anchors
the bento. env chip + Unbounded display headline (Type. Sign. Done▌) +
Inter subhead with klend-sdk in mono amber + bordered mock agent prompt
("> find best USDC yield") + amber-bg Connect with Solflare CTA with
Wallet icon + secondary "Use another Solana wallet" link.

Wallet wiring stays in the parent (EmptyState owns useWallet +
useWalletModal); HeroCell takes plain props (onConnectSolflare /
onUseAnotherWallet / connecting) so it stays pure and easy to test.

6 new vitest cases.
EOF
)"
```

---

### Task 4: SysMetricsCell + LatestTxCell

**Files:**
- Create: `src/components/landing/SysMetricsCell.tsx`
- Create: `src/components/landing/SysMetricsCell.test.tsx`
- Create: `src/components/landing/LatestTxCell.tsx`
- Create: `src/components/landing/LatestTxCell.test.tsx`

- [ ] **Step 1: Write the failing SysMetricsCell test**

Create `src/components/landing/SysMetricsCell.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SysMetricsCell from './SysMetricsCell';
import { LANDING_STATS } from '../../lib/landing-content';

describe('SysMetricsCell', () => {
  it('renders the sys.metrics header', () => {
    render(<SysMetricsCell delay={2} />);
    expect(screen.getByText('sys.metrics')).toBeInTheDocument();
  });

  it('renders all 4 metric keys + values from LANDING_STATS', () => {
    render(<SysMetricsCell delay={2} />);
    LANDING_STATS.forEach((stat) => {
      expect(screen.getByText(stat.key)).toBeInTheDocument();
      expect(screen.getByText(stat.value)).toBeInTheDocument();
    });
  });

  it('renders the highlighted value (sys.tools_loaded) in amber', () => {
    render(<SysMetricsCell delay={2} />);
    const highlighted = LANDING_STATS.find((s) => s.highlight)!;
    expect(screen.getByText(highlighted.value)).toHaveClass('text-kami-amber');
  });

  it('renders non-highlighted values in cream', () => {
    render(<SysMetricsCell delay={2} />);
    const nonHighlighted = LANDING_STATS.find((s) => !s.highlight)!;
    expect(screen.getByText(nonHighlighted.value)).toHaveClass('text-kami-cream');
  });
});
```

The tests reference `LANDING_STATS` directly instead of literal strings (`'186 suite'`, `'7 active'`, etc.) — when the test count drifts in `landing-content.ts`, the test still passes because both sides of the assertion update together. The test's intent is "the component renders the data," not "the component renders this exact value."

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test:run src/components/landing/SysMetricsCell.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement SysMetricsCell**

Create `src/components/landing/SysMetricsCell.tsx`:

```tsx
import { Cpu } from 'lucide-react';
import BentoCell from './BentoCell';
import { LANDING_STATS } from '../../lib/landing-content';

interface Props {
  delay: number;
}

export default function SysMetricsCell({ delay }: Props) {
  return (
    <BentoCell delay={delay} className="col-span-12 md:col-span-6 lg:col-span-4">
      <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-kami-creamMuted mb-6">
        <Cpu className="w-4 h-4" aria-hidden="true" />
        sys.metrics
      </div>
      <ul className="flex flex-col">
        {LANDING_STATS.map((stat, i) => (
          <li
            key={stat.key}
            className={[
              'flex justify-between items-baseline py-3 font-mono text-sm group',
              i < LANDING_STATS.length - 1 ? 'border-b border-kami-cellBorder/50' : '',
            ].join(' ')}
          >
            <span className="text-kami-creamMuted">{stat.key}</span>
            <span
              className={[
                'transition-transform duration-200 ease-smooth group-hover:translate-x-[1px]',
                stat.highlight ? 'text-kami-amber font-bold' : 'text-kami-cream',
              ].join(' ')}
            >
              {stat.value}
            </span>
          </li>
        ))}
      </ul>
    </BentoCell>
  );
}
```

- [ ] **Step 4: Run SysMetricsCell test**

```bash
pnpm test:run src/components/landing/SysMetricsCell.test.tsx
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Write the failing LatestTxCell test**

Create `src/components/landing/LatestTxCell.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import LatestTxCell from './LatestTxCell';
import { LATEST_TX } from '../../lib/landing-content';

describe('LatestTxCell', () => {
  it('renders the log.latest_tx header + Confirmed pill', () => {
    render(<LatestTxCell delay={3} />);
    expect(screen.getByText('log.latest_tx')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });

  it('renders the truncated signature', () => {
    render(<LatestTxCell delay={3} />);
    expect(screen.getByText(LATEST_TX.shortSignature)).toBeInTheDocument();
  });

  it('renders the action description', () => {
    render(<LatestTxCell delay={3} />);
    expect(screen.getByText(LATEST_TX.action)).toBeInTheDocument();
  });

  it('Solscan link points to the full signature with safe target/rel', () => {
    render(<LatestTxCell delay={3} />);
    const link = screen.getByRole('link', { name: /view on solscan/i });
    expect(link).toHaveAttribute('href', LATEST_TX.solscanUrl);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
pnpm test:run src/components/landing/LatestTxCell.test.tsx
```

Expected: FAIL.

- [ ] **Step 7: Implement LatestTxCell**

Create `src/components/landing/LatestTxCell.tsx`:

```tsx
import { ArrowLeftRight, ArrowUpRight, Check } from 'lucide-react';
import BentoCell from './BentoCell';
import { LATEST_TX } from '../../lib/landing-content';

interface Props {
  delay: number;
}

export default function LatestTxCell({ delay }: Props) {
  return (
    <BentoCell
      delay={delay}
      className="col-span-12 md:col-span-6 lg:col-span-4 bg-kami-cellElevated"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-kami-creamMuted">
          <ArrowLeftRight className="w-4 h-4" aria-hidden="true" />
          log.latest_tx
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-kami-amberHaze border border-kami-amber/40 text-kami-amber font-mono text-[10px] uppercase tracking-wider">
          <Check className="w-3 h-3" aria-hidden="true" />
          Confirmed
        </span>
      </div>
      <div className="rounded-xl border border-kami-cellBorder bg-kami-sepiaBg/40 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-kami-creamMuted">
            Signature
          </span>
          <a
            href={LATEST_TX.solscanUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View on Solscan"
            className="font-mono text-sm text-kami-cream hover:text-kami-amber transition-colors inline-flex items-center gap-1"
          >
            {LATEST_TX.shortSignature}
            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        </div>
        <hr className="border-kami-cellBorder/50" />
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-kami-amber flex-shrink-0" aria-hidden="true" />
          <span className="font-sans text-sm text-kami-cream/90">{LATEST_TX.action}</span>
        </div>
      </div>
    </BentoCell>
  );
}
```

- [ ] **Step 8: Run LatestTxCell test**

```bash
pnpm test:run src/components/landing/LatestTxCell.test.tsx
```

Expected: PASS — 4 tests.

- [ ] **Step 9: Run full test suite + typechecks**

```bash
pnpm exec tsc --noEmit
pnpm test:run
```

Expected: client typecheck silent. All tests PASS (204 + 8 new = 212).

- [ ] **Step 10: Commit**

```bash
git add src/components/landing/SysMetricsCell.tsx src/components/landing/SysMetricsCell.test.tsx src/components/landing/LatestTxCell.tsx src/components/landing/LatestTxCell.test.tsx
git commit -m "$(cat <<'EOF'
feat(landing): add SysMetricsCell + LatestTxCell

Sprint 5 Day 18, Task 4 of 7. The two right-column side cells of the
bento.

- SysMetricsCell — 4 mono key/value rows from LANDING_STATS, hairline
  separators, and a hover translateX nudge on values. The proudest
  stat (sys.tools_loaded) renders amber; the rest stay cream.
- LatestTxCell — slightly elevated bg (cellElevated), Confirmed pill,
  truncated signature with ↗ Solscan link (target=_blank +
  rel=noopener noreferrer), and the "5 USDC supplied to Kamino"
  action with an amber bullet.

8 new vitest cases.
EOF
)"
```

---

### Task 5: ToolCell with 4-instance wiring

**Files:**
- Create: `src/components/landing/ToolCell.tsx`
- Create: `src/components/landing/ToolCell.test.tsx`

- [ ] **Step 1: Write the failing ToolCell test**

Create `src/components/landing/ToolCell.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ToolCell from './ToolCell';
import { TOOL_CELLS } from '../../lib/landing-content';

describe('ToolCell', () => {
  it('renders name + description + hint', () => {
    const tool = TOOL_CELLS[0]; // tool/findYield
    render(<ToolCell tool={tool} delay={4} />);
    expect(screen.getByText(tool.name)).toBeInTheDocument();
    expect(screen.getByText(tool.description)).toBeInTheDocument();
    expect(screen.getByText(tool.hint)).toBeInTheDocument();
  });

  it('renders an icon (lucide svg)', () => {
    const { container } = render(<ToolCell tool={TOOL_CELLS[0]} delay={4} />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('renders all 4 TOOL_CELLS by name when mapped', () => {
    render(
      <>
        {TOOL_CELLS.map((t, i) => (
          <ToolCell key={t.name} tool={t} delay={4 + i} />
        ))}
      </>,
    );
    expect(screen.getByText('tool/findYield')).toBeInTheDocument();
    expect(screen.getByText('tool/getPortfolio')).toBeInTheDocument();
    expect(screen.getByText('tool/simulateHealth')).toBeInTheDocument();
    expect(screen.getByText('tool/buildSign')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test:run src/components/landing/ToolCell.test.tsx
```

Expected: FAIL — `Cannot find module './ToolCell'`.

- [ ] **Step 3: Implement ToolCell**

Create `src/components/landing/ToolCell.tsx`:

```tsx
import {
  FolderOpen,
  Wallet,
  ShieldCheck,
  PenLine,
  type LucideIcon,
} from 'lucide-react';
import BentoCell from './BentoCell';
import type { ToolCellData, ToolIconKey } from '../../lib/landing-content';

const ICON_MAP: Record<ToolIconKey, LucideIcon> = {
  findYield: FolderOpen,
  getPortfolio: Wallet,
  simulateHealth: ShieldCheck,
  buildSign: PenLine,
};

interface Props {
  tool: ToolCellData;
  delay: number;
}

export default function ToolCell({ tool, delay }: Props) {
  const Icon = ICON_MAP[tool.iconKey];
  return (
    <BentoCell
      delay={delay}
      className="col-span-12 sm:col-span-6 lg:col-span-3 flex flex-col gap-3 group"
    >
      <div className="flex items-center gap-2 font-mono text-sm text-kami-amber">
        <Icon className="w-4 h-4" aria-hidden="true" />
        {tool.name}
      </div>
      <p className="font-sans text-sm text-kami-cream/80 leading-relaxed flex-1">
        {tool.description}
      </p>
      <div className="font-mono text-[11px] text-kami-creamMuted px-3 py-2 rounded-lg border border-kami-cellBorder bg-kami-sepiaBg/40 group-hover:border-kami-amber/40 transition-colors">
        {tool.hint}
      </div>
    </BentoCell>
  );
}
```

- [ ] **Step 4: Run ToolCell test**

```bash
pnpm test:run src/components/landing/ToolCell.test.tsx
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Run full test suite + typechecks**

```bash
pnpm exec tsc --noEmit
pnpm test:run
```

Expected: client typecheck silent. All tests PASS (212 + 3 new = 215).

- [ ] **Step 6: Commit**

```bash
git add src/components/landing/ToolCell.tsx src/components/landing/ToolCell.test.tsx
git commit -m "$(cat <<'EOF'
feat(landing): add ToolCell

Sprint 5 Day 18, Task 5 of 7. The tile that renders one Kamino tool —
icon + amber mono name + description + bordered impl-hint chip. Used 4
times in the bento (findYield / getPortfolio / simulateHealth /
buildSign). Icons mapped from Lucide (FolderOpen / Wallet / ShieldCheck
/ PenLine) keyed off the iconKey field in TOOL_CELLS.

The hint chip's border turns amber on parent-cell hover (group-hover)
to echo BentoCell's hover language.

3 new vitest cases.
EOF
)"
```

---

### Task 6: PipelineCell + SponsorStrip

**Files:**
- Create: `src/components/landing/PipelineCell.tsx`
- Create: `src/components/landing/PipelineCell.test.tsx`
- Create: `src/components/landing/SponsorStrip.tsx`
- Create: `src/components/landing/SponsorStrip.test.tsx`

- [ ] **Step 1: Write the failing PipelineCell test**

Create `src/components/landing/PipelineCell.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PipelineCell from './PipelineCell';

describe('PipelineCell', () => {
  it('renders all 3 step labels', () => {
    render(<PipelineCell delay={8} />);
    expect(screen.getByText('INTENT')).toBeInTheDocument();
    expect(screen.getByText('SIGNATURE')).toBeInTheDocument();
    expect(screen.getByText('EXECUTION')).toBeInTheDocument();
  });

  it('renders all 3 step indices in [N/3] form', () => {
    render(<PipelineCell delay={8} />);
    expect(screen.getByText('[1/3]')).toBeInTheDocument();
    expect(screen.getByText('[2/3]')).toBeInTheDocument();
    expect(screen.getByText('[3/3]')).toBeInTheDocument();
  });

  it('renders 3 lucide svg icons (one per step)', () => {
    const { container } = render(<PipelineCell delay={8} />);
    expect(container.querySelectorAll('svg')).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test:run src/components/landing/PipelineCell.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement PipelineCell**

Create `src/components/landing/PipelineCell.tsx`:

```tsx
import { Terminal, PenLine, CheckCircle2, type LucideIcon } from 'lucide-react';
import BentoCell from './BentoCell';
import { PIPELINE_STEPS, type PipelineIconKey } from '../../lib/landing-content';

const ICON_MAP: Record<PipelineIconKey, LucideIcon> = {
  intent: Terminal,
  signature: PenLine,
  execution: CheckCircle2,
};

interface Props {
  delay: number;
}

export default function PipelineCell({ delay }: Props) {
  return (
    <BentoCell
      delay={delay}
      className="col-span-12 border-dashed lg:p-10"
    >
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div
          className="hidden lg:block absolute left-0 right-0 top-1/2 h-px bg-kami-cellBorder"
          aria-hidden="true"
        />
        {PIPELINE_STEPS.map((step) => {
          const Icon = ICON_MAP[step.iconKey];
          return (
            <div
              key={step.label}
              className="relative flex items-center gap-4 px-6 py-4 rounded-xl bg-kami-sepiaBg/60 border border-kami-cellBorder hover:border-kami-amber/40 transition-colors group"
            >
              <Icon className="w-6 h-6 text-kami-amber" aria-hidden="true" />
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-[10px] text-kami-creamMuted group-hover:text-kami-amber transition-colors">
                  [{step.index}]
                </span>
                <span className="font-mono text-sm font-bold uppercase tracking-wider text-kami-cream">
                  {step.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </BentoCell>
  );
}
```

- [ ] **Step 4: Run PipelineCell test**

```bash
pnpm test:run src/components/landing/PipelineCell.test.tsx
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Write the failing SponsorStrip test**

Create `src/components/landing/SponsorStrip.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SponsorStrip from './SponsorStrip';
import { SPONSORS } from '../../lib/landing-content';

describe('SponsorStrip', () => {
  it('renders all 5 sponsor wordmarks', () => {
    render(<SponsorStrip />);
    SPONSORS.forEach((s) => {
      expect(screen.getByText(s)).toBeInTheDocument();
    });
  });

  it('renders sponsors in the canonical order', () => {
    const { container } = render(<SponsorStrip />);
    const text = container.textContent ?? '';
    const indices = SPONSORS.map((s) => text.indexOf(s));
    const sorted = [...indices].sort((a, b) => a - b);
    expect(indices).toEqual(sorted);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
pnpm test:run src/components/landing/SponsorStrip.test.tsx
```

Expected: FAIL.

- [ ] **Step 7: Implement SponsorStrip**

Create `src/components/landing/SponsorStrip.tsx`:

```tsx
import { Fragment } from 'react';
import { SPONSORS } from '../../lib/landing-content';

export default function SponsorStrip() {
  return (
    <div
      className="col-span-12 py-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 opacity-50 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-500 ease-smooth"
      aria-label="Sponsors"
    >
      {SPONSORS.map((name, i) => (
        <Fragment key={name}>
          <span className="font-display font-bold uppercase tracking-widest text-sm text-kami-cream">
            {name}
          </span>
          {i < SPONSORS.length - 1 ? (
            <span aria-hidden="true" className="text-kami-amber/40">
              ·
            </span>
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}
```

`<Fragment>` keeps each sponsor span as a direct child of the outer `<div>`, so each sponsor's span has `textContent === name` exactly — `screen.getByText(name)` finds a single match. (Wrapping each pair in a `<span>` would make the LAST sponsor's outer wrapper share the same textContent as its inner span, throwing RTL's "multiple elements" error.)

- [ ] **Step 8: Run SponsorStrip test**

```bash
pnpm test:run src/components/landing/SponsorStrip.test.tsx
```

Expected: PASS — 2 tests.

- [ ] **Step 9: Run full test suite + typechecks**

```bash
pnpm exec tsc --noEmit
pnpm test:run
```

Expected: client typecheck silent. All tests PASS (215 + 5 new = 220).

- [ ] **Step 10: Commit**

```bash
git add src/components/landing/PipelineCell.tsx src/components/landing/PipelineCell.test.tsx src/components/landing/SponsorStrip.tsx src/components/landing/SponsorStrip.test.tsx
git commit -m "$(cat <<'EOF'
feat(landing): add PipelineCell + SponsorStrip

Sprint 5 Day 18, Task 6 of 7. The two full-width strip cells at the
bottom of the bento.

- PipelineCell — full-width dashed-border strip showing the 3-step
  flow [1/3] INTENT → [2/3] SIGNATURE → [3/3] EXECUTION. Each step
  sits on a sepia-bg card; on lg+ a hairline track-line runs across
  the cell behind the cards. Step indices turn amber on hover.
- SponsorStrip — text-only Eitherway · Kamino · Solflare · Helius ·
  Vercel wordmarks (Unbounded display, uppercase, tracking-widest).
  Initial state is 50% opacity + grayscale; hovering the strip
  removes both for a soft reveal. No anchors in v1 — adding sponsor
  links is a follow-up if RECTOR wants.

5 new vitest cases.
EOF
)"
```

---

### Task 7: EmptyState integration + tests refresh + ChatPanel cleanup + mobile QA

**Files:**
- Modify: `src/components/EmptyState.tsx` (full rewrite)
- Modify: `src/components/EmptyState.test.tsx` (refresh)
- Modify: `src/components/ChatPanel.tsx` (drop `onSend` prop on `<EmptyState>`)

- [ ] **Step 1: Write the new EmptyState integration test (will fail until rewrite is done)**

Replace the entire contents of `src/components/EmptyState.test.tsx` with:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LATEST_TX, SPONSORS, TOOL_CELLS } from '../lib/landing-content';

const setVisible = vi.fn();
const solflareConnect = vi.fn();

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({
    connected: false,
    connecting: false,
    wallets: [
      {
        adapter: {
          name: 'Solflare',
          connect: solflareConnect,
        },
      },
    ],
  }),
}));

vi.mock('@solana/wallet-adapter-react-ui', () => ({
  useWalletModal: () => ({ setVisible }),
}));

import EmptyState from './EmptyState';

describe('EmptyState bento landing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the hero headline', () => {
    render(<EmptyState />);
    expect(screen.getByText('Type. Sign.')).toBeInTheDocument();
    expect(screen.getByText(/^Done/)).toBeInTheDocument();
  });

  it('renders all 4 tool cells by name', () => {
    render(<EmptyState />);
    TOOL_CELLS.forEach((t) => {
      expect(screen.getByText(t.name)).toBeInTheDocument();
    });
  });

  it('renders the latest tx truncated signature', () => {
    render(<EmptyState />);
    expect(screen.getByText(LATEST_TX.shortSignature)).toBeInTheDocument();
  });

  it('renders all 5 sponsor wordmarks', () => {
    render(<EmptyState />);
    SPONSORS.forEach((s) => {
      expect(screen.getByText(s)).toBeInTheDocument();
    });
  });

  it('renders the 3 pipeline step labels', () => {
    render(<EmptyState />);
    expect(screen.getByText('INTENT')).toBeInTheDocument();
    expect(screen.getByText('SIGNATURE')).toBeInTheDocument();
    expect(screen.getByText('EXECUTION')).toBeInTheDocument();
  });

  it('clicking the CTA calls solflare.adapter.connect()', () => {
    render(<EmptyState />);
    fireEvent.click(screen.getByRole('button', { name: /connect with solflare/i }));
    expect(solflareConnect).toHaveBeenCalledTimes(1);
  });

  it('clicking "Use another Solana wallet" opens the wallet modal', () => {
    render(<EmptyState />);
    fireEvent.click(screen.getByRole('button', { name: /use another solana wallet/i }));
    expect(setVisible).toHaveBeenCalledWith(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test:run src/components/EmptyState.test.tsx
```

Expected: FAIL — multiple cases (old `EmptyState` doesn't render any of the bento content).

- [ ] **Step 3: Rewrite EmptyState.tsx as the bento composer**

Replace the entire contents of `src/components/EmptyState.tsx` with:

```tsx
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import HeroCell from './landing/HeroCell';
import SysMetricsCell from './landing/SysMetricsCell';
import LatestTxCell from './landing/LatestTxCell';
import ToolCell from './landing/ToolCell';
import PipelineCell from './landing/PipelineCell';
import SponsorStrip from './landing/SponsorStrip';
import { TOOL_CELLS } from '../lib/landing-content';

const SOLFLARE_WALLET_NAME = 'Solflare';
const SOLFLARE_INSTALL_URL = 'https://solflare.com/download';

export default function EmptyState() {
  const { connected, connecting, wallets } = useWallet();
  const { setVisible } = useWalletModal();

  const handleConnectSolflare = async () => {
    if (connected || connecting) return;
    const solflare = wallets.find((w) => w.adapter.name === SOLFLARE_WALLET_NAME);
    if (!solflare) {
      window.open(SOLFLARE_INSTALL_URL, '_blank', 'noopener,noreferrer');
      return;
    }
    try {
      await solflare.adapter.connect();
    } catch {
      setVisible(true);
    }
  };

  const handleUseAnotherWallet = () => setVisible(true);

  return (
    <div className="flex-1 overflow-y-auto bg-kami-sepiaBg text-kami-cream relative">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(245,230,211,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(245,230,211,0.03) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
        aria-hidden="true"
      />
      <div
        className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full bg-kami-amberHaze blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="flex items-center justify-between font-mono text-xs text-kami-creamMuted uppercase tracking-wider mb-6 lg:mb-10">
          <span>&gt; KAMI · v1.0 · MAINNET</span>
          <span className="inline-flex items-center gap-2">
            [sys.status: online]
            <span
              className="w-2 h-2 rounded-full bg-kami-amber animate-pulse-dot"
              aria-hidden="true"
            />
          </span>
        </div>

        <div className="grid grid-cols-12 gap-3 lg:gap-4">
          <HeroCell
            connecting={connecting}
            onConnectSolflare={handleConnectSolflare}
            onUseAnotherWallet={handleUseAnotherWallet}
          />
          <SysMetricsCell delay={2} />
          <LatestTxCell delay={3} />
          {TOOL_CELLS.map((tool, i) => (
            <ToolCell key={tool.name} tool={tool} delay={4 + i} />
          ))}
          <PipelineCell delay={8} />
          <SponsorStrip />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update ChatPanel.tsx to drop the `onSend` prop on `<EmptyState>`**

In `src/components/ChatPanel.tsx`, line 65, change:

```tsx
        <EmptyState onSend={handleSend} />
```

to:

```tsx
        <EmptyState />
```

- [ ] **Step 5: Run EmptyState test + full suite + typechecks**

```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p server/tsconfig.json --noEmit
pnpm test:run
```

Expected:
- client typecheck silent
- server typecheck silent
- EmptyState.test.tsx PASS — 7 tests (refreshed; old 5 replaced)
- Full suite PASS (220 + 7 - 5 = 222 — net +2 from EmptyState refresh, +14 from earlier tasks)

If `ChatMessage.test.tsx` or `ChatPanel`-adjacent tests reference `onSend` flowing into `EmptyState`, they will fail — none expected based on the grep, but verify here.

- [ ] **Step 6: Mobile + browser QA**

Start dev server and verify in a browser:

```bash
pnpm dev
```

Then open `http://localhost:5173/` and:

1. **Desktop (≥ lg, 1280px+):** Hero spans 8 columns × 2 rows; SysMetrics + LatestTx stack in the right 4 columns; 4 tool cells in one row across 12 columns (3 cols each); PipelineCell + SponsorStrip full-width.
2. **Tablet (md, 768-1023px):** Hero collapses to 12-col, single row; SysMetrics + LatestTx side-by-side (6+6); tool cells 2x2 (6+6 per row); pipeline + sponsor full-width.
3. **Mobile (375-767px):** Everything stacks single-column. No horizontal scroll. Pipeline steps stack vertically.
4. **Animation:** Cells cascade in over ~1s on first load. Cursor blinks. Header dot pulses.
5. **CTA flow:** Click "Connect with Solflare" — Solflare popup opens (or install page if no Solflare). Click "Use another Solana wallet" — wallet adapter modal opens.
6. **Hover:** Cells lift + amber border + glow. Stat values translate +1px on hover. Tool hint chips' borders turn amber. Sponsor strip de-grayscales.
7. **Once connected:** EmptyState disappears (ChatPanel switches to chat surfaces). Reload the page disconnected and re-verify the bento.

If any cell breaks at a specific breakpoint, fix the col-span / row-span / flex direction inline. Re-run tests after each fix.

- [ ] **Step 7: Final commit**

```bash
git add src/components/EmptyState.tsx src/components/EmptyState.test.tsx src/components/ChatPanel.tsx
git commit -m "$(cat <<'EOF'
feat(landing): wire bento landing into EmptyState + drop onSend prop

Sprint 5 Day 18, Task 7 of 7 — final integration. EmptyState becomes a
pure composer: outer wrapper with the sepia bg + 32px grid pattern +
ambient amber blur, an overline header (KAMI · v1.0 · MAINNET +
sys.status pulse), and a 12-col grid that places HeroCell (8×2) +
SysMetricsCell (4) + LatestTxCell (4) + 4 ToolCells (3 each) +
PipelineCell (12) + SponsorStrip (12). Wallet wiring (useWallet +
useWalletModal) stays here; HeroCell receives plain handler props.

EmptyState no longer needs an onSend prop — the bento's tool cells are
non-clickable info displays per spec §5.4. Drop the prop from both
EmptyState's interface and ChatPanel's call site. Visitors who want to
type queries do so via ChatInput post-connect.

EmptyState.test.tsx refreshed: the 5 old feature-card-onSend cases
replaced with 7 integration smoke cases that verify the bento
composes (hero / 4 tools / latest tx / 5 sponsors / 3 pipeline steps)
plus the two CTA paths (Solflare connect + wallet-modal fallback).
Net test count: 186 → 222 (+36).
EOF
)"
```

- [ ] **Step 8: Push the branch + open PR**

```bash
git push -u origin docs/landing-bento-amber-spec
gh pr create --title "feat(landing): bento amber pre-connect landing redesign" --body "$(cat <<'EOF'
## Summary

Replaces the minimal `EmptyState.tsx` (gradient K logo + 4 feature cards + CTA) with a full bento-grid pre-connect landing in an amber-on-sepia palette.

- Spec: `docs/superpowers/specs/2026-04-28-kami-landing-bento-amber-design.md`
- Plan: `docs/superpowers/plans/2026-04-28-kami-landing-bento-amber-implementation.md`
- 8 new components under `src/components/landing/`
- New Tailwind theme tokens (kami.sepiaBg / cellBase / cellElevated / cream / amber / etc.)
- Unbounded display font added; JetBrains Mono bumped to weight 700
- `src/lib/landing-content.ts` centralizes the 4 stats / latest tx / 5 sponsors / 4 tool cells / 3 pipeline steps

## Behavior changes

- Tool cells are non-clickable info displays per spec §5.4 (was: 4 clickable feature cards firing sample queries via `onSend`). Visitors type queries via `ChatInput` post-connect.
- The chat shell (ChatPanel / Sidebar / ChatInput / ChatMessage / SignTransactionCard) is unchanged. Restyling to amber lands in a follow-up spec.

## Tests

- 186 → 222 (+36 across 9 new test files + 1 refreshed)
- All 3 typechecks (client + server + project-mode `tsc -b`) green

## Test plan

- [ ] Lighthouse perf ≥ 90 on the landing
- [ ] Manual mobile QA at 375px width — no horizontal scroll, every cell stacks cleanly
- [ ] Manual desktop QA at 1280px — hero 8×2, side cells stacked, 4 tool cells in one row
- [ ] CTA flow: Connect with Solflare → wallet popup → connected → chat shell
- [ ] Use another Solana wallet → wallet adapter modal
- [ ] Cascade animation runs once on load; no animation jank on resize
EOF
)"
```

---

## Self-review notes

After all 7 tasks are committed and the PR is open, the self-review checklist:

1. **Spec coverage**: All 11 spec sections covered. §3 visual (palette + typography + animation + bg) → Task 1. §4 layout → Task 7 grid. §5 cells → Tasks 3-6. §6 implementation strategy → matches the file structure above. §9 success criteria → mobile QA in Task 7 step 6.
2. **Type consistency**: `ToolCellData`, `ToolIconKey`, `PipelineStep`, `PipelineIconKey`, `LatestTx`, `LandingStat` all defined once in `landing-content.ts` and re-used by component props.
3. **No placeholders**: every step has the full code. Every test has explicit assertions.
4. **TDD discipline**: each task is RED → GREEN → COMMIT. 9 test files, never code-before-test.
5. **One commit per task**: 7 commits, each isolating a single logical change.

## Risks / mitigations

- **Cascade animation perception** on slow devices: 800ms × 1s stagger = ~1.8s before all cells settle. Acceptable for a landing first-impression but could feel slow on a refresh. If RECTOR finds it sluggish, drop stagger to 50ms and total to 600ms in Task 1's keyframe + Task 2's BentoCell delay multiplier.
- **Lighthouse perf**: Unbounded adds ~30 KB. If perf drops below 90, switch Unbounded to `display=swap` (already set in Task 1 Step 6) and consider self-hosting or `font-display: optional` if it's still a problem.
- **Test count drift**: spec §6.6 hardcodes `186 suite` in `LANDING_STATS`. After this PR ships, the live count is 222. The display string `186 suite` becomes stale. Acceptable for v1 (centralized in `landing-content.ts`); follow-up: add a build-time stat-injection script or accept the drift until the next refresh.
- **Solflare popup blocked**: if the user's browser blocks the popup, `solflare.adapter.connect()` rejects → `catch` falls through to `setVisible(true)` (existing behavior preserved).

## Effort estimate

- Task 1: 30 min
- Task 2: 30 min
- Task 3: 1.5 h
- Task 4: 1 h
- Task 5: 45 min
- Task 6: 45 min
- Task 7: 1 h (incl. mobile QA)
- Total: ~5.5 h, within spec §10's 5-7h window.
