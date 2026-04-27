# D-12 Server-side AbortSignal Propagation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the client aborts an in-flight `/api/chat` request, propagate the abort to the server-side `streamText` call so the LLM provider stops consuming tokens.

**Architecture:** Caller-passes-signal pattern. `api/chat.ts` creates an `AbortController`, listens to `req.on('close')` with a `res.writableEnded` guard, and threads `controller.signal` through a new optional 4th param of `createChatStream` into `streamText({ abortSignal })`. The catch block in `createChatStream` discriminates `AbortError` from real errors and suppresses both `log.error` and `writeEvent({ error })` on abort.

**Tech Stack:** Node.js 24 (Vercel function runtime), AI SDK v6 (`ai@^6.0.168`), Vitest 4.x with `vi.hoisted()` mock state, TypeScript strict mode.

**Spec:** `docs/superpowers/specs/2026-04-27-d12-server-abort-design.md`

**Branch:** `feat/d12-server-abort-propagation`

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `server/chat.ts` | Modify | Add optional `signal?: AbortSignal` 4th param; forward to `streamText({ abortSignal })`; discriminate AbortError in catch block. |
| `api/chat.ts` | Modify | Create `AbortController` after `writeHead`, register `req.on('close')` listener with `res.writableEnded` guard, pass `controller.signal` to `createChatStream`. |
| `api/chat.test.ts` | Modify | Extend mock infrastructure (`chatMocks.lastSignal`, `chatMocks.streamGate`) + `makeReq` (`autoDestroy: false`); add Test 1 (signal threaded), Test 2 (abort on close), Test 3 (late close no-op). |
| `server/chat.test.ts` | Create | New unit-test file for `createChatStream` catch-block discrimination; mocks `ai` + `@ai-sdk/openai`; 2 tests (AbortError suppressed, real error propagated). |

`server/index.ts` (Fastify dev) is **unchanged** — picks up the new optional 4th arg as `undefined`, no-op for dev.

Total diff: ~30 LOC additions in production files + ~120 LOC test additions. Three commits.

---

## Task 1: Thread AbortSignal end-to-end

**Files:**
- Modify: `api/chat.test.ts` (mock infrastructure + Test 1)
- Modify: `server/chat.ts` (add signal param + abortSignal in streamText)
- Modify: `api/chat.ts` (create controller, pass signal)

- [ ] **Step 1: Extend `chatMocks` to capture the signal**

In `api/chat.test.ts`, edit the existing `chatMocks` declaration to add `lastSignal` and `streamGate` fields:

```ts
const chatMocks = vi.hoisted(() => ({
  lastArgs: null as null | {
    messages: Array<{ role: string; content: string }>;
    walletAddress: string | null;
  },
  lastApiKey: '' as string,
  lastSignal: undefined as AbortSignal | undefined,
  streamChunks: ['data: hello\n\n', 'data: world\n\n'],
  streamGate: null as Promise<void> | null,
}));
```

- [ ] **Step 2: Update the `createChatStream` mock to capture the signal arg + support gating**

Replace the existing `vi.mock('../server/chat.js', ...)` block in `api/chat.test.ts` with this version. The outer fn stays sync (returns ReadableStream synchronously); only the ReadableStream's `start` is async to await the gate:

```ts
vi.mock('../server/chat.js', () => ({
  createChatStream: vi.fn(
    (
      args: { messages: Array<{ role: string; content: string }>; walletAddress: string | null },
      apiKey: string,
      _log: unknown,
      signal: AbortSignal | undefined,
    ) => {
      chatMocks.lastArgs = args;
      chatMocks.lastApiKey = apiKey;
      chatMocks.lastSignal = signal;
      const encoder = new TextEncoder();
      return new ReadableStream({
        async start(controller) {
          if (chatMocks.streamGate) await chatMocks.streamGate;
          for (const c of chatMocks.streamChunks) controller.enqueue(encoder.encode(c));
          controller.close();
        },
      });
    },
  ),
}));
```

- [ ] **Step 3: Update `makeReq` to use `autoDestroy: false`**

The existing `makeReq` uses `Readable.from()` which auto-emits `'close'` after consumption — inverse of real HTTP `IncomingMessage` semantics. Replace `makeReq` in `api/chat.test.ts` with:

