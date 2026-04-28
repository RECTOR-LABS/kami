# C-2 — Polish LLM streaming: paragraph breaks + numbered-list consistency + dedup tool-call pills

**Date:** 2026-04-27
**Issue:** [#8 — Polish LLM streaming](https://github.com/RECTOR-LABS/kami/issues/8)
**Priority:** P1 (`qa-2026-04-26`)
**Sprint:** 3.1 (Chunk 3 — Demo Polish)
**Estimate:** 2-4h
**Branch:** `feat/c2-streaming-polish`

---

## Problem

Three compounding micro-issues observed in the 2026-04-26 baseline QA run erode polish in chat output. Individually trivial; together they make the chat feel unfinished.

**U-2 (run-on text).** The LLM glues post-tool continuations onto the lead-in sentence with no paragraph break:

> *"Let me check the live rates for you!Here's the best USDC supply rate..."*

The `!` is the last character of the pre-tool text, `Here's` is the first word of the post-tool text — they render as one sentence on screen.

**U-3 (numbered-list `N.` slip).** When a numbered list contains an emoji, the LLM occasionally drops the period after the marker:

> *"1. **Strategy 1** — ..."*
> *"2. **Strategy 2** — ..."*
> *"3. **Strategy 3** — ..."*
> *"4 🌕 Hold BTC Exposure"*

Without the period, markdown does not parse line 4 as a list item — it renders as a plain paragraph, breaking visual alignment with items 1-3.

**U-4 (duplicate tool-call pills).** When the LLM invokes the same tool twice in one response (e.g., two `findYield` calls), `ToolCallBadges` renders two side-by-side identical green pills — visually a stutter.

For the Eitherway-Kamino bounty judging, these are visible-in-every-response polish gaps. Three small fixes, one cohesive PR.

## Scope

**In scope:**

- **U-2 (prompt):** Add a rule to `server/prompt.ts` instructing the LLM to emit a blank line before/after tool-result rendering. Include a concrete negative example.
- **U-3 (prompt):** Add a rule + inline mini-example to `server/prompt.ts` requiring `N.` (with period) on every ordered-list marker, including emoji-led items.
- **U-4 (frontend):** Add a `groupCalls()` helper to `src/components/ToolCallBadges.tsx` that merges consecutive same-`name` + same-`status` calls into one pill with a `×N` suffix. Add 3 new tests covering merge / no-merge-across-status / no-merge-non-consecutive.

**Out of scope** (explicitly deferred):

- Frontend post-processor for U-2/U-3 (insert spaces / rewrite list markers in client). Brittle (mangles `U.S.A.`, URLs, code blocks). Prompt-only matches D-13 precedent.
- Cross-tool dedup (e.g., `[findYield, simulateHealth, findYield]` collapsing to `findYield ×2`). Non-consecutive calls represent distinct moments in the LLM's reasoning; collapsing erases timing.
- Aggressive dedup across statuses (`[findYield/calling, findYield/error]` → one pill). Would hide diagnostic info — the failed call has different visual semantics from the successful one.
- LLM compliance metrics (track post-deploy whether U-2/U-3 actually disappear). Non-deterministic by design; observable in production via end-user QA passes.
- Risk iconography in tool tables (#29 / U-9), Kamino market name on yield tables (#30 / U-10) — separate Chunk 3 sprints.

## Architecture

```
server/prompt.ts                        src/components/ToolCallBadges.tsx
─────────────────                       ──────────────────────────────────
  +U-2 rule (blank-line pre/post tool)    +groupCalls(calls) helper at top
  +U-3 rule (N. period mandatory)         +use grouped iteration in render
                                          +append " ×{count}" when count > 1
                                          (status branches preserved verbatim)

(no type changes — group is computed; ToolCallRecord shape unchanged)
(no useChat changes — message.toolCalls untouched, persistence unaffected)
```

### Key design decisions

1. **Prompt-only for U-2/U-3.** Frontend post-processing is brittle (regex collisions with valid `U.S.A.`, URLs, code blocks, etc.). Single source of truth for output format = the LLM's instructions. Matches D-13 precedent.
2. **Grouping by `name` + `status`, consecutive only.** Same name + same status = same visual story → merge. Different status = different story (one succeeded, one failed) → keep separate. Non-consecutive = different reasoning moments → keep separate.
3. **`×` (U+00D7) over `x`.** Typographically correct multiplication sign; matches the QA report's recommendation.
4. **Helper inside the component, not a separate `lib/` file.** Single-use, ~10 LOC, colocated with its sole consumer. Adding a `dedupe-tool-calls.ts` for a 10-LOC pure function is over-decomposition.
5. **No state-shape changes.** Grouping is a presentation concern, computed at render time. `message.toolCalls` keeps the original ungrouped array — preserves diagnostic detail in localStorage and lets future features (e.g., per-call tooltips) read the raw record.

## Code changes

### Commit 1 — `feat(prompt): paragraph break around tool-call invocations`

**`server/prompt.ts`** — insert one rule directly after line 11 (the existing "Use markdown formatting" rule):

```diff
 - Use markdown formatting for readability (headings, lists, bold, links).
+- When you call a tool mid-response, end the lead-in sentence with proper punctuation followed by a blank line, and begin the post-tool continuation as a fresh paragraph. Never glue the post-tool text directly onto the lead-in sentence (avoid output like "Let me check!Here's…" — should render as "Let me check!\n\nHere's…").
 - Never invent token mints, pool addresses, or APYs — if a tool returns no data, say so.
```

### Commit 2 — `feat(prompt): require period on ordered-list markers`

**`server/prompt.ts`** — insert one rule directly after the U-2 rule:

```diff
 - When you call a tool mid-response, end the lead-in sentence with proper punctuation followed by a blank line, and begin the post-tool continuation as a fresh paragraph. Never glue the post-tool text directly onto the lead-in sentence (avoid output like "Let me check!Here's…" — should render as "Let me check!\n\nHere's…").
+- For ordered lists, always close the marker with a period: write "1." "2." "3." (never bare "1 " "2 "). The period MUST appear before any content — text, emoji, or bold. Example: "1. 🌕 **Hold BTC** — explanation" (NOT "1 🌕 **Hold BTC**").
 - Never invent token mints, pool addresses, or APYs — if a tool returns no data, say so.
```

### Commit 3 — `feat(ui): dedup consecutive same-name same-status tool-call pills`

**`src/components/ToolCallBadges.tsx`** — add helper above the component, change render to iterate groups, append `×N` suffix when `count > 1`:

```diff
 import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
 import type { ToolCallRecord } from '../types';

 const TOOL_LABELS: Record<string, string> = {
   getPortfolio: 'Fetching Kamino portfolio',
   findYield: 'Scanning yield opportunities',
   simulateHealth: 'Simulating health factor',
 };

 function labelFor(name: string): string {
   return TOOL_LABELS[name] ?? `Calling ${name}`;
 }

+function groupCalls(
+  calls: ToolCallRecord[],
+): Array<{ call: ToolCallRecord; count: number }> {
+  const groups: Array<{ call: ToolCallRecord; count: number }> = [];
+  for (const call of calls) {
+    const last = groups.at(-1);
+    if (last && last.call.name === call.name && last.call.status === call.status) {
+      last.count += 1;
+    } else {
+      groups.push({ call, count: 1 });
+    }
+  }
+  return groups;
+}
+
+function suffix(count: number): string {
+  return count > 1 ? ` ×${count}` : '';
+}
+
 interface Props {
   calls: ToolCallRecord[];
 }

 export default function ToolCallBadges({ calls }: Props) {
   if (calls.length === 0) return null;

   return (
     <div className="flex flex-wrap gap-2 mb-2">
-      {calls.map((call) => {
+      {groupCalls(calls).map(({ call, count }) => {
         const label = labelFor(call.name);
         if (call.status === 'calling') {
           return (
             <span
               key={call.id}
               className="..."
             >
               <Loader2 className="w-3 h-3 animate-spin" />
-              {label}
+              {label}{suffix(count)}
             </span>
           );
         }
         if (call.status === 'wallet-required') {
           return (
             <span
               key={call.id}
               className="..."
             >
               <AlertCircle className="w-3 h-3" />
-              Wallet required
+              Wallet required{suffix(count)}
             </span>
           );
         }
         if (call.status === 'error') {
           return (
             <span
               key={call.id}
               className="..."
               title={call.error ?? 'Tool error'}
             >
               <AlertCircle className="w-3 h-3" />
-              {label} failed
+              {label} failed{suffix(count)}
             </span>
           );
         }
         return (
           <span
             key={call.id}
             className="..."
           >
             <CheckCircle2 className="w-3 h-3" />
-            {label}
+            {label}{suffix(count)}
           </span>
         );
       })}
     </div>
   );
 }
```

**`src/components/ToolCallBadges.test.tsx`** — keep all 5 existing tests, add 3:

```ts
it('merges two consecutive same-name + same-status calls into one pill with ×2 suffix', () => {
  render(
    <ToolCallBadges
      calls={[
        baseCall({ id: 'tc-1', status: 'done' }),
        baseCall({ id: 'tc-2', status: 'done' }),
      ]}
    />,
  );
  expect(screen.getByText('Fetching Kamino portfolio ×2')).toBeInTheDocument();
  // single rendered span — verify only one matches
  expect(screen.getAllByText(/Fetching Kamino portfolio/)).toHaveLength(1);
});

it('does NOT merge consecutive same-name calls with different statuses', () => {
  render(
    <ToolCallBadges
      calls={[
        baseCall({ id: 'tc-1', status: 'calling' }),
        baseCall({ id: 'tc-2', status: 'done' }),
      ]}
    />,
  );
  // both pills present, neither has ×2 suffix
  expect(screen.getAllByText('Fetching Kamino portfolio')).toHaveLength(2);
  expect(screen.queryByText(/×/)).not.toBeInTheDocument();
});

it('does NOT merge non-consecutive same-name+status calls (A, B, A renders as 3 pills)', () => {
  render(
    <ToolCallBadges
      calls={[
        baseCall({ id: 'tc-1', name: 'getPortfolio', status: 'done' }),
        baseCall({ id: 'tc-2', name: 'findYield', status: 'done' }),
        baseCall({ id: 'tc-3', name: 'getPortfolio', status: 'done' }),
      ]}
    />,
  );
  expect(screen.getAllByText('Fetching Kamino portfolio')).toHaveLength(2);
  expect(screen.getByText('Scanning yield opportunities')).toBeInTheDocument();
  expect(screen.queryByText(/×/)).not.toBeInTheDocument();
});
```

### Coverage delta

| Suite | Before | After |
|---|---|---|
| Total tests | 138 | **141** |
| Test files | 16 | **16** (unchanged — extending existing file) |
| `ToolCallBadges.test.tsx` tests | 5 | 8 |

## Edge cases

| Edge case | Handling |
|---|---|
| Empty `calls` array | Existing early-return preserved: `if (calls.length === 0) return null;` |
| Single call | `groupCalls` returns 1 group with `count: 1`; `suffix(1)` returns `''`; rendered output identical to pre-change |
| All N calls same name+status | Collapses to one pill with `×N` suffix |
| Mid-stream status transitions | Visual reflects state divergence: t0 both `calling` → merged (`×2`, cyan); t1 first `done`, second still `calling` → splits to 2 pills (different status); t2 both `done` → re-merges (`×2`, green). Brief flicker when statuses diverge is expected and accurate; no manual reflow logic needed |
| `wallet-required` pills | Group rule applies as for any other status. Two consecutive same-tool wallet-required calls → "Wallet required ×2" |
| Mixed-tool wallet-required pills | Different `name` → no merge. e.g., `[getPortfolio/wallet-required, findYield/wallet-required]` → 2 separate "Wallet required" pills |
| `error` pills with different `error` strings | Group rule still merges by `name`+`status`, but the representative call's `error` string is shown via `title` attribute. Trade-off accepted: the second error message is hidden behind the merge. Mitigation: in practice, repeated calls fail for the same reason (e.g., both wallet-not-connected), so the lost detail is rare and low-value |
| LLM emits ordered list with non-period separator (`)` instead of `.`) | Out of scope — prompt rule targets `N.` specifically. Markdown also accepts `1)`, but the QA finding was specifically `N`-without-marker. Future iteration if `1)` appears |
| `react-markdown` rendering of `\n\n` between tool result and continuation | Already correct — `react-markdown` parses `\n\n` as paragraph break by default. The U-2 rule asks the LLM to emit `\n\n`, no renderer changes needed |

## Non-goals — explicitly deferred

| Item | Why deferred |
|---|---|
| Frontend post-processor (insert space after `[.!?]` before capital letter) | Brittle. Mangles `U.S.A.`, URLs in plaintext, deliberate code-fenced examples. Prompt-only matches D-13 precedent |
| Cross-tool dedup (`[A, B, A]` collapses to `A ×2`) | Non-consecutive calls represent distinct reasoning moments — collapsing erases timing |
| Aggressive cross-status dedup | Would hide diagnostic info from failed-among-successes scenarios |
| Track LLM compliance post-deploy | Non-deterministic by design; surfaces organically during end-user QA. Same precedent as D-13's "verify ⚠️ rendering organically" |
| Risk iconography (#29) | Separate Chunk 3 sprint |
| Kamino market name on yield tables (#30) | Separate Chunk 3 sprint |

## Acceptance criteria

- [ ] `pnpm exec tsc --noEmit` clean (client).
- [ ] `pnpm exec tsc -p server/tsconfig.json --noEmit` clean (server — DO NOT skip; CI runs this).
- [ ] `pnpm test:run` — 141/141 passing across 16 files.
- [ ] All 8 `ToolCallBadges.test.tsx` tests pass (5 existing + 3 new).
- [ ] U-2 rule appears in `server/prompt.ts` between the existing markdown-formatting rule and the "Never invent" rule.
- [ ] U-3 rule appears in `server/prompt.ts` directly after the U-2 rule.
- [ ] `groupCalls` helper present in `src/components/ToolCallBadges.tsx`, called from inside the component.
- [ ] Manual smoke (post-merge prod):
  - Send a query that triggers a tool call mid-response (e.g., "best USDC yield right now") — verify response renders with a blank line between lead-in and post-tool continuation.
  - Send a vague yield query that triggers the LLM to call `findYield` twice (e.g., "I have some money — what should I do?") — verify pills collapse to one with `×2` suffix.
  - If LLM emits a numbered list, verify all items use `N.` markers consistently (no bare `4 🌕`).
- [ ] Issue #8 closed by the merge commit (via `Closes #8` in PR body).

## Risks

- **LLM non-compliance on U-2 / U-3.** Sonnet 4.6 follows format rules well but isn't deterministic. Mitigation: rules are explicit with negative examples; if non-compliance persists post-deploy, add a frontend post-processor as a follow-up sprint (deferred).
- **Dedup hides duplicate-error context.** When two consecutive same-name calls both `error`, only the first call's `error` string surfaces in the `title` attribute. Mitigation: documented as accepted trade-off; in practice both errors are usually identical (same wallet-not-connected, same RPC timeout). Future iteration could merge error strings into a multi-line title if real demand emerges.
- **`message.toolCalls` array ordering depends on AI SDK fullStream event order.** If the SDK ever changes ordering guarantees, the dedup logic could over- or under-merge. Mitigation: behavior is defensible (still presentationally correct under any reasonable ordering); tests pin the contract.

## Done when

> "Would this survive a security audit?" Yes — pure presentation logic, no network or auth surface touched.
> "Would I deploy this to mainnet tonight?" Yes — prompt rules are reversible by editing strings; the dedup helper is unit-tested and fails gracefully (single-call inputs render unchanged).
> "Will the next developer understand why I made these choices?" The grouping rule is named (`name+status, consecutive`), the helper is colocated with its consumer, the spec records why prompt-only beat hybrid frontend+prompt for U-2/U-3.
