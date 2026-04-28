# C-2 Streaming Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship issue #8 — three small polish fixes to LLM streaming output and tool-call pill rendering, in one PR.

**Architecture:** Three commits on `feat/c2-streaming-polish`: two prompt-rule additions to `server/prompt.ts` (U-2 paragraph break, U-3 ordered-list `N.`), then one frontend change to `src/components/ToolCallBadges.tsx` adding a `groupCalls()` helper that merges consecutive same-`name`+same-`status` pills with a `×N` suffix. No type or state-shape changes.

**Tech Stack:** TypeScript, React 18, vitest, react-testing-library. Pure presentation/prompt changes — no Solana SDK, no network surface, no auth.

**Reference:** Spec at [`docs/superpowers/specs/2026-04-27-c2-streaming-polish-design.md`](../specs/2026-04-27-c2-streaming-polish-design.md). Issue #8.

**Pre-flight (run once at the start of execution):**

```bash
cd /Users/rector/local-dev/kami
git checkout feat/c2-streaming-polish    # branch already exists, spec committed at 261e556
git pull --ff-only                        # confirm we're up to date
pnpm exec tsc --noEmit                    # silent (client)
pnpm exec tsc -p server/tsconfig.json --noEmit  # silent (server — DO NOT skip; CI runs this)
pnpm test:run                             # 138/138 across 16 files (baseline)
```

If baseline isn't 138/138 green, stop and report — something drifted between brainstorm and execute.

---

## Task 1: U-2 prompt rule — paragraph break around tool-call invocations

**Why no TDD:** This is a literal-string edit to the LLM system prompt. No automated test surface — LLM compliance is non-deterministic by design (spec §Risks). Verification = typecheck silent + existing 138 tests still pass + visual diff inspection.

**Files:**
- Modify: `server/prompt.ts:11-12` (insert one line between the existing markdown-formatting rule on line 11 and the "Never invent" rule on line 12)

- [ ] **Step 1: Read current `server/prompt.ts`**

```bash
cat server/prompt.ts
```

Confirm the existing rule on line 11 reads:
```
- Use markdown formatting for readability (headings, lists, bold, links).
```
And line 12 reads:
```
- Never invent token mints, pool addresses, or APYs — if a tool returns no data, say so.
```

If line numbers have drifted, locate the same two rules by content and adjust the Edit call accordingly. The insertion point is *after* the markdown-formatting rule and *before* the "Never invent" rule.

- [ ] **Step 2: Insert the U-2 rule via Edit tool**

Use Edit with:

`old_string`:
```
- Use markdown formatting for readability (headings, lists, bold, links).
- Never invent token mints, pool addresses, or APYs — if a tool returns no data, say so.
```

`new_string`:
```
- Use markdown formatting for readability (headings, lists, bold, links).
- When you call a tool mid-response, end the lead-in sentence with proper punctuation followed by a blank line, and begin the post-tool continuation as a fresh paragraph. Never glue the post-tool text directly onto the lead-in sentence (avoid output like "Let me check!Here's…" — should render as "Let me check!\n\nHere's…").
- Never invent token mints, pool addresses, or APYs — if a tool returns no data, say so.
```

- [ ] **Step 3: Run client typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: silent (no output, exit 0).

- [ ] **Step 4: Run server typecheck**

```bash
pnpm exec tsc -p server/tsconfig.json --noEmit
```

Expected: silent (no output, exit 0). DO NOT skip — `pnpm exec tsc -b` does NOT validate the server tsconfig (root has no `references` field). Memory: `tsc-b-skips-server-tsconfig.md`.

- [ ] **Step 5: Run test suite**

```bash
pnpm test:run
```

Expected: `Tests  138 passed (138)` across 16 files. No new tests yet — this confirms the prompt-only change didn't break any existing test.

- [ ] **Step 6: Visual diff review**

```bash
git diff server/prompt.ts
```

Expected: exactly one new line inserted, +1 / -0 line delta. Confirm:
- The insertion is between the markdown-formatting rule and the "Never invent" rule.
- The inserted text is one bullet point starting with `- When you call a tool mid-response`.
- The negative example `"Let me check!Here's…" — should render as "Let me check!\n\nHere's…"` is intact (no escaping or quote drift).

- [ ] **Step 7: Commit**