```ts
function makeReq(opts: {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
} = {}): IncomingMessage {
  const buf =
    opts.body === undefined
      ? Buffer.alloc(0)
      : typeof opts.body === 'string'
        ? Buffer.from(opts.body)
        : opts.body;
  let pushed = false;
  const stream = new Readable({
    autoDestroy: false,
    read() {
      if (pushed) return;
      pushed = true;
      if (buf.length > 0) this.push(buf);
      this.push(null);
    },
  });
  Object.assign(stream, {
    method: opts.method ?? 'POST',
    headers: opts.headers ?? {},
  });
  return stream as unknown as IncomingMessage;
}
```

- [ ] **Step 4: Reset `lastSignal` and `streamGate` in `beforeEach`**

In `api/chat.test.ts`, add to the existing `beforeEach`:

```ts
beforeEach(() => {
  process.env.KAMI_OPENROUTER_API_KEY = 'sk-stub-test-key';
  ratelimitMocks.next = null;
  ratelimitMocks.identify = '203.0.113.7';
  ratelimitMocks.calls.length = 0;
  chatMocks.lastArgs = null;
  chatMocks.lastApiKey = '';
  chatMocks.lastSignal = undefined;        // NEW
  chatMocks.streamChunks = ['data: hello\n\n', 'data: world\n\n'];
  chatMocks.streamGate = null;             // NEW
});
```

- [ ] **Step 5: Write Test 1**

Add this test after the existing `it('passes the identified IP to applyLimit', ...)` test in `api/chat.test.ts`:

```ts
it('passes a non-aborted AbortSignal to createChatStream and signal stays clean on natural completion', async () => {
  ratelimitMocks.next = {
    ok: true,
    limit: 30,
    remaining: 29,
    reset: Date.now() + 60_000,
  };
  const cap = makeRes();
  await handler(makeReq({ body: validBody() }), cap.res);
  expect(chatMocks.lastSignal).toBeInstanceOf(AbortSignal);
  expect(chatMocks.lastSignal?.aborted).toBe(false);
});
```

- [ ] **Step 6: Run Test 1 — verify FAIL**

```bash
pnpm exec vitest run api/chat.test.ts -t "passes a non-aborted AbortSignal"
```

Expected: FAIL — `chatMocks.lastSignal` is `undefined` because `api/chat.ts` does not yet pass a signal to `createChatStream`.

- [ ] **Step 7: Add `signal` param to `createChatStream` and forward to `streamText`**

Edit `server/chat.ts`. Update the `createChatStream` signature:

```ts
export function createChatStream(
  input: ChatInput,
  apiKey: string,
  log: ChatLogger = consoleLogger,
  signal?: AbortSignal,
): ReadableStream<Uint8Array> {
```

Then update the `streamText` call (currently lines 137-143):

```ts
const result = streamText({
  model: openrouter.chat(model),
  system: SYSTEM_PROMPT + walletContext,
  messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
  tools,
  stopWhen: stepCountIs(maxSteps),
  abortSignal: signal,
});
```

- [ ] **Step 8: Update `api/chat.ts` to create controller and pass signal**

In `api/chat.ts`, modify the `createChatStream` call (currently lines 119-122):

```ts
const controller = new AbortController();

const webStream = createChatStream(
  { messages, walletAddress: walletAddress ?? null },
  apiKey,
  undefined,
  controller.signal,
);
```

Note: the close listener comes in Task 2. For now the controller is created but never aborted, which is sufficient to make Test 1 pass.

- [ ] **Step 9: Run Test 1 — verify PASS**

```bash
pnpm exec vitest run api/chat.test.ts -t "passes a non-aborted AbortSignal"
```

Expected: PASS.

- [ ] **Step 10: Run full type-check + test suite**

```bash
pnpm exec tsc -b && pnpm test:run
```

Expected: zero TypeScript errors. 130/130 tests passing (was 129; +1 for Test 1).

- [ ] **Step 11: Commit**

```bash
git add server/chat.ts api/chat.ts api/chat.test.ts
git commit -m "$(cat <<'EOF'
feat(chat): thread AbortSignal from handler to streamText

Adds optional 4th `signal?: AbortSignal` param to createChatStream and
forwards it as `abortSignal` to streamText. api/chat.ts creates an
AbortController and passes its signal. Listener-on-req.close + catch-
block discrimination ship in follow-up commits.
EOF
)"
```

