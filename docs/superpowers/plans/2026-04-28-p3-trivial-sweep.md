# Sprint 4.1 — P3 Trivial Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship issues #25 + #26 + #27 + #28 — runtime-guard `_resetForTesting`, document the markdown-renderer's two react-markdown quirks, JSDoc the `toNumber` precision contract, and codify the empty-identify → 429 wire-up at the chat handler altitude. One PR, four commits, ~3h walltime.

**Architecture:** Four commits on `chore/p3-trivial-sweep`. Commit 1 (D-21): runtime guard inside `_resetForTesting` body + 1 new test. Commit 2 (D-23): two `// NOTE:` comments in `src/lib/markdown-renderer.tsx`. Commit 3 (D-24): JSDoc block on `toNumber` in `server/tools/kamino.ts`. Commit 4 (D-25): one new test in `api/chat.test.ts` asserting empty-identify → 429 with `X-RateLimit-Limit: 0`. Test count: 148 → 150.

**Tech Stack:** TypeScript, vitest. No new dependencies. No runtime behavior change in commits 2 + 3; commits 1 + 4 add or codify a defensive contract.

**Reference:** Spec at [`docs/superpowers/specs/2026-04-28-p3-trivial-sweep-design.md`](../specs/2026-04-28-p3-trivial-sweep-design.md). Issues #25 (D-21), #26 (D-23), #27 (D-24), #28 (D-25).

**Pre-flight (run once at the start of execution):**

```bash
cd /Users/rector/local-dev/kami
git checkout chore/p3-trivial-sweep                # branch already exists, spec committed at 42a191b
git log --oneline -3                                # expect 42a191b at top, 7eb223b second, 9e4e2cd third
git pull --ff-only                                  # confirm we're up to date
pnpm exec tsc --noEmit                              # silent (client)
pnpm exec tsc -p server/tsconfig.json --noEmit      # silent (server — DO NOT skip; CI runs this)
pnpm test:run                                        # 148/148 across 17 files (baseline post C-3-finish merge)
```

If baseline isn't 148/148 green or HEAD isn't `42a191b`, stop and report — something drifted between brainstorm and execute.

---

## Task 1: D-21 — runtime guard on `_resetForTesting`

**Why TDD:** Red→green proves the throw-when-misused contract is real, not an empty assertion. Existing 4 call sites in `server/ratelimit.test.ts` (lines 98, 104, 127, 136) run under vitest's default `NODE_ENV=test` and stay green; the new test toggles `NODE_ENV='production'` inside a try/finally so the fixture is reentrant.

**Files:**
- Modify: `server/ratelimit.ts` (lines 93-97, replace function body)
- Modify: `server/ratelimit.test.ts` (append one new `describe` block)

- [ ] **Step 1: Write the failing test**

Use Edit on `server/ratelimit.test.ts`. The current file ends with the `applyLimit with mocked Upstash` block closing on the final `});`. Append a new `describe` block after that closing brace.

`old_string`:
```ts
  it('fails closed on empty identifier when limiter is configured', async () => {
    mocks.behavior = 'success';
    const r = await applyLimit({ name: 'test', limit: 10, window: '1 m' }, '');
    expect(r).not.toBeNull();
    expect(r!.ok).toBe(false);
    expect(r!.limit).toBe(0);
    expect(r!.remaining).toBe(0);
  });
});
```

