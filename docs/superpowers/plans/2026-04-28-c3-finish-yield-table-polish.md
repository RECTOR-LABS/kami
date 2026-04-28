# C-3 Finish — Yield-Table Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship issues #29 + #30 — surface Kamino market name on tool outputs (U-10) and render risk-level chips via markdown-renderer extension (U-9), in one PR. Closes Chunk 3 cleanly.

**Architecture:** Two commits on `feat/c3-finish-yield-table-polish`. Commit 1 (U-10): add `KAMINO_MAIN_MARKET_NAME` constant + extend three result interfaces with `marketName: string` + spread the constant into four handler success returns + add one prompt rule. Commit 2 (U-9): extend the existing `code` component override in `src/lib/markdown-renderer.tsx` with risk-pattern detection, add a new test file (5 tests), add one prompt rule with explicit thresholds.

**Tech Stack:** TypeScript, React 18, vitest, react-testing-library, react-markdown. No new dependencies.

**Reference:** Spec at [`docs/superpowers/specs/2026-04-28-c3-finish-yield-table-polish-design.md`](../specs/2026-04-28-c3-finish-yield-table-polish-design.md). Issues #29 (U-9) and #30 (U-10).

**Pre-flight (run once at the start of execution):**

```bash
cd /Users/rector/local-dev/kami
git checkout feat/c3-finish-yield-table-polish    # branch already exists, spec committed at 82025c7
git pull --ff-only                                 # confirm we're up to date
pnpm exec tsc --noEmit                             # silent (client)
pnpm exec tsc -p server/tsconfig.json --noEmit     # silent (server — DO NOT skip; CI runs this)
pnpm test:run                                      # 143/143 across 16 files (baseline post C-2 merge)
```

If baseline isn't 143/143 green, stop and report — something drifted between brainstorm and execute.

---

## Task 1: U-10 — surface Kamino market name on tool outputs

**Why no TDD:** This task adds a string constant, extends three TypeScript interfaces with a new field, and spreads a constant into four object literals. No conditional logic to test. Per project precedent (D-13 spec §"Why no integration test"; C-2 Tasks 1+2): `kamino.ts` is the mainnet-validated surface; verification = `tsc` clean + 143 tests still green + visual diff inspection. Prompt rule changes are non-deterministic LLM compliance, no automated test surface.

**Files:**
- Modify: `server/tools/kamino.ts` (add constant, extend 3 interfaces, spread into 4 handler returns)
- Modify: `server/prompt.ts` (insert one rule directly after the staleness rule on line 16)

- [ ] **Step 1: Add `KAMINO_MAIN_MARKET_NAME` constant**

Use Edit on `server/tools/kamino.ts`:

`old_string`:
```ts
export const KAMINO_MAIN_MARKET: Address = address('7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF');

const KLEND_NO_CLOSE_OBLIGATION =
```

`new_string`:
```ts
export const KAMINO_MAIN_MARKET: Address = address('7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF');
export const KAMINO_MAIN_MARKET_NAME = 'Main';

const KLEND_NO_CLOSE_OBLIGATION =
```

- [ ] **Step 2: Extend `PortfolioPosition` does NOT need changes — skip to `PortfolioSnapshot`**