---

## Task 2: Wire `req.on('close')` to abort the controller

**Files:**
- Modify: `api/chat.test.ts` (Tests 2 + 3)
- Modify: `api/chat.ts` (close listener + writableEnded guard)

- [ ] **Step 1: Write Test 2 (abort mid-stream)**

Add to `api/chat.test.ts` after Test 1:

```ts
it('aborts the AbortSignal when req emits close before res.writableEnded', async () => {
  let releaseStream: () => void = () => {};
  chatMocks.streamGate = new Promise<void>((r) => {
    releaseStream = r;
  });
  ratelimitMocks.next = {
    ok: true,
    limit: 30,
    remaining: 29,
    reset: Date.now() + 60_000,
  };

  const req = makeReq({ body: validBody() });
  const cap = makeRes();
  const handlerDone = handler(req, cap.res);

  await new Promise((r) => setImmediate(r));
  expect(chatMocks.lastSignal?.aborted).toBe(false);

  (req as unknown as Readable).emit('close');
  expect(chatMocks.lastSignal?.aborted).toBe(true);

  releaseStream();
  await handlerDone;
});
```

- [ ] **Step 2: Write Test 3 (late close no-op)**

Add to `api/chat.test.ts` after Test 2:

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
```

- [ ] **Step 3: Run Tests 2 + 3 — verify Test 2 FAILS, Test 3 PASSES**

```bash
pnpm exec vitest run api/chat.test.ts -t "AbortSignal when req emits close"
```

Expected:
- Test 2: FAIL — no close listener registered yet, `chatMocks.lastSignal?.aborted` is `false` after `req.emit('close')`.
- Test 3: PASS — same reason; no abort happens, which is the asserted behavior.

(Test 3 trivially passes before the fix; it's a regression guard for after the fix.)

- [ ] **Step 4: Add `req.on('close')` listener with `res.writableEnded` guard**

In `api/chat.ts`, add this block AFTER `res.writeHead(200, { ... })` and BEFORE the `const controller = new AbortController()` line from Task 1. Final shape of that section:

```ts
res.writeHead(200, {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
});

const controller = new AbortController();
req.on('close', () => {
  if (!res.writableEnded) {
    controller.abort();
    console.log('chat:aborted', { wallet: walletAddress ?? null });
  }
});

const webStream = createChatStream(
  { messages, walletAddress: walletAddress ?? null },
  apiKey,
  undefined,
  controller.signal,
);
```

- [ ] **Step 5: Run Tests 2 + 3 — verify both PASS**

```bash
pnpm exec vitest run api/chat.test.ts -t "AbortSignal when req emits close"
```

Expected: both PASS.

- [ ] **Step 6: Run full type-check + test suite**

```bash
pnpm exec tsc -b && pnpm test:run
```

Expected: zero TypeScript errors. 132/132 tests passing (was 130; +2 for Tests 2 + 3).

- [ ] **Step 7: Commit**

```bash
git add api/chat.ts api/chat.test.ts
git commit -m "$(cat <<'EOF'
feat(chat): abort LLM call when client disconnects mid-stream

Registers req.on('close') in api/chat.ts with a res.writableEnded
guard so natural completion does not spuriously abort. Logs
'chat:aborted' with wallet for ops visibility. Closes the cost-leak
where streamText kept consuming tokens after the client navigated.
EOF
)"
```

---

## Task 3: Catch-block AbortError discrimination + unit tests

**Files:**
- Create: `server/chat.test.ts` (new unit-test file for createChatStream catch-block)
- Modify: `server/chat.ts` (catch-block discrimination)

- [ ] **Step 1: Create `server/chat.test.ts` with the 2 catch-block tests**

Create `server/chat.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const aiMocks = vi.hoisted(() => ({
  fullStreamFactory: null as null | (() => AsyncIterable<unknown>),
}));

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return {
    ...actual,
    streamText: vi.fn(() => ({
      get fullStream() {
        if (!aiMocks.fullStreamFactory) {
          throw new Error('test did not configure fullStreamFactory');
        }
        return aiMocks.fullStreamFactory();
      },
    })),
  };
});

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: () => ({ chat: () => ({}) }),
}));