`new_string`:
```ts
  it('fails closed on empty identifier when limiter is configured', async () => {
    mocks.behavior = 'success';
    const r = await applyLimit({ name: 'test', limit: 10, window: '1 m' }, '');
    expect(r).not.toBeNull();
    expect(r!.ok).toBe(false);
    expect(r!.limit).toBe(0);
    expect(r!.remaining).toBe(0);
  });
});

describe('_resetForTesting env guard', () => {
  it('throws when invoked outside NODE_ENV === "test"', () => {
    const orig = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      expect(() => _resetForTesting()).toThrow(/NODE_ENV === "test"/);
    } finally {
      process.env.NODE_ENV = orig;
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it FAILS**

Run: `pnpm exec vitest run server/ratelimit.test.ts -t "throws when invoked outside" 2>&1 | tail -20`

Expected: 1 fail. Reason: `_resetForTesting()` currently doesn't throw under any condition — it just resets the singletons and returns. The `expect(...).toThrow(...)` matcher fails.

- [ ] **Step 3: Implement the runtime guard**

Use Edit on `server/ratelimit.ts`.

`old_string`:
```ts
/** For tests only — clears the in-memory singleton so env-var changes take effect. */
export function _resetForTesting(): void {
  redisSingleton = undefined;
  limiterCache.clear();
}
```

`new_string`:
```ts
/** For tests only — clears the in-memory singleton so env-var changes take effect.
 *  Throws when invoked outside `NODE_ENV === 'test'` to defend against accidental
 *  use in app code (the helper exists in the prod bundle but refuses to run). */
export function _resetForTesting(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('_resetForTesting may only be called when NODE_ENV === "test"');
  }
  redisSingleton = undefined;
  limiterCache.clear();
}
```

- [ ] **Step 4: Run the new test to verify it PASSES**

Run: `pnpm exec vitest run server/ratelimit.test.ts -t "throws when invoked outside" 2>&1 | tail -10`

Expected: 1 pass.

- [ ] **Step 5: Run the full ratelimit test file to verify no regressions**

Run: `pnpm exec vitest run server/ratelimit.test.ts 2>&1 | tail -10`

Expected: 14 pass (13 existing + 1 new). The 4 existing call sites of `_resetForTesting` (lines 98, 104, 127, 136) run under `NODE_ENV=test` (vitest default) and continue to pass.

- [ ] **Step 6: Run all typecheck commands**

```bash
pnpm exec tsc --noEmit                               # client — silent
pnpm exec tsc -p server/tsconfig.json --noEmit       # server — silent
```

Expected: no output from either.

- [ ] **Step 7: Run the full test suite**

Run: `pnpm test:run 2>&1 | tail -10`

Expected: 149/149 across 17 files.

- [ ] **Step 8: Commit**

```bash
git add server/ratelimit.ts server/ratelimit.test.ts
git commit -m "$(cat <<'EOF'
chore(ratelimit): gate _resetForTesting helper to test env

Runtime guard inside the helper body throws when NODE_ENV !== 'test'.
Defends against accidental use in app code without changing the import
surface or the type. The 4 existing test-file call sites stay green
under vitest's default NODE_ENV=test.