```bash
git add server/prompt.ts
git commit -m "$(cat <<'EOF'
feat(prompt): paragraph break around tool-call invocations

Issue #8 / U-2: the LLM occasionally glues post-tool continuations
onto the lead-in sentence, producing "Let me check!Here's the best..."
on screen. Add an explicit rule with a negative example so Claude emits
a blank line between the lead-in and the post-tool continuation.

Prompt-only fix; LLM compliance is non-deterministic by design (matches
D-13 precedent — see spec §Risks).
EOF
)"
```

---

## Task 2: U-3 prompt rule — require period on ordered-list markers

**Why no TDD:** Same as Task 1 — prompt-text edit, no automated test surface.

**Files:**
- Modify: `server/prompt.ts` (insert one line directly after the U-2 rule from Task 1)

- [ ] **Step 1: Insert the U-3 rule via Edit tool**

Use Edit with:

`old_string`:
```
- When you call a tool mid-response, end the lead-in sentence with proper punctuation followed by a blank line, and begin the post-tool continuation as a fresh paragraph. Never glue the post-tool text directly onto the lead-in sentence (avoid output like "Let me check!Here's…" — should render as "Let me check!\n\nHere's…").
- Never invent token mints, pool addresses, or APYs — if a tool returns no data, say so.
```

`new_string`:
```
- When you call a tool mid-response, end the lead-in sentence with proper punctuation followed by a blank line, and begin the post-tool continuation as a fresh paragraph. Never glue the post-tool text directly onto the lead-in sentence (avoid output like "Let me check!Here's…" — should render as "Let me check!\n\nHere's…").
- For ordered lists, always close the marker with a period: write "1." "2." "3." (never bare "1 " "2 "). The period MUST appear before any content — text, emoji, or bold. Example: "1. 🌕 **Hold BTC** — explanation" (NOT "1 🌕 **Hold BTC**").
- Never invent token mints, pool addresses, or APYs — if a tool returns no data, say so.
```

- [ ] **Step 2: Run client typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: silent.

- [ ] **Step 3: Run server typecheck**

```bash
pnpm exec tsc -p server/tsconfig.json --noEmit
```

Expected: silent.

- [ ] **Step 4: Run test suite**

```bash
pnpm test:run
```

Expected: `Tests  138 passed (138)` — still no new tests, just confirming nothing broke.

- [ ] **Step 5: Visual diff review**

```bash
git diff server/prompt.ts
```

Expected: cumulative diff vs `main` shows +2 / -0 (Task 1 + Task 2 lines). Diff vs HEAD~1 shows +1 / -0 (just the U-3 rule). Confirm:
- The U-3 rule is between the U-2 rule and the "Never invent" rule.
- The inline example `"1. 🌕 **Hold BTC** — explanation"` is intact with the bold-asterisks preserved.
- The negative example `(NOT "1 🌕 **Hold BTC**")` distinguishes via missing period.

- [ ] **Step 6: Commit**

```bash
git add server/prompt.ts
git commit -m "$(cat <<'EOF'
feat(prompt): require period on ordered-list markers

Issue #8 / U-3: when a numbered list contains an emoji, the LLM
occasionally drops the period after the marker, producing "4 🌕 Hold..."
which doesn't parse as a markdown list item and breaks visual alignment
with items 1-3. Add an explicit rule + inline mini-example covering the
emoji case.

Prompt-only fix; same non-deterministic compliance trade-off as U-2.
EOF
)"
```

---

## Task 3: U-4 frontend dedup — group consecutive same-name+status tool-call pills

**TDD applies here.** The grouping helper is pure (deterministic, unit-testable). Write 3 failing tests first, then the helper + render change to pass them.

**Files:**
- Modify: `src/components/ToolCallBadges.tsx` (add `groupCalls` + `suffix` helpers, change render iteration)
- Modify: `src/components/ToolCallBadges.test.tsx` (keep all 5 existing tests, add 3 new tests covering merge / no-merge-across-status / no-merge-non-consecutive)

- [ ] **Step 1: Read current `ToolCallBadges.test.tsx` to confirm `baseCall` helper signature**

```bash
cat src/components/ToolCallBadges.test.tsx
```

Confirm `baseCall` is defined as:
```ts
const baseCall = (overrides: Partial<ToolCallRecord>): ToolCallRecord => ({
  id: 'tc-1',
  name: 'getPortfolio',
  status: 'calling',
  ...overrides,
});
```

The new tests will reuse this helper. Each call needs a unique `id` to avoid React duplicate-key warnings — tests pass `id: 'tc-1'`, `id: 'tc-2'`, etc.

