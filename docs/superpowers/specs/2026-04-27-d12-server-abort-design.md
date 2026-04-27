# D-12 — Server-side AbortSignal propagation

**Date:** 2026-04-27
**Issue:** [#13 — Propagate AbortSignal through to server-side streamText](https://github.com/RECTOR-LABS/kami/issues/13)
**Priority:** P1 (`qa-2026-04-26`)
**Sprint:** 2.1 (Chunk 2 — Test/Abort/Safety Extensions)
**Estimate:** 2-4h
**Branch:** `feat/d12-server-abort-propagation`

---

## Problem

When the client aborts an in-flight `/api/chat` request (user navigates, switches conversation, or deletes the active conversation — all wired in C-3 / D-4), the TCP socket closes and `nodeStream.pipe(res)` is destroyed. But the upstream `streamText` call inside `createChatStream` keeps running through its `stepCountIs(maxSteps)` budget — the LLM provider continues consuming tokens that the user no longer wants.

C-3 closed the loop on the client side (fetch aborts, ghost writes prevented). D-12 closes the loop on the server side: when the client disconnects, the LLM call cancels.

## Scope

**In scope** (variant `(a)+(c)` per brainstorm):
- Thread `AbortSignal` from `api/chat.ts` (controller created in handler, aborted on `req.on('close')`) → `createChatStream` (new optional 4th `signal` arg) → `streamText({ abortSignal })`.
- Discriminate AbortError from real errors in the existing catch block; skip the error-log path on abort.
- Info-log on abort (`console.log('chat:aborted', { wallet })`) for ops visibility.
- Add 3 tests in `api/chat.test.ts` covering signal threading + abort-on-close + late-close-no-op.
- Add new `server/chat.test.ts` with 2 unit tests for the catch-block discrimination on both abort and real-error paths (catch block cannot be tested through `api/chat.test.ts` because that file mocks `createChatStream` away).

**Out of scope** (skipped variants and non-goals):
- Fastify dev server (`server/index.ts`) abort wiring — variant `(b)` skipped. Dev pays no token costs.
- Cancelling in-flight Solana RPC tool executions — tools are <1s; LLM call is the 90% cost win.
- Adding `timeout` to `streamText` — Vercel function `maxDuration: 60` already caps wall-clock.
- Structured-log adapter for the abort log line — D-14 handles structured logging globally.
- Client-side test expansion for abort behavior — that's Sprint 2.2 (D-11).

## Architecture

End-to-end signal propagation:

```
useChat.ts (client)              api/chat.ts (handler)         server/chat.ts (createChatStream)
─────────────────                ────────────────────          ──────────────────────────────────
fetch({ signal })   ──────►  TCP socket close
                             req.on('close', () => {
                               if (!res.writableEnded) {
                                 controller.abort()  ──────►  signal.aborted = true
                                 console.log('chat:aborted',
                                             { wallet })
                               }
                             })
                             createChatStream(..., signal)  ─►  streamText({ abortSignal: signal })
                                                                  for await throws AbortError
                                                                  catch block detects abort:
                                                                  - skips log.error
                                                                  - skips writeEvent({ error })
                                                                  - controller.close() in finally
```

### Key design decisions

1. **`AbortController` lives in the handler (`api/chat.ts`)**, not in `createChatStream`. Caller-passes-signal pattern — testable, composable, no leaky abstraction.
2. **`signal?: AbortSignal` is optional** on `createChatStream` — preserves backward-compat for `server/index.ts` (Fastify dev) and existing test mocks. No breaking changes in the same commit.
3. **`res.writableEnded` guard** on `req.on('close')` — distinguishes natural-completion close (no abort needed) from client-disconnect close (real abort). This is the canonical Node.js check.
4. **Both abort-detection checks** in the catch block: `signal?.aborted || err.name === 'AbortError'`. Belt-and-suspenders against AI SDK wrapping the error.

## Code changes

Three files touched. Total diff target: ~30 LOC additions across two production files + ~70 LOC test additions.

### `server/chat.ts`

Three surgical changes — signature widening, signal forwarding, abort discrimination in catch:

```diff
 export function createChatStream(
   input: ChatInput,
   apiKey: string,
-  log: ChatLogger = consoleLogger
+  log: ChatLogger = consoleLogger,
+  signal?: AbortSignal,
 ): ReadableStream<Uint8Array> {
   // ... unchanged setup ...

   const result = streamText({
     model: openrouter.chat(model),
     system: SYSTEM_PROMPT + walletContext,
     messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
     tools,
     stopWhen: stepCountIs(maxSteps),
+    abortSignal: signal,
   });

   // ... unchanged for-await loop ...

   } catch (err) {
+    const aborted =
+      signal?.aborted || (err instanceof Error && err.name === 'AbortError');
+    if (!aborted) {
       const message = err instanceof Error ? err.message : 'Unknown error';
       log.error({ err: message }, 'chat stream error');
       writeEvent({ error: message });
+    }
   } finally {
     controller.close();
   }
```

### `api/chat.ts`

Add controller + close listener after `writeHead`. Pass signal as 4th arg:

```diff
   res.writeHead(200, { ... });

+  const controller = new AbortController();
+  req.on('close', () => {
+    if (!res.writableEnded) {
+      controller.abort();
+      console.log('chat:aborted', { wallet: walletAddress ?? null });
+    }
+  });
+
   const webStream = createChatStream(
     { messages, walletAddress: walletAddress ?? null },
     apiKey,
+    undefined,
+    controller.signal,
   );
```

### `server/index.ts` (Fastify dev)

**Unchanged.** Picks up the optional 4th arg as `undefined` — no-op for dev.

### `api/chat.test.ts`

Three additions — see Testing section below.

## Testing

Three new tests added to the existing `describe('api/chat handler', ...)` block. Mock infrastructure extends to support signal capture and stream gating.

### Mock infrastructure changes

```ts
// chatMocks (vi.hoisted) gains two fields:
const chatMocks = vi.hoisted(() => ({
  // ... existing fields
  lastSignal: undefined as AbortSignal | undefined,    // NEW: capture 4th arg
  streamGate: null as Promise<void> | null,            // NEW: delay stream completion
}));

// Mock impl gains signal capture + optional gating. Outer fn stays sync
// (createChatStream returns ReadableStream synchronously); only the
// ReadableStream's `start` needs to be async to await the gate.
vi.mock('../server/chat.js', () => ({
  createChatStream: vi.fn(
    (
      args: ...,
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

### `makeReq` change

The current mock uses `Readable.from()` which auto-emits `'close'` after body consumption — this is the inverse of real HTTP `IncomingMessage` semantics, where `'close'` only fires on TCP socket disconnect. Switch to a manually-constructed Readable with `autoDestroy: false`:

```ts
function makeReq(opts: ...): IncomingMessage {
  const buf = ...;
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
  Object.assign(stream, { method: opts.method ?? 'POST', headers: opts.headers ?? {} });
  return stream as unknown as IncomingMessage;
}
```

This lets tests control when `'close'` fires (manually via `stream.emit('close')`) instead of inheriting auto-close timing from `Readable.from()`.

### Test 1 — signal threaded, not aborted on natural completion

```ts
it('passes a non-aborted AbortSignal to createChatStream and signal stays clean on natural completion', async () => {
  ratelimitMocks.next = { ok: true, limit: 30, remaining: 29, reset: Date.now() + 60_000 };
  const cap = makeRes();
  await handler(makeReq({ body: validBody() }), cap.res);
  expect(chatMocks.lastSignal).toBeInstanceOf(AbortSignal);
  expect(chatMocks.lastSignal?.aborted).toBe(false);
});
```

### Test 2 — req close mid-stream aborts the signal

```ts
it('aborts the AbortSignal when req emits close before res.writableEnded', async () => {
  let releaseStream: () => void = () => {};
  chatMocks.streamGate = new Promise<void>((r) => { releaseStream = r; });
  ratelimitMocks.next = { ok: true, limit: 30, remaining: 29, reset: Date.now() + 60_000 };

  const req = makeReq({ body: validBody() });
  const cap = makeRes();
  const handlerDone = handler(req, cap.res);

  await new Promise((r) => setImmediate(r));  // let handler enter the pipe-await
  expect(chatMocks.lastSignal?.aborted).toBe(false);

  (req as unknown as Readable).emit('close');
  expect(chatMocks.lastSignal?.aborted).toBe(true);

  releaseStream();
  await handlerDone;
});
```

### Test 3 — late close after natural completion is a no-op

```ts
it('does not abort the AbortSignal when req emits close after res.writableEnded', async () => {
  ratelimitMocks.next = { ok: true, limit: 30, remaining: 29, reset: Date.now() + 60_000 };
  const req = makeReq({ body: validBody() });
  const cap = makeRes();
  await handler(req, cap.res);  // natural completion, sets writableEnded

  (req as unknown as Readable).emit('close');
  expect(chatMocks.lastSignal?.aborted).toBe(false);
});
```

### Catch-block coverage — new `server/chat.test.ts`

The catch-block discrimination (`signal?.aborted || err.name === 'AbortError'`) is new code in `server/chat.ts`. It cannot be tested through `api/chat.test.ts` because that file mocks `createChatStream` away. So a new unit-test file `server/chat.test.ts` is added with 2 tests:

```ts
// server/chat.test.ts (new file)
//
// Mocks `ai` and `@ai-sdk/openai`; uses an `aiMocks.fullStreamFactory`
// hoisted shared state to inject either an AbortError or a real error
// into the streamText fullStream. Drains the returned ReadableStream
// and asserts on log.error invocation count + presence of "error"
// in the streamed body.
//
// 1. 'suppresses log.error and stream error event when fullStream throws AbortError'
// 2. 'logs error and emits error event when fullStream throws a non-abort error'
```

### Coverage delta

| Suite | Before | After |
|---|---|---|
| Total tests | 129 | 134 |
| Test files | 14 | 15 |
| `api/chat.test.ts` tests | 14 | 17 |
| `server/chat.test.ts` tests | 0 | 2 |

## Edge cases

| Edge case | Handling |
|---|---|
| AbortError thrown by `result.fullStream` for-await | Catch block discriminates with `signal?.aborted \|\| err.name === 'AbortError'`. Skips both `log.error` AND `writeEvent({ error })`. |
| Listener leak after stream completes | Not a concern — `IncomingMessage` is GC'd with the request lifecycle. Listener has no external references. |
| Race: `res.end()` fires between our check and `controller.abort()` | Node event loop is single-threaded. Check + abort are atomic relative to other handlers — no torn read. |
| Real HTTP `IncomingMessage` vs test mock `Readable.from()` | Real `req.on('close')` only fires on TCP socket close; `Readable.from()` auto-emits close after consumption. Test infra fix: `autoDestroy: false`. |
| Multiple listeners on `req 'close'` | None — Node core doesn't add others on `IncomingMessage`. Our single listener owns it. |
| Tools-in-flight at abort time | Resolve naturally. The abort cancels the LLM provider call (via AI SDK's `abortSignal`), not the in-flight tool's Solana RPC requests. |

## Non-goals — explicitly deferred

| Item | Where it goes |
|---|---|
| Cancel in-flight Solana RPC tool calls | Future sprint if it becomes a real cost concern. Today's tools are <1s each. |
| `timeout` option on `streamText` | YAGNI. Vercel `maxDuration: 60` already caps wall-clock. |
| Wire abort in `server/index.ts` (Fastify dev) | Variant `(b)` deferred. Optional polish; dev pays no token costs. |
| Structured-log adapter for `chat:aborted` | D-14 (P2) — global structured-log refactor handles all current `console.log` call sites at once. |
| Client-side test expansion (abort behavior in `useChat.test.ts`) | Sprint 2.2 (D-11). D-12 is server-side only. |

## Acceptance criteria

- [ ] `pnpm exec tsc -b` clean.
- [ ] `pnpm test:run` — 134/134 passing across 15 files.
- [ ] Test 1 (signal-threaded) passes.
- [ ] Test 2 (abort-on-close) passes.
- [ ] Test 3 (late-close no-op) passes.
- [ ] `server/chat.test.ts` — both catch-block discrimination tests pass.
- [ ] Manual smoke: production deploy, open two browser tabs, send a message in tab A, switch to tab B before the stream completes — verify Vercel function logs show `chat:aborted` and OpenRouter dashboard shows the request was cut short (no full stepCountIs budget consumed).
- [ ] Issue #13 closed by the merge commit (via `Closes #13` in PR body).

## Risks

- **Test 2 race-condition fragility:** `setImmediate` to allow the handler to enter the pipe-await is a heuristic. If the handler reorders work, the test may flake. Mitigation: the test timing is brittle by nature; if it flakes, switch to a polling check (`while (!chatMocks.lastSignal) await tick()`).
- **AI SDK v6 abort semantics undocumented for `streamText`:** the `abortSignal` field in `streamText` options is typed but the runtime behavior under abort (does the for-await throw immediately? does it gracefully end?) needs to be verified during implementation. Fallback: if AI SDK swallows abort, we still get the cost win (provider connection closed), just without a clean throw — the catch block handles either.
- **`res.writableEnded` not set in time:** if the pipe completes but res isn't yet "ended" by the time req.close fires, our guard fails and we spuriously abort. Mitigation: `res.writableEnded` is set synchronously by `res.end()` per Node docs — should be reliable. If we see flakes, add a `completed` flag that's set after the pipe-end Promise resolves.

## Acceptance — done when

> "Would this survive a security audit?" Yes — no new attack surface; signal flow is purely internal cleanup.
> "Would I deploy this to mainnet tonight?" Yes — backward-compat preserved, tests cover both happy and abort paths.
> "Will the next developer understand why I made these choices?" The 4-arg signature is documented in this spec and the optional-signal pattern is the textbook Node abort idiom.