import { createChatStream, type ChatLogger } from './chat';

async function drain(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(decoder.decode(value));
  }
  return chunks.join('');
}

describe('createChatStream catch-block', () => {
  let log: ChatLogger;

  beforeEach(() => {
    aiMocks.fullStreamFactory = null;
    log = { info: vi.fn(), error: vi.fn() };
  });

  it('suppresses log.error and stream error event when fullStream throws AbortError', async () => {
    const abortErr = new Error('aborted');
    abortErr.name = 'AbortError';
    aiMocks.fullStreamFactory = async function* () {
      throw abortErr;
      // unreachable: ensures generator type is AsyncIterable
      yield undefined as never;
    };

    const stream = createChatStream(
      { messages: [{ role: 'user', content: 'hi' }], walletAddress: null },
      'sk-stub',
      log,
    );
    const text = await drain(stream);

    expect(log.error).not.toHaveBeenCalled();
    expect(text).not.toContain('"error"');
  });

  it('logs error and emits error event when fullStream throws a non-abort error', async () => {
    aiMocks.fullStreamFactory = async function* () {
      throw new Error('LLM provider down');
      yield undefined as never;
    };

    const stream = createChatStream(
      { messages: [{ role: 'user', content: 'hi' }], walletAddress: null },
      'sk-stub',
      log,
    );
    const text = await drain(stream);

    expect(log.error).toHaveBeenCalledTimes(1);
    expect(text).toContain('"error":"LLM provider down"');
  });
});
```

- [ ] **Step 2: Run new tests — verify the AbortError test FAILS, real-error test PASSES**

```bash
pnpm exec vitest run server/chat.test.ts
```

Expected:
- `suppresses log.error and stream error event when fullStream throws AbortError`: FAIL — current catch block always calls `log.error` and `writeEvent({ error })`.
- `logs error and emits error event when fullStream throws a non-abort error`: PASS — that's the existing behavior.

- [ ] **Step 3: Add catch-block discrimination in `server/chat.ts`**

Replace the existing catch block in `server/chat.ts` (currently lines 178-181) with this version:

```ts
} catch (err) {
  const aborted =
    signal?.aborted || (err instanceof Error && err.name === 'AbortError');
  if (!aborted) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    log.error({ err: message }, 'chat stream error');
    writeEvent({ error: message });
  }
} finally {
  controller.close();
}
```

- [ ] **Step 4: Run new tests — verify both PASS**

```bash
pnpm exec vitest run server/chat.test.ts
```

Expected: both PASS.

- [ ] **Step 5: Run full type-check + test suite**

```bash
pnpm exec tsc -b && pnpm test:run
```

Expected: zero TypeScript errors. 134/134 tests passing across 15 files (was 132; +2 from the new server/chat.test.ts).

- [ ] **Step 6: Commit**

```bash
git add server/chat.ts server/chat.test.ts
git commit -m "$(cat <<'EOF'
feat(chat): suppress log+stream events on AbortError

Catch block in createChatStream now discriminates AbortError (via
signal.aborted or err.name) from real errors and skips both the
log.error call and the writeEvent({ error }). Prevents abort noise
in Vercel error metrics. New server/chat.test.ts unit-tests the
discrimination on both abort and real-error paths.
EOF
)"
```

---

## Final verification

- [ ] **Final type-check + full suite + build**

```bash
pnpm exec tsc -b && pnpm test:run && pnpm build
```

Expected:
- `pnpm exec tsc -b`: zero errors.
- `pnpm test:run`: 134/134 across 15 files.
- `pnpm build`: vite + tsc -b success; bundle size near current ~616 kB main.

- [ ] **Push branch + open PR**

```bash
git push -u origin feat/d12-server-abort-propagation
gh pr create --title "feat(chat): D-12 server-side AbortSignal propagation" --body "$(cat <<'EOF'
## Summary

Closes #13. Sprint 2.1 of Chunk 2 (per `docs/superpowers/specs/2026-04-26-qa-backlog-roadmap-design.md`).