- [ ] **Step 2: Add 3 new failing tests to `ToolCallBadges.test.tsx`**

Use Edit to insert 3 new `it(...)` blocks at the end of the existing `describe('ToolCallBadges', () => { ... })` block (just before the closing `});`).

Insert these tests immediately after the existing `'renders wallet-required state as a neutral "Wallet required" pill'` test:

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
    // single rendered pill — verify only one matches
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
    // both pills present, neither has ×N suffix
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

- [ ] **Step 3: Run the new tests, confirm they fail**

```bash
pnpm exec vitest run src/components/ToolCallBadges.test.tsx
```

Expected: 5 pass + 3 fail. The 3 failures should reference the new test names. Without `groupCalls`, the first test gets two pills instead of "×2", the second still gets two (but that's the desired outcome here, so this test might pass even without the change — that's OK as long as the dedup test fails). The third test should pass with the current code (3 pills with no `×` text matches).

If ANY of the 3 new tests pass before the implementation, that's a sign the test isn't strict enough. The first test (`expect(screen.getByText('Fetching Kamino portfolio ×2'))`) MUST fail — that's the load-bearing assertion for the merge behavior.

- [ ] **Step 4: Add `groupCalls` and `suffix` helpers to `ToolCallBadges.tsx`**

Use Edit with:

`old_string`:
```ts
function labelFor(name: string): string {
  return TOOL_LABELS[name] ?? `Calling ${name}`;
}

interface Props {
  calls: ToolCallRecord[];
}
```

`new_string`:
```ts
function labelFor(name: string): string {
  return TOOL_LABELS[name] ?? `Calling ${name}`;
}

function groupCalls(
  calls: ToolCallRecord[],
): Array<{ call: ToolCallRecord; count: number }> {
  const groups: Array<{ call: ToolCallRecord; count: number }> = [];
  for (const call of calls) {
    // groups.at(-1) requires ES2022 lib; project targets ES2020
    const last = groups[groups.length - 1];
    if (last && last.call.name === call.name && last.call.status === call.status) {
      last.count += 1;
    } else {
      groups.push({ call, count: 1 });
    }
  }
  return groups;
}

function suffix(count: number): string {
  return count > 1 ? ` ×${count}` : '';
}

interface Props {
  calls: ToolCallRecord[];
}
```

- [ ] **Step 5: Update render to iterate groups and append suffix**

Use Edit with:

`old_string`:
```tsx
      {calls.map((call) => {
        const label = labelFor(call.name);
        if (call.status === 'calling') {
          return (
            <span
              key={call.id}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-kami-accent/10 border border-kami-accent/30 text-xs text-kami-accent"
            >
              <Loader2 className="w-3 h-3 animate-spin" />
              {label}
            </span>
          );
        }
        if (call.status === 'wallet-required') {
          return (
            <span
              key={call.id}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400"
            >
              <AlertCircle className="w-3 h-3" />
              Wallet required
            </span>
          );
        }
        if (call.status === 'error') {
          return (
            <span
              key={call.id}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-kami-danger/10 border border-kami-danger/30 text-xs text-kami-danger"
              title={call.error ?? 'Tool error'}
            >
              <AlertCircle className="w-3 h-3" />
              {label} failed
            </span>
          );
        }
        return (
          <span
            key={call.id}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-kami-success/10 border border-kami-success/30 text-xs text-kami-success"
          >
            <CheckCircle2 className="w-3 h-3" />
            {label}
          </span>
        );
      })}
```

`new_string`:
```tsx
      {groupCalls(calls).map(({ call, count }) => {
        const label = labelFor(call.name);
        if (call.status === 'calling') {
          return (
            <span
              key={call.id}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-kami-accent/10 border border-kami-accent/30 text-xs text-kami-accent"
            >
              <Loader2 className="w-3 h-3 animate-spin" />
              {label}{suffix(count)}
            </span>
          );
        }
        if (call.status === 'wallet-required') {
          return (
            <span
              key={call.id}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400"
            >
              <AlertCircle className="w-3 h-3" />
              Wallet required{suffix(count)}
            </span>
          );
        }
        if (call.status === 'error') {
          return (
            <span
              key={call.id}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-kami-danger/10 border border-kami-danger/30 text-xs text-kami-danger"
              title={call.error ?? 'Tool error'}
            >
              <AlertCircle className="w-3 h-3" />
              {label} failed{suffix(count)}
            </span>
          );
        }
        return (
          <span
            key={call.id}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-kami-success/10 border border-kami-success/30 text-xs text-kami-success"
          >
            <CheckCircle2 className="w-3 h-3" />
            {label}{suffix(count)}
          </span>
        );
      })}
```