`PortfolioPosition` (line 38-47) is the per-row position type and does NOT get a `marketName` (it's redundant — the parent snapshot has it). Confirm by reading lines 38-47 — no edit needed.

- [ ] **Step 3: Extend `PortfolioSnapshot` interface with `marketName: string`**

Use Edit on `server/tools/kamino.ts`:

`old_string`:
```ts
export interface PortfolioSnapshot {
  wallet: string;
  hasObligation: boolean;
```

`new_string`:
```ts
export interface PortfolioSnapshot {
  wallet: string;
  marketName: string;
  hasObligation: boolean;
```

- [ ] **Step 4: Extend `YieldOpportunity` interface with `marketName: string`**

Use Edit on `server/tools/kamino.ts`:

`old_string`:
```ts
export interface YieldOpportunity {
  symbol: string;
  mint: string;
  reserve: string;
  side: 'supply' | 'borrow';
```

`new_string`:
```ts
export interface YieldOpportunity {
  symbol: string;
  marketName: string;
  mint: string;
  reserve: string;
  side: 'supply' | 'borrow';
```

- [ ] **Step 5: Extend `HealthSimulation` interface with `marketName: string`**

Use Edit on `server/tools/kamino.ts`:

`old_string`:
```ts
export interface HealthSimulation {
  action: ActionType;
  symbol: string;
  amount: number;
  current: {
```

`new_string`:
```ts
export interface HealthSimulation {
  action: ActionType;
  marketName: string;
  symbol: string;
  amount: number;
  current: {
```

- [ ] **Step 6: Spread `marketName` into `getPortfolio` empty-obligation branch**

Use Edit on `server/tools/kamino.ts`:

`old_string`:
```ts
    if (!obligation) {
      return {
        ok: true,
        data: {
          wallet: wallet,
          hasObligation: false,
          totalDepositedUsd: 0,
```

`new_string`:
```ts
    if (!obligation) {
      return {
        ok: true,
        data: {
          wallet: wallet,
          marketName: KAMINO_MAIN_MARKET_NAME,
          hasObligation: false,
          totalDepositedUsd: 0,
```

- [ ] **Step 7: Spread `marketName` into `getPortfolio` populated branch**

Use Edit on `server/tools/kamino.ts`:

`old_string`:
```ts
    return {
      ok: true,
      data: {
        wallet: wallet,
        hasObligation: true,
        totalDepositedUsd: toNumber(stats.userTotalDeposit),
```

`new_string`:
```ts
    return {
      ok: true,
      data: {
        wallet: wallet,
        marketName: KAMINO_MAIN_MARKET_NAME,
        hasObligation: true,
        totalDepositedUsd: toNumber(stats.userTotalDeposit),
```

- [ ] **Step 8: Spread `marketName` into `findYield` per-row push**

Use Edit on `server/tools/kamino.ts`:

`old_string`:
```ts
      opportunities.push({
        symbol,
        mint: reserve.stats.mintAddress,
        reserve: reserve.address,
        side,
```

`new_string`:
```ts
      opportunities.push({
        symbol,
        marketName: KAMINO_MAIN_MARKET_NAME,
        mint: reserve.stats.mintAddress,
        reserve: reserve.address,
        side,
```

- [ ] **Step 9: Spread `marketName` into `simulateHealth` success return**

Use Edit on `server/tools/kamino.ts`:

`old_string`:
```ts
    return {
      ok: true,
      data: {
        action: input.action as ActionType,
        symbol: reserve.getTokenSymbol(),
        amount: input.amount,
        current,
```

`new_string`:
```ts
    return {
      ok: true,
      data: {
        action: input.action as ActionType,
        marketName: KAMINO_MAIN_MARKET_NAME,
        symbol: reserve.getTokenSymbol(),
        amount: input.amount,
        current,
```

- [ ] **Step 10: Add U-10 prompt rule to `server/prompt.ts`**

Use Edit on `server/prompt.ts`:

`old_string`:
```
- If a yield or portfolio row has \`priceStale: true\`, prepend ⚠️ to that row in markdown tables and add a short note below the table: "Note: rows marked ⚠️ have oracle data > 4 minutes old; numbers may lag the current market." Still quote the numbers — do NOT refuse the request.
- Never produce raw transaction JSON blocks by hand — always call a build* tool. The frontend renders its own Sign & Send card from the tool result.
```

`new_string`:
```
- If a yield or portfolio row has \`priceStale: true\`, prepend ⚠️ to that row in markdown tables and add a short note below the table: "Note: rows marked ⚠️ have oracle data > 4 minutes old; numbers may lag the current market." Still quote the numbers — do NOT refuse the request.
- Each yield/portfolio/simulation result includes a \`marketName\` field. When discussing tool output, surface the market explicitly — e.g., "On Kamino's Main market…" or "Best USDC yield on Kamino (Main market): …". This educates users that Kamino has multiple markets even though Kami currently queries Main only.
- Never produce raw transaction JSON blocks by hand — always call a build* tool. The frontend renders its own Sign & Send card from the tool result.
```

(Note: backticks around `priceStale` and `marketName` are escaped in the source — `\`...\`` — because the prompt is a JS template literal. Match the existing pattern verbatim.)

- [ ] **Step 11: Run client typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: silent. If you see "Property 'marketName' is missing in type ... but required in type 'PortfolioSnapshot'" or similar, you missed a return-site spread (Steps 6, 7, or 9). Re-check.

- [ ] **Step 12: Run server typecheck**

```bash
pnpm exec tsc -p server/tsconfig.json --noEmit
```

Expected: silent. DO NOT skip — `pnpm exec tsc -b` does NOT validate the server tsconfig (root has no `references` field). Memory: `tsc-b-skips-server-tsconfig.md`.

- [ ] **Step 13: Run test suite**

```bash
pnpm test:run
```

Expected: `Tests  143 passed (143)` across 16 files. No new tests yet — this confirms the type/object additions didn't break any existing test.

- [ ] **Step 14: Visual diff review**

```bash
git diff server/tools/kamino.ts
git diff server/prompt.ts
```

Expected for `kamino.ts`: 8 separate hunks — 1 constant addition, 3 interface additions, 4 handler-return spreads. No other changes.
Expected for `prompt.ts`: 1 new line (the U-10 rule) inserted between the staleness rule and the "Never produce raw transaction JSON" rule.

- [ ] **Step 15: Commit**

```bash
git add server/tools/kamino.ts server/prompt.ts
git commit -m "$(cat <<'EOF'
feat(kamino): surface market name on tool outputs

Issue #30 / U-10: tool output and LLM prose say "Kamino's main market" —
but Kamino has multiple markets (Main, JLP, Altcoin, etc.). A fresh
user will eventually want JLP or Altcoin yields and won't know how to
ask. Add a marketName: 'Main' field to PortfolioSnapshot, YieldOpportunity,
and HealthSimulation, and a prompt rule instructing the LLM to surface
the market explicitly in prose.

Label-only fix; the tool is still single-market behind the scenes.
Multi-market support is deferred to a future sprint per spec §Non-goals.
The marketName field is forward-compatible — when multi-market lands,
just point getMarket() at a different address and labels follow.
EOF
)"
```

---

## Task 2: U-9 — risk chip renderer + prompt thresholds

**TDD applies.** The `code` override's risk-pattern detection is pure presentation logic with deterministic input/output. Write 5 failing tests first, then add the constants + detection branch to make them pass.

**Files:**
- Modify: `src/lib/markdown-renderer.tsx` (add 3 module-level constants; replace the existing `code` override with a version that adds risk-pattern detection BEFORE the existing inline/block-code paths)
- Create: `src/lib/markdown-renderer.test.tsx` (new file, 5 tests)
- Modify: `server/prompt.ts` (insert U-9 rule directly after the U-10 rule)

- [ ] **Step 1: Read current `src/lib/markdown-renderer.tsx` to confirm structure**

Read the file. Confirm:
- Existing imports include `React` and `ReactMarkdown` from `react-markdown` and `remarkGfm` from `remark-gfm`
- An `isSafeHref` helper is defined near the top
- A `components: Components` object is defined with overrides
- The current `code` override (lines 63-72) handles inline vs block code via the `isBlock` check on `className.startsWith('language-')`
- `renderMarkdown(text: string)` is exported as a named export (used by the test file)

If the structure differs significantly (e.g., the file was refactored), stop and report rather than guessing.

- [ ] **Step 2: Create `src/lib/markdown-renderer.test.tsx` with all 5 failing tests**

Create the file with this content:

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
    const code = screen.getByText(':risk-extreme:');
    expect(code).toBeInTheDocument();
    expect(code).toHaveClass('text-purple-300');
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

- [ ] **Step 3: Run the new tests, confirm 3 fail**

```bash
pnpm exec vitest run src/lib/markdown-renderer.test.tsx
```

Expected: 2 pass + 3 fail. The 3 failures should be the chip tests (high, medium, low) — without the implementation, "High risk" / "Medium risk" / "Low risk" text won't appear; the markdown will render `:risk-high:` etc. as plain inline code. The 4th test (unknown marker → inline code fallback) and 5th test (regular inline code unchanged) should already pass with the current `code` override.

If the 1st test (high risk chip) passes before implementation, stop and investigate — that's a sign the test isn't actually testing what we think.

- [ ] **Step 4: Add risk constants above the `components` object**

Use Edit on `src/lib/markdown-renderer.tsx`:

`old_string`:
```tsx
function isSafeHref(url: string): boolean {
  try {
    const u = new URL(url, 'http://placeholder.local');
    return u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:';
  } catch {
    return false;
  }
}

const components: Components = {
```

`new_string`:
```tsx
function isSafeHref(url: string): boolean {
  try {
    const u = new URL(url, 'http://placeholder.local');
    return u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:';
  } catch {
    return false;
  }
}

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

const components: Components = {
```

- [ ] **Step 5: Replace the `code` override with the risk-detection version**

Use Edit on `src/lib/markdown-renderer.tsx`:

`old_string`:
```tsx
  code: ({ className, children }) => {
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

`new_string`:
```tsx
  code: ({ className, children }) => {
    const text =
      typeof children === 'string'
        ? children
        : Array.isArray(children)
          ? children.join('')
          : '';
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

- [ ] **Step 6: Run all `markdown-renderer` tests, confirm 5/5 pass**

```bash
pnpm exec vitest run src/lib/markdown-renderer.test.tsx
```

Expected: `Tests  5 passed (5)`. All 3 chip tests now green; the 4th (unknown marker fallback) and 5th (regular inline code) still green.

If any chip test still fails, common causes:
- Tailwind classes not in the test environment — but vitest doesn't render styles, only DOM strings; `toHaveClass` checks the className attribute. The test should work because the assertions check class names, not computed styles.
- Children-string flattening: if `children` arrives as a React element (not a string or array of strings), the regex won't match. The implementation handles `string | string[]`; if react-markdown passes anything else, the test will reveal it.

- [ ] **Step 7: Add U-9 prompt rule to `server/prompt.ts`**

Use Edit on `server/prompt.ts`:

`old_string`:
```
- Each yield/portfolio/simulation result includes a \`marketName\` field. When discussing tool output, surface the market explicitly — e.g., "On Kamino's Main market…" or "Best USDC yield on Kamino (Main market): …". This educates users that Kamino has multiple markets even though Kami currently queries Main only.
- Never produce raw transaction JSON blocks by hand — always call a build* tool. The frontend renders its own Sign & Send card from the tool result.
```

`new_string`:
```
- Each yield/portfolio/simulation result includes a \`marketName\` field. When discussing tool output, surface the market explicitly — e.g., "On Kamino's Main market…" or "Best USDC yield on Kamino (Main market): …". This educates users that Kamino has multiple markets even though Kami currently queries Main only.
- Flag risk levels using inline-code markers: \`:risk-high:\` for liquidation-class concerns (utilization > 95%, projected health factor < 1.1, borrow APY > 50%, oracle staleness on a quoted reserve, or any condition that could lead to forced liquidation/loss). \`:risk-medium:\` for elevated-but-manageable concerns (utilization 80-95%, health factor 1.1-1.3, borrow APY 20-50%). \`:risk-low:\` for noteworthy-but-safe context (utilization 60-80%, large LTV-vs-liquidation buffer). Use judgment for risks not on this list (regulatory, illiquid markets, novel reserves). Place the marker inline with the relevant data — e.g., "USDC borrow APY 95% \`:risk-high:\`" or beneath a warning sentence. Do NOT use the markers in safe situations (utilization < 60%, health factor > 1.5).
- Never produce raw transaction JSON blocks by hand — always call a build* tool. The frontend renders its own Sign & Send card from the tool result.
```

(Note: the inline backticks in the rule body are escaped — `\`:risk-high:\`` etc. — because the entire prompt is a JS template literal. Match the existing pattern verbatim. Each `\`` is one backslash followed by one backtick.)

- [ ] **Step 8: Run full test suite**

```bash
pnpm test:run
```

Expected: `Test Files  17 passed (17)` and `Tests  148 passed (148)`. Coverage delta matches spec: +5 tests in the new `markdown-renderer.test.tsx` file.

- [ ] **Step 9: Run client typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: silent.

- [ ] **Step 10: Run server typecheck**

```bash
pnpm exec tsc -p server/tsconfig.json --noEmit
```

Expected: silent. (No server code changed in this task, but still run — quick sanity check.)

- [ ] **Step 11: Visual diff review**

```bash
git diff src/lib/markdown-renderer.tsx
git diff src/lib/markdown-renderer.test.tsx
git diff server/prompt.ts
```

Expected for `.tsx`:
- 3 new module-level constants (RISK_PATTERN, RISK_STYLES, RISK_LABELS) above the `components` object
- The `code` override now starts with a children-flattening + regex-match block, then a chip return, then the existing inline/block-code branches unchanged
- No other changes

Expected for `.test.tsx`:
- New file, 5 `it(...)` blocks inside one `describe(...)` block
- Imports `renderMarkdown` from `./markdown-renderer`

Expected for `prompt.ts`:
- 1 new line (the U-9 rule) inserted between the U-10 rule (added in Task 1) and the "Never produce raw transaction JSON" rule

- [ ] **Step 12: Commit**

```bash
git add src/lib/markdown-renderer.tsx src/lib/markdown-renderer.test.tsx server/prompt.ts
git commit -m "$(cat <<'EOF'
feat(ui): render risk-level chips + prompt risk thresholds

Issue #29 / U-9: long responses pack risk info inline (utilization >95%,
health factor near 1.0, etc.). A power user wants risk levels at-a-glance.
Add a markdown-renderer extension that detects inline-code risk markers
(`:risk-high:`, `:risk-medium:`, `:risk-low:`) and renders them as colored
Tailwind chips (red/amber/green) matching the ToolCallBadges visual rhythm.

Add a prompt rule with explicit thresholds (utilization, health factor,
borrow APY) plus a qualitative escape hatch for non-listed risks
(regulatory, illiquid markets, novel reserves). The "Do NOT use the
markers in safe situations" guard prevents false-positives.

Tests: 143 → 148 (+5 in new markdown-renderer.test.tsx). Covers 3 chip
levels + unknown-marker fallback + regular-inline-code unchanged.
EOF
)"
```

---

## Task 3: Final verification before PR

**Why this task exists:** The 2 commits each verify locally. This task confirms the cumulative branch state matches every spec acceptance criterion before opening a PR.

**Files:** None modified.

- [ ] **Step 1: Confirm branch is on top of main**

```bash
git fetch origin
git log --oneline origin/main..HEAD
```

Expected: 3 commits — the spec commit (`docs(spec): add C-3 finish yield-table polish design`) plus the two feature commits from Tasks 1-2, in order:
```
<sha> feat(ui): render risk-level chips + prompt risk thresholds
<sha> feat(kamino): surface market name on tool outputs
<sha> docs(spec): add C-3 finish yield-table polish design
```

If any other commit appears, investigate before continuing.

- [ ] **Step 2: Run all 3 typecheck commands**

```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p server/tsconfig.json --noEmit
pnpm exec tsc -b
```

Expected: all three silent. (`tsc -b` is included for parity even though `tsc -p server/...` is the load-bearing one — see memory `tsc-b-skips-server-tsconfig.md`.)

- [ ] **Step 3: Run full test suite**

```bash
pnpm test:run
```

Expected: `Test Files  17 passed (17)` and `Tests  148 passed (148)`.

- [ ] **Step 4: Confirm U-10 additions present**

```bash
grep -n "KAMINO_MAIN_MARKET_NAME" server/tools/kamino.ts
grep -n "marketName: KAMINO_MAIN_MARKET_NAME" server/tools/kamino.ts
grep -n "marketName: string" server/tools/kamino.ts
grep -n "Each yield/portfolio/simulation result includes a" server/prompt.ts
```

Expected:
- `KAMINO_MAIN_MARKET_NAME` — appears at least 5 times (1 declaration + 4 spreads)
- `marketName: KAMINO_MAIN_MARKET_NAME` — appears 4 times (one per handler return)
- `marketName: string` — appears 3 times (one per interface)
- The U-10 prompt rule grep — exactly 1 line

- [ ] **Step 5: Confirm U-9 additions present**

```bash
grep -n "RISK_PATTERN" src/lib/markdown-renderer.tsx
grep -n "RISK_STYLES" src/lib/markdown-renderer.tsx
grep -n "RISK_LABELS" src/lib/markdown-renderer.tsx
grep -n "Flag risk levels using inline-code markers" server/prompt.ts
ls -la src/lib/markdown-renderer.test.tsx
```

Expected:
- Each constant grep — at least 1 declaration line (RISK_PATTERN may have 2 hits: declaration + usage)
- The U-9 prompt rule grep — exactly 1 line
- Test file exists with non-zero size

- [ ] **Step 6: Push the branch**

```bash
git push origin feat/c3-finish-yield-table-polish
```

Expected: branch is already tracking origin (set up by the spec push); push delivers the 2 new feature commits to GitHub.

- [ ] **Step 7: Open the PR**

```bash
gh pr create --title "feat: yield-table polish — market name + risk chips (#29 + #30)" --body "$(cat <<'EOF'
## Summary

Closes Chunk 3 of the 2026-04-26 QA backlog — two small polish fixes shipped together because both touch yield/portfolio output rendering.

- **U-10 (#30):** Surface Kamino market name (`marketName: 'Main'`) on `getPortfolio` / `findYield` / `simulateHealth` outputs + prompt rule instructing the LLM to mention "Main market" in prose. Label-only — multi-market support is deferred to a future sprint.
- **U-9 (#29):** Markdown-renderer extension that detects inline-code risk markers (`:risk-high:`, `:risk-medium:`, `:risk-low:`) and renders them as colored Tailwind chips (red/amber/green). Prompt rule with explicit thresholds + qualitative escape hatch.

Spec: [`docs/superpowers/specs/2026-04-28-c3-finish-yield-table-polish-design.md`](https://github.com/RECTOR-LABS/kami/blob/feat/c3-finish-yield-table-polish/docs/superpowers/specs/2026-04-28-c3-finish-yield-table-polish-design.md)
Plan: [`docs/superpowers/plans/2026-04-28-c3-finish-yield-table-polish.md`](https://github.com/RECTOR-LABS/kami/blob/feat/c3-finish-yield-table-polish/docs/superpowers/plans/2026-04-28-c3-finish-yield-table-polish.md)

Closes #29.
Closes #30.

## Test plan

- [x] `pnpm exec tsc --noEmit` clean (client)
- [x] `pnpm exec tsc -p server/tsconfig.json --noEmit` clean (server)
- [x] `pnpm test:run` — 148/148 passing across 17 files (was 143 → +5 in new `markdown-renderer.test.tsx`)
- [x] All 5 new renderer tests pass (3 chip levels + unknown-marker fallback + regular inline-code unchanged)
- [ ] Manual smoke (post-merge prod):
  - [ ] Send "best USDC yield right now" — verify response prose mentions "Main market" or equivalent
  - [ ] Inspect tool output via DevTools — verify `marketName: "Main"` appears on returned objects
  - [ ] Send a vague-and-risky query (e.g., "borrow 100% of my LTV" or "find me the riskiest reserve") — verify at least one `:risk-...:` chip renders inline with the correct color
EOF
)"
```

Expected: PR created. Capture the URL.

- [ ] **Step 8: Confirm CI starts**

```bash
gh pr checks --watch
```

Expected: CI begins. The pin guard, server typecheck, and test suite all run. Watch until green or first failure.

If CI fails on something the local verification missed, stop and investigate. Common gotchas: see memory `tsc-b-skips-server-tsconfig.md` if a typecheck differs between local and CI.

---

## Self-review checklist (run before declaring plan complete)

- [x] **Spec coverage:** Every spec scope item has a task. U-10 → Task 1 (Steps 1-15 cover constant + 3 interfaces + 4 handler spreads + prompt rule). U-9 → Task 2 (Steps 1-12 cover renderer constants + `code` override change + 5 tests + prompt rule). Acceptance criteria tracked in Task 3.
- [x] **No placeholders:** No "TBD", "TODO", "fill in details". All Edit calls show literal old/new strings. All test code is verbatim from spec.
- [x] **Type consistency:** `KAMINO_MAIN_MARKET_NAME` (string constant) and `marketName: string` (interface field) match between Tasks 1's individual steps. `RISK_PATTERN` / `RISK_STYLES` / `RISK_LABELS` types consistent between Task 2 Steps 4 and 5.
- [x] **Bite-sized:** Each step is one verifiable action. Task 1 = 15 steps. Task 2 = 12 steps. Task 3 = 8 steps. Total 35 steps. Each step has expected output.
- [x] **Reversibility:** Tasks 1-2 are additive (no deletions); revertable with `git revert`. Task 3 only opens the PR — no irreversible action.
- [x] **CI parity:** Plan runs both `tsc --noEmit` (client) AND `tsc -p server/tsconfig.json --noEmit` (server) at every checkpoint, per `tsc-b-skips-server-tsconfig.md` memory.
