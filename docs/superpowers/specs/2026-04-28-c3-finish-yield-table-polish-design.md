# C-3 Finish — yield-table polish: Kamino market name + risk iconography

**Date:** 2026-04-28
**Issues:** [#30 — U-10 Surface Kamino market name](https://github.com/RECTOR-LABS/kami/issues/30), [#29 — U-9 Risk iconography](https://github.com/RECTOR-LABS/kami/issues/29)
**Priority:** P3 (`qa-2026-04-26`)
**Sprint:** 3.2 (Chunk 3 finish — Demo Polish)
**Estimate:** 3-6h
**Branch:** `feat/c3-finish-yield-table-polish`

---

## Problem

Two compounding polish gaps in yield/portfolio tool output observed during the 2026-04-26 baseline QA run. Bundled together as Chunk 3 finish because both ship judging-visible cosmetic improvements on the same surface (yield/portfolio tables) and both touch `server/prompt.ts`.

**U-10 (#30) — no market context.** Tool output and LLM prose say "Kamino's main market" — but Kamino has multiple markets (Main, JLP, Altcoin, etc.). A fresh user will eventually want JLP or Altcoin yields and won't know how to ask. Surfacing market context educates them that multiple markets exist.

**U-9 (#29) — risk levels buried in prose.** Long responses pack risk info inline (utilization >95%, FDUSD's 101.9% borrow APY warning, "withdrawal liquidity can be limited"). The user reads it all and feels safer, but a power user wants risk levels at-a-glance. A red/yellow/green chip inline would help triage.

For the Eitherway-Kamino bounty judging, both are visible-on-every-yield-query polish gaps. Bundling them as one PR closes Chunk 3 cleanly.

## Scope

**In scope:**

- **U-10 (commit 1):** Add `KAMINO_MAIN_MARKET_NAME = 'Main'` constant in `server/tools/kamino.ts`. Extend `PortfolioSnapshot`, `YieldOpportunity`, `HealthSimulation` with `marketName: string`. Spread `marketName: KAMINO_MAIN_MARKET_NAME` into all three handlers' success returns. Add one prompt rule instructing the LLM to surface the market explicitly when discussing tool output.
- **U-9 (commit 2):** Add a detection branch to the existing `code` component override in `src/lib/markdown-renderer.tsx` for `:risk-(high|medium|low):` patterns, rendering colored Tailwind chips. Add `src/lib/markdown-renderer.test.tsx` (new file, 5 tests) covering chip rendering + graceful fallback. Add one prompt rule with explicit thresholds + qualitative escape hatch for non-listed risks.

**Out of scope** (explicitly deferred):

- **Multi-market support** (loading JLP / Altcoin / Lite markets). Major architectural change — every tool needs a market parameter, cache becomes per-market, build* tools need market-aware risk treatment. Out of scope for P3; deserves its own brainstorm/spec.
- **Risk level as a structured field on tool output** (`riskLevel: 'high'` etc.). Stacking on top of the chip renderer is unnecessary — the LLM emits the chip marker directly when warranted; the data the LLM uses to decide is already in the tool output (utilization, health factor, APY, priceStale).
- **Custom remark plugin** for plain-text risk markers. Pure code-component override is simpler and falls back gracefully. Defer if backtick-burden ever proves problematic in practice.
- **Build* tools' "main market" wording** in their `summary` field. The hardcoded "main market" stays as-is until multi-market is implemented; the LLM-facing prompt rule and tool-output `marketName` field are the changes here.
- **`simulateHealth`'s "main market" mentions** in description text. Same rationale.
- **LLM compliance metrics** (track post-deploy whether U-9/U-10 actually surface). Non-deterministic by design; verified organically.

## Architecture

```
server/tools/kamino.ts                  src/lib/markdown-renderer.tsx
─────────────────────────                 ───────────────────────────
  +KAMINO_MAIN_MARKET_NAME constant      +RISK_PATTERN regex
  +marketName: string on 3 interfaces    +RISK_STYLES color map
  +spread into 3 handlers' success       +RISK_LABELS text map
                                          +detection branch in `code` override

server/prompt.ts                         src/lib/markdown-renderer.test.tsx
─────────────────                          ────────────────────────────────
  +U-10 rule (surface marketName)         NEW FILE — 5 tests:
  +U-9 rule (risk thresholds + markers)    1. high → red chip
                                            2. medium → amber chip
                                            3. low → green chip
                                            4. unknown → inline-code fallback
                                            5. regular inline code unchanged
```

### Key design decisions

1. **Label-only for U-10.** Multi-market support is a major architectural change unrelated to the QA finding's "users should know other markets exist" intent. The `marketName` field is forward-compatible — when multi-market lands, just point `getMarket()` at a different address and labels follow.
2. **Backtick-wrapped risk tokens** (`` `:risk-high:` ``) intercepted in the existing `code` component override. Smallest delta, leverages existing extension point, falls back gracefully when LLM slips up. Matches QA reporter's hint (they used backticks themselves in the report).
3. **Hybrid threshold rule** (Option C from brainstorm). Anchors common cases consistently for judge-friendly demos; leaves room for the LLM to flag oracle staleness, regulatory issues, illiquid markets that the threshold list can't enumerate.
4. **Color mapping idiomatic** (red/amber/green) and uses existing palette tokens (`kami-danger`, `amber-500`, `kami-success`) — no new Tailwind classes.
5. **Chip styling matches `ToolCallBadges`** (`px-1.5 py-0.5 rounded-md border text-xs font-medium`). Risk chips and tool-call pills feel like one design system; no jarring style break.
6. **`code` override fall-through preserved.** If the input doesn't match the anchored `^:risk-...:$` pattern, control falls to the existing inline/block-code branches unchanged. In practice, risk markers inside fenced code blocks render as code text because the block content is typically multi-line and won't match the anchored regex (the anchored regex is the design choice that makes this graceful — not the branch ordering).

## Code changes

### Commit 1 — `feat(kamino): surface market name on tool outputs (U-10)`

**`server/tools/kamino.ts`** — 4 surgical changes:

**Change 1: add name constant under existing market address (line 31):**
```ts
export const KAMINO_MAIN_MARKET: Address = address('7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF');
export const KAMINO_MAIN_MARKET_NAME = 'Main';
```

**Change 2: extend three result interfaces:**
```ts
// PortfolioSnapshot — line 49
export interface PortfolioSnapshot {
  wallet: string;
  marketName: string;          // NEW — always 'Main' until multi-market is implemented
  hasObligation: boolean;
  // ... rest unchanged
}

// YieldOpportunity — line 221
export interface YieldOpportunity {
  symbol: string;
  marketName: string;          // NEW
  mint: string;
  // ... rest unchanged
}

// HealthSimulation — line 299
export interface HealthSimulation {
  action: ActionType;
  marketName: string;          // NEW
  symbol: string;
  // ... rest unchanged
}
```

**Change 3: spread `marketName` into each handler's success return.** Three insertion points:

`getPortfolio` empty-obligation branch (around line 162):
```ts
return {
  ok: true,
  data: {
    wallet: wallet,
    marketName: KAMINO_MAIN_MARKET_NAME,    // NEW
    hasObligation: false,
    // ... rest unchanged
  },
};
```

`getPortfolio` populated branch (around line 187):
```ts
return {
  ok: true,
  data: {
    wallet: wallet,
    marketName: KAMINO_MAIN_MARKET_NAME,    // NEW
    hasObligation: true,
    // ... rest unchanged
  },
};
```

`findYield` per-row push (around line 268):
```ts
opportunities.push({
  symbol,
  marketName: KAMINO_MAIN_MARKET_NAME,      // NEW
  mint: reserve.stats.mintAddress,
  // ... rest unchanged
});
```

`simulateHealth` success return (around line 405):
```ts
return {
  ok: true,
  data: {
    action: input.action as ActionType,
    marketName: KAMINO_MAIN_MARKET_NAME,    // NEW
    symbol: reserve.getTokenSymbol(),
    // ... rest unchanged
  },
};
```

**`server/prompt.ts`** — insert one rule directly after the existing staleness rule (line 16):
```diff
 - If a yield or portfolio row has `priceStale: true`, prepend ⚠️ to that row in markdown tables and add a short note below the table: "Note: rows marked ⚠️ have oracle data > 4 minutes old; numbers may lag the current market." Still quote the numbers — do NOT refuse the request.
+- Each yield/portfolio/simulation result includes a `marketName` field. When discussing tool output, surface the market explicitly — e.g., "On Kamino's Main market…" or "Best USDC yield on Kamino (Main market): …". This educates users that Kamino has multiple markets even though Kami currently queries Main only.
 - Never produce raw transaction JSON blocks by hand — always call a build* tool. The frontend renders its own Sign & Send card from the tool result.
```

### Commit 2 — `feat(ui): render risk-level chips + prompt risk thresholds (U-9)`

**`src/lib/markdown-renderer.tsx`** — extend the `code` override with risk-pattern detection BEFORE the existing inline-code path:

Add module-level constants (above the `components` const, after the `isSafeHref` helper):
```tsx
const RISK_PATTERN = /^:risk-(high|medium|low):$/;

const RISK_STYLES = {
  high: 'bg-kami-danger/10 border-kami-danger/30 text-kami-danger',
  medium: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  low: 'bg-kami-success/10 border-kami-success/30 text-kami-success',
} as const;

const RISK_LABELS = {
  high: 'High risk',
  medium: 'Medium risk',
  low: 'Low risk',
} as const;
```

Replace the existing `code` override (lines 63-72) with:
```tsx
code: ({ className, children }) => {
  const text = typeof children === 'string'
    ? children
    : Array.isArray(children) ? children.join('') : '';
  const riskMatch = RISK_PATTERN.exec(text);
  if (riskMatch) {
    const level = riskMatch[1] as keyof typeof RISK_STYLES;
    return (
      <span
        className={`inline-flex items-center px-1.5 py-0.5 rounded-md border text-xs font-medium ${RISK_STYLES[level]}`}
      >
        {RISK_LABELS[level]}
      </span>
    );
  }
  const isBlock = typeof className === 'string' && className.startsWith('language-');
  if (isBlock) {
    return <code className={`${className} text-sm font-mono text-kami-text`}>{children}</code>;
  }
  return (
    <code className="bg-kami-border px-1.5 py-0.5 rounded text-sm font-mono text-purple-300">
      {children}
    </code>
  );
},
```

**`src/lib/markdown-renderer.test.tsx`** — new file:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './markdown-renderer';

describe('markdown-renderer risk chips', () => {
  it('renders red "High risk" chip for `:risk-high:`', () => {
    render(<>{renderMarkdown('Watch out: `:risk-high:` here.')}</>);
    const chip = screen.getByText('High risk');
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveClass('text-kami-danger');
  });

  it('renders amber "Medium risk" chip for `:risk-medium:`', () => {
    render(<>{renderMarkdown('Caution: `:risk-medium:` ahead.')}</>);
    const chip = screen.getByText('Medium risk');
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveClass('text-amber-400');
  });

  it('renders green "Low risk" chip for `:risk-low:`', () => {
    render(<>{renderMarkdown('Safe: `:risk-low:` to note.')}</>);
    const chip = screen.getByText('Low risk');
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveClass('text-kami-success');
  });

  it('falls through to inline-code rendering for unknown risk markers', () => {
    render(<>{renderMarkdown('Unknown: `:risk-extreme:` here.')}</>);
    // The literal text appears (not transformed into a chip)
    const code = screen.getByText(':risk-extreme:');
    expect(code).toBeInTheDocument();
    expect(code).toHaveClass('text-purple-300');
    // No chip text rendered
    expect(screen.queryByText('Extreme risk')).not.toBeInTheDocument();
  });

  it('renders regular inline code unchanged (no chip styling)', () => {
    render(<>{renderMarkdown('Call `findYield` to scan reserves.')}</>);
    const code = screen.getByText('findYield');
    expect(code).toBeInTheDocument();
    expect(code).toHaveClass('text-purple-300');
    expect(code).not.toHaveClass('text-kami-danger');
    expect(code).not.toHaveClass('text-amber-400');
    expect(code).not.toHaveClass('text-kami-success');
  });
});
```

**`server/prompt.ts`** — insert U-9 rule directly after the U-10 rule:
```diff
 - Each yield/portfolio/simulation result includes a `marketName` field. When discussing tool output, surface the market explicitly — e.g., "On Kamino's Main market…" or "Best USDC yield on Kamino (Main market): …". This educates users that Kamino has multiple markets even though Kami currently queries Main only.
+- Flag risk levels using inline-code markers: `:risk-high:` for liquidation-class concerns (utilization > 95%, projected health factor < 1.1, borrow APY > 50%, oracle staleness on a quoted reserve, or any condition that could lead to forced liquidation/loss). `:risk-medium:` for elevated-but-manageable concerns (utilization 80-95%, health factor 1.1-1.3, borrow APY 20-50%). `:risk-low:` for noteworthy-but-safe context (utilization 60-80%, large LTV-vs-liquidation buffer). Use judgment for risks not on this list (regulatory, illiquid markets, novel reserves). Place the marker inline with the relevant data — e.g., "USDC borrow APY 95% \`:risk-high:\`" or beneath a warning sentence. Do NOT use the markers in safe situations (utilization < 60%, health factor > 1.5).
 - Never produce raw transaction JSON blocks by hand — always call a build* tool. The frontend renders its own Sign & Send card from the tool result.
```

(Note: the inline backticks within the prompt rule are escaped as `\`:risk-high:\`` because the prompt is a JS template literal — same pattern as the existing staleness rule on line 16.)

### Coverage delta

| Suite | Before | After |
|---|---|---|
| Total tests | 143 | **148** |
| Test files | 16 | **17** (+1: new `markdown-renderer.test.tsx`) |

## Edge cases

| Edge case | Handling |
|---|---|
| LLM omits backticks (emits `:risk-high:` as plain text) | Falls through markdown as plain text; visibly wrong. Mitigation: prompt rule shows the backticks explicitly in examples |
| LLM emits typo'd marker (e.g., `:risk-medum:`) | RISK_PATTERN regex no-match → falls through to inline-code branch. Renders as code text, not a chip — graceful degradation |
| LLM emits valid marker inside fenced code block | The `code` override's `isBlock` check fires *after* the risk match, so the marker pattern would still produce a chip. **However:** inside fenced blocks, the children are typically multi-line strings, so the regex (anchored `^...$`) wouldn't match. If somehow it did, it'd render as a chip. Acceptable trade-off — chip-in-code-block is unusual but not broken |
| Multiple risk markers in one paragraph | Each becomes its own chip. Handler is per-`code`-element, so independent matching. No state, no issues |
| Risk marker as part of a longer code expression (e.g., `` `find:risk-high:Reserve` ``) | RISK_PATTERN is anchored `^...$` — only matches the *entire* code text. Partial matches fall through to inline-code rendering. Correct behavior |
| LLM emits risk marker with surrounding whitespace (e.g., `` ` :risk-high: ` ``) | Anchored regex doesn't match. Falls through to inline code. Acceptable — prompt rule shows tight syntax |
| `marketName` appears in tool output but LLM doesn't mention it in prose | LLM compliance is non-deterministic. Acceptable — the data is there for inspection |
| Future multi-market: tool returns `marketName: 'JLP'` | UI renders whatever string the tool returns. The constant addition + interface extension is forward-compatible by design |
| `react-markdown` v10 children array shape | Already defensively handled: `Array.isArray(children) ? children.join('') : ''` covers the multi-child case |

## Non-goals — explicitly deferred

| Item | Why deferred |
|---|---|
| Multi-market support (loading JLP / Altcoin / Lite markets) | Major architectural change. Out of scope for P3 / 1-2h estimate. Deserves its own brainstorm/spec/plan |
| Risk level as structured field on tool output (`riskLevel: 'high'`) | Stacks on top of chip renderer without replacing the marker — adds API surface for no functional gain. The LLM already has the data (utilization, health factor, APY, priceStale) to decide what level applies |
| Custom remark plugin for plain-text risk markers | Backticks-around-marker is a minor LLM burden; prompt rule shows examples. Defer if real-world compliance proves spotty |
| Build* tools' "main market" wording in `summary` field | Visible only in the Sign & Send card; future multi-market sprint can revisit. `summary` is user-facing copy; not semantic data |
| `simulateHealth` description text "main market" mentions | Tool description is LLM-facing only, not user-facing. Future multi-market sprint can revisit |
| Apply risk chips to portfolio table rows automatically | Per-row chip would need data-driven analysis (LTV vs liquidation gap, etc.). Deferred — let LLM choose where to place chips for now |
| Track LLM compliance post-deploy | Non-deterministic by design; surfaces organically during end-user QA. Same precedent as D-13 ⚠️ rendering and C-2 prompt rules |

## Acceptance criteria

- [ ] `pnpm exec tsc --noEmit` clean (client).
- [ ] `pnpm exec tsc -p server/tsconfig.json --noEmit` clean (server).
- [ ] `pnpm test:run` — 148/148 passing across 17 files.
- [ ] All 5 `markdown-renderer.test.tsx` tests pass.
- [ ] `KAMINO_MAIN_MARKET_NAME` constant present in `server/tools/kamino.ts`.
- [ ] `marketName: string` field present on `PortfolioSnapshot`, `YieldOpportunity`, `HealthSimulation` interfaces.
- [ ] All four `marketName: KAMINO_MAIN_MARKET_NAME` spread sites present (getPortfolio empty + populated branches, findYield row push, simulateHealth success).
- [ ] U-10 prompt rule appears in `server/prompt.ts` directly after the staleness rule.
- [ ] U-9 prompt rule appears in `server/prompt.ts` directly after the U-10 rule.
- [ ] `RISK_PATTERN`, `RISK_STYLES`, `RISK_LABELS` constants present in `markdown-renderer.tsx`.
- [ ] `code` component override has detection branch BEFORE the existing inline/block-code branches.
- [ ] Manual smoke (post-merge prod):
  - [ ] Send "best USDC yield right now" — verify response prose mentions "Main market" or equivalent.
  - [ ] Send a vague-and-risky query (e.g., "borrow 100% of my LTV" or "find me the riskiest reserve") — verify at least one `:risk-...:` chip renders inline.
  - [ ] Inspect tool output via DevTools — verify `marketName: "Main"` appears on returned objects.
- [ ] Issues #29 and #30 closed by the merge commit (via `Closes #29` and `Closes #30` in PR body).

## Risks

- **LLM non-compliance on U-9 / U-10 prompt rules.** Both rules are non-deterministic. Mitigation: rules are explicit with thresholds and concrete examples; matches D-13 / C-2 precedent for prompt-only fixes.
- **Risk chip false-positives.** LLM might emit `:risk-high:` on innocuous data. Mitigation: prompt rule has explicit "Do NOT use the markers in safe situations" guard. If problematic post-deploy, tighten thresholds in a follow-up sprint.
- **Risk chip false-negatives.** LLM might miss flagging a real risk. Mitigation: existing safety rules (simulateHealth before borrow, liquidation warning) already catch the most critical cases; the chip is additive triage, not a replacement.
- **Code-override regex false-positive on user prompt content.** If a user includes the literal text `` `:risk-high:` `` in their question, the renderer would chip it on the assistant's reply if the LLM echoes it back. Acceptable — and arguably correct (the LLM would only echo it in a context where the meaning still applies).
- **`KAMINO_MAIN_MARKET_NAME = 'Main'` becomes stale if Kamino renames the market.** Low risk; the name is widely-used and stable. Mitigation: 1-line edit if needed.

## Done when

> "Would this survive a security audit?" Yes — pure presentation/prompt changes; no network or auth surface touched.
> "Would I deploy this to mainnet tonight?" Yes — prompt rules reversible by editing strings; the renderer addition has unit tests and graceful fallback.
> "Will the next developer understand why I made these choices?" The `marketName` field is forward-compatible for multi-market, the chip renderer reuses the existing extension point, the spec records why prompt-only beat hybrid alternatives.