- [ ] **Step 6: Run all `ToolCallBadges` tests, confirm 8/8 pass**

```bash
pnpm exec vitest run src/components/ToolCallBadges.test.tsx
```

Expected: `Tests  8 passed (8)`. All 5 existing tests still green (single-call inputs produce `count: 1` → empty suffix → identical render to pre-change). All 3 new tests now green.

- [ ] **Step 7: Run full test suite**

```bash
pnpm test:run
```

Expected: `Tests  141 passed (141)` across 16 files. Coverage delta matches spec: +3 tests in the existing `ToolCallBadges.test.tsx` file.

- [ ] **Step 8: Run client typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: silent.

- [ ] **Step 9: Run server typecheck**

```bash
pnpm exec tsc -p server/tsconfig.json --noEmit
```

Expected: silent. (No server code changed in this task, but still run — quick sanity check that no global type drift.)

- [ ] **Step 10: Visual diff review**

```bash
git diff src/components/ToolCallBadges.tsx
git diff src/components/ToolCallBadges.test.tsx
```

Expected for `.tsx`:
- `+groupCalls` function (15 lines)
- `+suffix` function (3 lines)
- Render iterator changed from `calls.map((call) =>` to `groupCalls(calls).map(({ call, count }) =>`
- Four `{label}` / `Wallet required` / `{label} failed` insertion sites each gain `{suffix(count)}` after them
- No other changes

Expected for `.test.tsx`:
- 3 new `it(...)` blocks added at the end of the `describe` block
- All existing tests unchanged

- [ ] **Step 11: Commit**

```bash
git add src/components/ToolCallBadges.tsx src/components/ToolCallBadges.test.tsx
git commit -m "$(cat <<'EOF'
feat(ui): dedup consecutive same-name+status tool-call pills

Issue #8 / U-4: when the LLM invokes the same tool twice in one
response (e.g., two findYield calls on a vague yield query), two
identical pills render side-by-side — visually a stutter. Add a
groupCalls() helper that merges consecutive same-name + same-status
calls into one pill with a ×N suffix.

Grouping rule: same name AND same status, consecutive only. Different
status keeps pills separate (preserves diagnostic info when one call
succeeds and another fails). Non-consecutive same-name calls stay
separate (preserves timing of the LLM's reasoning).

Tests: 138 → 141. ToolCallBadges.test.tsx 5 → 8 (added merge,
no-merge-across-status, no-merge-non-consecutive cases).
EOF
)"
```

---

## Task 4: Final verification before PR

**Why this task exists:** The 3 commits each verify locally. This task confirms the cumulative branch state matches every spec acceptance criterion before opening a PR.

**Files:** None modified.

- [ ] **Step 1: Confirm branch is on top of main**

```bash
git fetch origin
git log --oneline origin/main..HEAD
```

Expected: 4 commits — the spec commit (`docs(spec): add C-2 streaming-polish design`) plus the three feature commits from Tasks 1-3, in order:
```
<sha> feat(ui): dedup consecutive same-name+status tool-call pills
<sha> feat(prompt): require period on ordered-list markers
<sha> feat(prompt): paragraph break around tool-call invocations
<sha> docs(spec): add C-2 streaming-polish design
```

If any other commit appears, investigate before continuing.

- [ ] **Step 2: Run all 3 typecheck commands**

```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p server/tsconfig.json --noEmit
pnpm exec tsc -b
```

Expected: all three silent. (`tsc -b` is included for the CI parity story even though `tsc -p server/...` is the load-bearing one — see memory `tsc-b-skips-server-tsconfig.md`.)

- [ ] **Step 3: Run full test suite**

```bash
pnpm test:run
```

Expected: `Test Files  16 passed (16)` and `Tests  141 passed (141)`.

- [ ] **Step 4: Confirm prompt-text additions match spec exactly**

```bash
grep -n "When you call a tool mid-response" server/prompt.ts
grep -n "For ordered lists, always close the marker" server/prompt.ts
```

Expected: each grep returns exactly one line, with the rule body matching the spec verbatim.

- [ ] **Step 5: Confirm dedup helper present**