Closes #25
EOF
)"
```

---

## Task 2: D-23 — inline NOTEs for two react-markdown quirks

**Why no TDD:** Pure comments. Zero behavior change. Verification = typecheck clean + tests still green.

**Files:**
- Modify: `src/lib/markdown-renderer.tsx` (add NOTE above lines 78-83 inside `code` override; add NOTE above lines 105-111 inside `pre` override)

- [ ] **Step 1: Add NOTE above the `code` text-extraction block**

Use Edit on `src/lib/markdown-renderer.tsx`.

`old_string`:
```ts
  code: ({ className, children }) => {
    const text =
      typeof children === 'string'
        ? children
        : Array.isArray(children)
          ? children.join('')
          : '';
```

`new_string`:
```ts
  code: ({ className, children }) => {
    // NOTE: react-markdown's `code` component receives ReactNode. In practice
    // it is a string (inline code) or an array of strings (mixed inline). The
    // `else ''` branch is a safety net for unexpected ReactElement children
    // (e.g., when a remark plugin injects nodes); empty string disables the
    // risk-chip detection rather than throwing.
    const text =
      typeof children === 'string'
        ? children
        : Array.isArray(children)
          ? children.join('')
          : '';
```

- [ ] **Step 2: Add NOTE above the `pre` className-extraction block**

Use Edit on `src/lib/markdown-renderer.tsx`.

`old_string`:
```ts
  pre: ({ children }) => {
    const first = React.Children.toArray(children)[0];
    const className = React.isValidElement<{ className?: string }>(first)
      ? (first.props.className ?? '')
      : '';
    const langClass = className.split(/\s+/).find((c) => c.startsWith('language-'));
```

`new_string`:
```ts
  pre: ({ children }) => {
    // NOTE: react-markdown v10 + the `code` override above means
    // `children[0].type` is the user-overridden code component, NOT the
    // literal string 'code'. Read className directly off `children[0].props`.
    // Do not "simplify" to `first.type === 'code'` — it fails silently and
    // breaks the syntax-highlight language label on fenced code blocks.
    const first = React.Children.toArray(children)[0];
    const className = React.isValidElement<{ className?: string }>(first)
      ? (first.props.className ?? '')
      : '';
    const langClass = className.split(/\s+/).find((c) => c.startsWith('language-'));
```

- [ ] **Step 3: Run all typecheck commands**

```bash
pnpm exec tsc --noEmit                               # client — silent
pnpm exec tsc -p server/tsconfig.json --noEmit       # server — silent
```

Expected: no output from either.

- [ ] **Step 4: Run the full test suite**

Run: `pnpm test:run 2>&1 | tail -10`

Expected: 149/149 across 17 files (no count change — pure comment additions).

- [ ] **Step 5: Commit**

```bash
git add src/lib/markdown-renderer.tsx
git commit -m "$(cat <<'EOF'
docs(markdown-renderer): inline NOTEs for two react-markdown quirks

Two undocumented gotchas in src/lib/markdown-renderer.tsx that future
contributors are likely to "simplify" and silently break:

1. The `pre` override reads className off children[0].props directly,
   not via `first.type === 'code'` — react-markdown v10 swaps the child
   type with the user-overridden code component when both pre and code
   are overridden.

2. The `code` text-extraction has an `else ''` defensive branch for
   unexpected ReactElement children (e.g., when a remark plugin injects
   nodes); empty string disables risk-chip detection rather than throwing.

Pure comments. No behavior change.

Closes #26
EOF
)"
```

---

## Task 3: D-24 — `toNumber` JSDoc precision warning

**Why no TDD:** Pure JSDoc. Zero behavior change. Verification = typecheck clean + tests still green.

**Files:**
- Modify: `server/tools/kamino.ts` (lines 83-85, prepend JSDoc block)

- [ ] **Step 1: Add JSDoc block above `toNumber`**

Use Edit on `server/tools/kamino.ts`.

`old_string`:
```ts
export function toNumber(d: Decimal): number {
  return Number.isFinite(d.toNumber()) ? d.toNumber() : 0;
}
```

`new_string`:
```ts
/**
 * Decimal → number for display purposes only.
 *
 * Loses precision when |d| > 2^53 (~9e15). Do not use for amounts that will be
 * hashed, sent on-chain, or compared for equality — pass the raw Decimal through
 * to the SDK in those cases. Returns 0 when the conversion overflows to ±Infinity
 * (Decimal can hold values larger than Number.MAX_VALUE).
 */
export function toNumber(d: Decimal): number {
  return Number.isFinite(d.toNumber()) ? d.toNumber() : 0;
}
```

- [ ] **Step 2: Run all typecheck commands**

```bash
pnpm exec tsc --noEmit                               # client — silent
pnpm exec tsc -p server/tsconfig.json --noEmit       # server — silent
```

Expected: no output from either.

- [ ] **Step 3: Run the full test suite**

Run: `pnpm test:run 2>&1 | tail -10`

Expected: 149/149 across 17 files (no count change — pure JSDoc addition).

- [ ] **Step 4: Commit**

```bash
git add server/tools/kamino.ts
git commit -m "$(cat <<'EOF'
docs(kamino): JSDoc warning on toNumber precision loss

The `toNumber` helper at server/tools/kamino.ts:83-85 is used in 16
tool-output sites for display-only stringification. Document the
precision-loss contract so future callers don't reach for it when
processing amounts that will be hashed, sent on-chain, or compared
for equality. Also documents why the Number.isFinite guard exists
(Decimal can hold values larger than Number.MAX_VALUE).

Closes #27
EOF
)"
```

---

## Task 4: D-25 — empty-identify → 429 wire-up test

**Why TDD:** Codifies an existing handler invariant that wasn't yet asserted at the handler altitude. Mock-mirroring style consistent with the 17 existing handler tests. Red→green proves the test catches the right invariant.

**Files:**
- Modify: `api/chat.test.ts` (append one new `it` block before the closing `});` of the `describe('api/chat handler', ...)` block)

- [ ] **Step 1: Add the failing test**

Use Edit on `api/chat.test.ts`. The current file ends with the `'does not abort the AbortSignal when req emits close after res.writableEnded'` test, which closes the outer `describe`. Insert the new test as a new `it` block immediately before the outer `});`.

`old_string`:
```ts
  it('does not abort the AbortSignal when req emits close after res.writableEnded', async () => {
    ratelimitMocks.next = {
      ok: true,
      limit: 30,
      remaining: 29,
      reset: Date.now() + 60_000,
    };
    const req = makeReq({ body: validBody() });
    const cap = makeRes();
    await handler(req, cap.res);

    (req as unknown as Readable).emit('close');
    expect(chatMocks.lastSignal?.aborted).toBe(false);
  });
});
```

`new_string`:
```ts
  it('does not abort the AbortSignal when req emits close after res.writableEnded', async () => {
    ratelimitMocks.next = {
      ok: true,
      limit: 30,
      remaining: 29,
      reset: Date.now() + 60_000,
    };
    const req = makeReq({ body: validBody() });
    const cap = makeRes();
    await handler(req, cap.res);

    (req as unknown as Readable).emit('close');
    expect(chatMocks.lastSignal?.aborted).toBe(false);
  });

  it('returns 429 with X-RateLimit-Limit: 0 when identify() yields an empty string', async () => {
    // Mirrors the contract applyLimit('') already enforces in
    // server/ratelimit.ts:74-76 — production with no x-forwarded-for must
    // not bucket all anonymous callers under one shared key. The handler's
    // job is to convert {ok:false, limit:0} into a 429 with the expected
    // wire shape.
    ratelimitMocks.identify = '';
    ratelimitMocks.next = {
      ok: false,
      limit: 0,
      remaining: 0,
      reset: Date.now() + 60_000,
    };
    const cap = makeRes();
    await handler(makeReq({ body: validBody() }), cap.res);
    expect(cap.getStatus()).toBe(429);
    expect(cap.headers['x-ratelimit-limit']).toBe('0');
    expect(cap.headers['x-ratelimit-remaining']).toBe('0');
    expect(cap.headers['retry-after']).toMatch(/^\d+$/);
    expect(ratelimitMocks.calls).toHaveLength(1);
    expect(ratelimitMocks.calls[0].identifier).toBe('');
    const body = JSON.parse(cap.getBody());
    expect(body.error).toBe('Too many requests');
    expect(body.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run the new test to verify it PASSES (no red phase needed)**

Run: `pnpm exec vitest run api/chat.test.ts -t "X-RateLimit-Limit: 0 when identify" 2>&1 | tail -10`

Expected: 1 pass. The handler at `api/chat.ts:71-77` already correctly handles the `ok: false, limit: 0` case — this test codifies that behavior. There's no red phase because we are not changing handler code; we are documenting an existing invariant under test.

(If it FAILS unexpectedly, that's a real handler bug — stop and report. The expected output of `body.retryAfterSeconds` is computed from `reset` which is `Date.now() + 60_000`, so the value should be 60 ± 1.)

- [ ] **Step 3: Run the full chat handler test file to verify no regressions**

Run: `pnpm exec vitest run api/chat.test.ts 2>&1 | tail -10`

Expected: 18 pass (17 existing + 1 new).

- [ ] **Step 4: Run all typecheck commands**

```bash
pnpm exec tsc --noEmit                               # client — silent
pnpm exec tsc -p server/tsconfig.json --noEmit       # server — silent
```

Expected: no output from either.

- [ ] **Step 5: Run the full test suite**

Run: `pnpm test:run 2>&1 | tail -10`

Expected: 150/150 across 17 files.

- [ ] **Step 6: Commit**

```bash
git add api/chat.test.ts
git commit -m "$(cat <<'EOF'
test(chat): empty identify() yields 429 with limit:0 headers

Codifies the wire-up between server/ratelimit.ts:74-76 (which returns
{ok:false, limit:0} when identifier === '') and api/chat.ts:71-77
(which converts that into a 429 with X-RateLimit-Limit: 0).

The lower-altitude empty-identifier branch is already covered by
server/ratelimit.test.ts:140-148 ('fails closed on empty identifier
when limiter is configured'). This test sits at the handler altitude
to assert the right wire response — Retry-After header, X-RateLimit-*
headers, and 'Too many requests' body shape.

Closes #28
EOF
)"
```

---

## Final verification (after all 4 tasks)

- [ ] **Verify branch state matches plan**

```bash
git log --oneline -6
```

Expected (top to bottom):
1. Commit 4: `test(chat): empty identify() yields 429 with limit:0 headers`
2. Commit 3: `docs(kamino): JSDoc warning on toNumber precision loss`
3. Commit 2: `docs(markdown-renderer): inline NOTEs for two react-markdown quirks`
4. Commit 1: `chore(ratelimit): gate _resetForTesting helper to test env`
5. `42a191b docs(spec): correct test count + sprint label in P3 design`
6. `7eb223b docs(spec): add Sprint 4.1 P3 trivial sweep design`

- [ ] **Final typecheck + test sweep**

```bash
pnpm exec tsc --noEmit                               # silent
pnpm exec tsc -p server/tsconfig.json --noEmit       # silent
pnpm test:run                                         # 150/150 across 17 files
pnpm build                                            # tsc -b + vite build, succeeds
```

- [ ] **Push branch + open PR**

```bash
git push -u origin chore/p3-trivial-sweep
gh pr create --title "Sprint 4.1 — P3 trivial sweep (D-21 + D-23 + D-24 + D-25)" --body "$(cat <<'EOF'
## Summary

Sprint 4.1 — P3 priority cluster, 4 backlog items in one PR following the brainstorm → spec → plan → execute pattern. Each commit is one logical change; each touches a different file.

- **D-21** (`chore(ratelimit)`): runtime guard inside `_resetForTesting` body — throws when `NODE_ENV !== 'test'` to defend against accidental use in app code. +1 test.
- **D-23** (`docs(markdown-renderer)`): two `// NOTE:` comments documenting the react-markdown v10 quirks that survived C-3-finish review. Pure comments.
- **D-24** (`docs(kamino)`): JSDoc on `toNumber` warning about precision loss > 2^53 and the display-only contract. Pure JSDoc.
- **D-25** (`test(chat)`): one new test asserting empty-`identify()` → 429 with `X-RateLimit-Limit: 0` wire response. +1 test.

**Test count delta:** 148 → 150 across 17 files. **Walltime:** ~3h.

**Spec:** [`docs/superpowers/specs/2026-04-28-p3-trivial-sweep-design.md`](docs/superpowers/specs/2026-04-28-p3-trivial-sweep-design.md)
**Plan:** [`docs/superpowers/plans/2026-04-28-p3-trivial-sweep.md`](docs/superpowers/plans/2026-04-28-p3-trivial-sweep.md)

## Test plan

- [ ] `pnpm exec tsc --noEmit` silent
- [ ] `pnpm exec tsc -p server/tsconfig.json --noEmit` silent
- [ ] `pnpm test:run` shows 150/150 across 17 files
- [ ] `pnpm build` succeeds
- [ ] `gh issue list --label qa-2026-04-26 --state open --limit 30` shows 16 (15 backlog + 1 umbrella) after merge

Closes #25
Closes #26
Closes #27
Closes #28
EOF
)"
```

- [ ] **Update umbrella issue #3 with ticked checkboxes** (optional — `Closes #N` in PR body auto-closes children, but the umbrella's manual checkboxes need a manual edit if we want them to reflect the closed state).

After merge, dispatch a cluster reviewer per project precedent (the C-2 + C-3-finish pattern). Expected outcome: SHIP IT, 0 Critical / 0 Important.