When the client aborts an in-flight `/api/chat` request (user navigates, switches conversation, or deletes the active conversation — all wired in C-3), the TCP socket closes. Before this PR, `streamText` kept running through its `stepCountIs(maxSteps)` budget — paying for tokens the user no longer wants. This PR closes that loop on the server side.

## Changes

- `server/chat.ts`: optional `signal?: AbortSignal` 4th param forwarded to `streamText({ abortSignal })`. Catch block discriminates AbortError (via `signal.aborted || err.name === 'AbortError'`) and suppresses `log.error` + error stream event on abort.
- `api/chat.ts`: creates `AbortController` after `writeHead`, registers `req.on('close')` listener with `res.writableEnded` guard, passes `controller.signal` to `createChatStream`. Logs `'chat:aborted'` with wallet on real client disconnect.
- `api/chat.test.ts`: 3 new tests (signal-threaded, abort-on-close, late-close-no-op). Mock infrastructure extends with `lastSignal` capture, `streamGate` for delaying stream completion, and `makeReq` switched to `autoDestroy: false` to mirror real HTTP `IncomingMessage` semantics.
- `server/chat.test.ts`: new file with 2 unit tests covering the catch-block discrimination on both abort and real-error paths.
- `server/index.ts` (Fastify dev) unchanged — picks up the new optional 4th arg as `undefined`. Per scope (variant b skipped); dev pays no token costs.

## Test plan

- [x] `pnpm exec tsc -b` clean
- [x] `pnpm test:run` — 134/134 passing across 15 files
- [x] `pnpm build` succeeds with normal bundle size
- [ ] Manual smoke (post-merge prod): open two browser tabs at https://kami.rectorspace.com, send a yield-finder message in tab A, switch to tab B before stream completes, verify Vercel function logs show `chat:aborted` and OpenRouter dashboard shows the call was cut short
EOF
)"
```

- [ ] **Wait for CI + merge with `--merge` (keep branches)**

```bash
gh pr checks --watch
gh pr merge --merge
```

- [ ] **Production smoke + close umbrella checkbox**

After Vercel auto-deploys main:

```bash
# Verify deploy
curl -sS https://kami.rectorspace.com/api/rpc \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' -D - | head -5

# Then run the manual smoke in a real browser, check Vercel function logs for chat:aborted
gh issue list --label qa-2026-04-26 --state open --limit 30  # expect 24 open (was 25)
gh issue view 3  # ensure #13 ticked in umbrella
```

---

## Self-review

**Spec coverage:**
- ✅ Architecture diagram → reflected in code changes across Tasks 1, 2, 3.
- ✅ Code change to `server/chat.ts` (signature + abortSignal + catch) → Tasks 1 + 3.
- ✅ Code change to `api/chat.ts` (controller + close listener + signal pass) → Tasks 1 + 2.
- ✅ Mock infrastructure changes → Task 1, Step 1-4.
- ✅ Test 1 (signal-threaded) → Task 1, Step 5-6 + 9.
- ✅ Test 2 (abort-on-close) → Task 2, Step 1 + 3 + 5.
- ✅ Test 3 (late-close no-op) → Task 2, Step 2 + 3 + 5.
- ✅ Catch-block discrimination + unit tests → Task 3 (server/chat.test.ts).
- ✅ Acceptance criteria checklist → Final verification section.
- ✅ `server/index.ts` (Fastify dev) unchanged per scope — explicitly noted in File Structure section.

**Placeholder scan:** No TBD/TODO/"add appropriate handling" / "similar to Task N" / etc. All steps have actual code.

**Type consistency:** `chatMocks.lastSignal: AbortSignal | undefined` declared in Task 1 Step 1, used in Task 1 Step 5 (`expect(chatMocks.lastSignal).toBeInstanceOf(AbortSignal)`), Task 2 Step 1 (`chatMocks.lastSignal?.aborted`), Task 2 Step 2. Consistent. `signal?: AbortSignal` 4th param in `createChatStream` is consistent across Task 1 Step 7 (declaration), Task 1 Step 8 (api/chat.ts call site), Task 3 Step 3 (catch-block usage). `streamGate: Promise<void> | null` declared in Task 1 Step 1, reset in Task 1 Step 4, consumed in Task 2 Step 1.