```bash
grep -n "function groupCalls" src/components/ToolCallBadges.tsx
grep -n "function suffix" src/components/ToolCallBadges.tsx
```

Expected: each grep returns exactly one line.

- [ ] **Step 6: Push the branch**

```bash
git push origin feat/c2-streaming-polish
```

Expected: branch is already tracking origin (set up in pre-flight); push delivers the 3 new feature commits to GitHub.

- [ ] **Step 7: Open the PR**

```bash
gh pr create --title "feat: polish LLM streaming output (C-2 / #8)" --body "$(cat <<'EOF'
## Summary

Closes the C-2 cluster from the 2026-04-26 baseline QA run — three small polish fixes to LLM streaming output and tool-call pill rendering, in one PR.

- **U-2:** prompt rule + negative example for paragraph break around tool-call invocations (kills `you!Here's…` glue)
- **U-3:** prompt rule + inline mini-example for ordered-list `N.` consistency (kills `4 🌕` missing-period bug)
- **U-4:** frontend dedup of consecutive same-name + same-status tool-call pills with `×N` suffix

Prompt-only for U-2/U-3 (LLM compliance is non-deterministic by design — same precedent as D-13). Frontend dedup for U-4 is unit-tested deterministically.

Spec: [`docs/superpowers/specs/2026-04-27-c2-streaming-polish-design.md`](https://github.com/RECTOR-LABS/kami/blob/feat/c2-streaming-polish/docs/superpowers/specs/2026-04-27-c2-streaming-polish-design.md)
Plan: [`docs/superpowers/plans/2026-04-27-c2-streaming-polish.md`](https://github.com/RECTOR-LABS/kami/blob/feat/c2-streaming-polish/docs/superpowers/plans/2026-04-27-c2-streaming-polish.md)

Closes #8.

## Test plan

- [x] `pnpm exec tsc --noEmit` clean (client)
- [x] `pnpm exec tsc -p server/tsconfig.json --noEmit` clean (server)
- [x] `pnpm test:run` — 141/141 passing across 16 files (was 138 → +3 in ToolCallBadges.test.tsx)
- [x] `ToolCallBadges` 8/8 tests pass (5 existing + 3 new: merge, no-merge-across-status, no-merge-non-consecutive)
- [ ] Manual smoke (post-merge prod):
  - [ ] Send "best USDC yield right now" — verify response renders with blank line between lead-in and post-tool continuation (no `you!Here's…` glue)
  - [ ] Send "I have some money — what should I do?" — if LLM emits a numbered list with emojis, verify all items use `N.` markers consistently
  - [ ] Trigger 2 same-tool calls in one response (e.g., vague yield query) — verify pills collapse to one with `×2` suffix
EOF
)"
```

Expected: PR created. Capture the URL printed by `gh pr create`.

- [ ] **Step 8: Confirm CI starts**

```bash
gh pr checks --watch
```

Expected: CI begins. The pin guard, server typecheck (the trap that bit us in PR #33), and test suite all run. Watch until green or the first failure.

If CI fails on something the local verification missed, stop and investigate. Common gotchas: see memory `tsc-b-skips-server-tsconfig.md` if a typecheck differs between local and CI.

---

## Self-review checklist (run before declaring plan complete)

- [x] **Spec coverage:** Every spec-§Scope item has a task. U-2 → Task 1. U-3 → Task 2. U-4 → Task 3 (with the 3 named test cases). Acceptance criteria tracked in Task 4 manual verification.
- [x] **No placeholders:** No "TBD", "TODO", "fill in details", "appropriate error handling". All Edit calls show literal old/new strings. All test code is the actual test code, copied from spec.
- [x] **Type consistency:** `groupCalls` signature matches across spec, plan §Task 3 Step 4, and the test invocations (returns `Array<{ call: ToolCallRecord; count: number }>`). `suffix(count: number): string` consistent.
- [x] **Bite-sized:** Each step is one verifiable action. Task 1 = 7 steps, Task 2 = 6 steps, Task 3 = 11 steps, Task 4 = 8 steps. Total 32 steps. Each step has expected output.
- [x] **Reversibility:** Tasks 1-2 are single-line text edits; revertable with one `git revert`. Task 3 is a single-file render change; revertable. Task 4 only opens the PR — no irreversible action.
- [x] **CI parity:** Plan runs both `tsc --noEmit` (client) AND `tsc -p server/tsconfig.json --noEmit` (server) at every checkpoint, per `tsc-b-skips-server-tsconfig.md` memory.
