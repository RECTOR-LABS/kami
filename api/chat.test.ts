// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Readable, Writable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';

const ratelimitMocks = vi.hoisted(() => ({
  next: null as null | { ok: boolean; limit: number; remaining: number; reset: number },
  identify: '203.0.113.7',
  calls: [] as Array<{ identifier: string }>,
}));

const chatMocks = vi.hoisted(() => ({
  lastArgs: null as null | {
    messages: Array<{ role: string; content: string }>;
    walletAddress: string | null;
  },
  lastApiKey: '' as string,
  streamChunks: ['data: hello\n\n', 'data: world\n\n'],
}));

vi.mock('../server/ratelimit.js', () => ({
  applyLimit: vi.fn(async (_cfg: unknown, identifier: string) => {
    ratelimitMocks.calls.push({ identifier });
    return ratelimitMocks.next;
  }),
  identify: vi.fn(() => ratelimitMocks.identify),
}));

vi.mock('../server/chat.js', () => ({
  createChatStream: vi.fn(
    (
      args: { messages: Array<{ role: string; content: string }>; walletAddress: string | null },
      apiKey: string,
    ) => {
      chatMocks.lastArgs = args;
      chatMocks.lastApiKey = apiKey;
      const encoder = new TextEncoder();
      return new ReadableStream({
        start(controller) {
          for (const c of chatMocks.streamChunks) controller.enqueue(encoder.encode(c));
          controller.close();
        },
      });
    },
  ),
}));

import handler from './chat';

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
  const stream = Readable.from(buf.length > 0 ? [buf] : []);
  Object.assign(stream, {
    method: opts.method ?? 'POST',
    headers: opts.headers ?? {},
  });
  return stream as unknown as IncomingMessage;
}

interface CapturedRes {
  res: ServerResponse;
  headers: Record<string, string>;
  getStatus: () => number;
  getBody: () => string;
}

function makeRes(): CapturedRes {
  const headers: Record<string, string> = {};
  let statusCode = 0;
  const chunks: Buffer[] = [];
  let ended = false;

  const writable = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      cb();
    },
    final(cb) {
      ended = true;
      cb();
    },
  });

  const res = writable as unknown as ServerResponse & {
    setHeader: (k: string, v: string | number) => void;
    writeHead: (s: number, h?: Record<string, string | number>) => void;
    end: (payload?: string | Buffer) => void;
  };

  Object.defineProperty(res, 'statusCode', {
    get: () => statusCode,
    set: (v: number) => {
      statusCode = v;
    },
    configurable: true,
  });

  res.setHeader = (k: string, v: string | number) => {
    headers[k.toLowerCase()] = String(v);
  };
  res.writeHead = (s: number, h?: Record<string, string | number>) => {
    statusCode = s;
    if (h) {
      for (const [k, v] of Object.entries(h)) headers[k.toLowerCase()] = String(v);
    }
  };
  const origEnd = writable.end.bind(writable);
  res.end = (payload?: string | Buffer) => {
    if (typeof payload === 'string') chunks.push(Buffer.from(payload));
    else if (Buffer.isBuffer(payload)) chunks.push(payload);
    ended = true;
    origEnd();
  };

  return {
    res,
    headers,
    getStatus: () => statusCode,
    getBody: () => Buffer.concat(chunks).toString(),
  };
}

const validBody = () =>
  JSON.stringify({
    messages: [{ role: 'user', content: 'hello' }],
  });

describe('api/chat handler', () => {
  const origKey = process.env.KAMI_OPENROUTER_API_KEY;

  beforeEach(() => {
    process.env.KAMI_OPENROUTER_API_KEY = 'sk-stub-test-key';
    ratelimitMocks.next = null;
    ratelimitMocks.identify = '203.0.113.7';
    ratelimitMocks.calls.length = 0;
    chatMocks.lastArgs = null;
    chatMocks.lastApiKey = '';
    chatMocks.streamChunks = ['data: hello\n\n', 'data: world\n\n'];
  });

  afterEach(() => {
    if (origKey) process.env.KAMI_OPENROUTER_API_KEY = origKey;
    else delete process.env.KAMI_OPENROUTER_API_KEY;
  });

  it('rejects non-POST with 405 and Allow header', async () => {
    const cap = makeRes();
    await handler(makeReq({ method: 'GET' }), cap.res);
    expect(cap.getStatus()).toBe(405);
    expect(cap.headers['allow']).toBe('POST');
    expect(JSON.parse(cap.getBody()).error).toBe('Method not allowed');
  });

  it('returns 500 when KAMI_OPENROUTER_API_KEY is missing', async () => {
    delete process.env.KAMI_OPENROUTER_API_KEY;
    const cap = makeRes();
    await handler(makeReq({ body: validBody() }), cap.res);
    expect(cap.getStatus()).toBe(500);
    expect(JSON.parse(cap.getBody()).error).toMatch(/KAMI_OPENROUTER_API_KEY/);
  });

  it('returns 429 with Retry-After + X-RateLimit headers when rate-limit blocks', async () => {
    ratelimitMocks.next = {
      ok: false,
      limit: 30,
      remaining: 0,
      reset: Date.now() + 45_000,
    };
    const cap = makeRes();
    await handler(makeReq({ body: validBody() }), cap.res);
    expect(cap.getStatus()).toBe(429);
    expect(cap.headers['x-ratelimit-limit']).toBe('30');
    expect(cap.headers['retry-after']).toMatch(/^\d+$/);
    const body = JSON.parse(cap.getBody());
    expect(body.error).toBe('Too many requests');
    expect(body.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it('returns 413 when body exceeds 256 KiB', async () => {
    const oversized = 'x'.repeat(256 * 1024 + 1);
    const cap = makeRes();
    await handler(makeReq({ body: oversized }), cap.res);
    expect(cap.getStatus()).toBe(413);
    expect(JSON.parse(cap.getBody()).error).toMatch(/exceeds/);
  });

  it('returns 400 on invalid JSON', async () => {
    const cap = makeRes();
    await handler(makeReq({ body: '{"not-valid' }), cap.res);
    expect(cap.getStatus()).toBe(400);
    expect(JSON.parse(cap.getBody()).error).toBe('Invalid JSON body');
  });

  it('returns 400 when body is empty (zod requires messages)', async () => {
    const cap = makeRes();
    await handler(makeReq({ body: '' }), cap.res);
    expect(cap.getStatus()).toBe(400);
    const body = JSON.parse(cap.getBody());
    expect(body.error).toBe('Invalid request body');
    expect(Array.isArray(body.issues)).toBe(true);
  });

  it('returns 400 with zod issue when messages array is empty', async () => {
    const cap = makeRes();
    await handler(makeReq({ body: JSON.stringify({ messages: [] }) }), cap.res);
    expect(cap.getStatus()).toBe(400);
    const body = JSON.parse(cap.getBody());
    expect(body.issues.some((i: { path: string }) => i.path === 'messages')).toBe(true);
  });

  it('returns 400 when messages exceeds 50 entries', async () => {
    const tooMany = Array.from({ length: 51 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: 'x',
    }));
    const cap = makeRes();
    await handler(makeReq({ body: JSON.stringify({ messages: tooMany }) }), cap.res);
    expect(cap.getStatus()).toBe(400);
    expect(JSON.parse(cap.getBody()).error).toBe('Invalid request body');
  });

  it('returns 400 when a message content exceeds 8000 chars', async () => {
    const longContent = 'x'.repeat(8001);
    const cap = makeRes();
    await handler(
      makeReq({
        body: JSON.stringify({ messages: [{ role: 'user', content: longContent }] }),
      }),
      cap.res,
    );
    expect(cap.getStatus()).toBe(400);
    expect(JSON.parse(cap.getBody()).error).toBe('Invalid request body');
  });

  it('returns 400 when a message role is invalid', async () => {
    const cap = makeRes();
    await handler(
      makeReq({
        body: JSON.stringify({ messages: [{ role: 'system', content: 'hi' }] }),
      }),
      cap.res,
    );
    expect(cap.getStatus()).toBe(400);
    expect(JSON.parse(cap.getBody()).error).toBe('Invalid request body');
  });

  it('returns 400 when walletAddress fails the base58 regex', async () => {
    const cap = makeRes();
    await handler(
      makeReq({
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'hi' }],
          walletAddress: 'not$valid$base58',
        }),
      }),
      cap.res,
    );
    expect(cap.getStatus()).toBe(400);
    const body = JSON.parse(cap.getBody());
    expect(body.issues.some((i: { path: string }) => i.path === 'walletAddress')).toBe(true);
  });

  it('accepts walletAddress: null', async () => {
    const cap = makeRes();
    await handler(
      makeReq({
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'hi' }],
          walletAddress: null,
        }),
      }),
      cap.res,
    );
    expect(cap.getStatus()).toBe(200);
    expect(chatMocks.lastArgs?.walletAddress).toBeNull();
  });

  it('streams 200 text/event-stream on happy path + forwards stream body', async () => {
    ratelimitMocks.next = {
      ok: true,
      limit: 30,
      remaining: 29,
      reset: Date.now() + 60_000,
    };
    const cap = makeRes();
    await handler(
      makeReq({
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'hello' }],
          walletAddress: '7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF',
        }),
      }),
      cap.res,
    );
    expect(cap.getStatus()).toBe(200);
    expect(cap.headers['content-type']).toBe('text/event-stream');
    expect(cap.headers['cache-control']).toBe('no-cache, no-transform');
    expect(cap.headers['x-accel-buffering']).toBe('no');
    expect(cap.headers['x-ratelimit-limit']).toBe('30');
    const body = cap.getBody();
    expect(body).toContain('data: hello');
    expect(body).toContain('data: world');
    expect(chatMocks.lastApiKey).toBe('sk-stub-test-key');
    expect(chatMocks.lastArgs?.walletAddress).toBe('7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF');
    expect(chatMocks.lastArgs?.messages[0].content).toBe('hello');
  });

  it('passes the identified IP to applyLimit', async () => {
    ratelimitMocks.identify = '198.51.100.9';
    const cap = makeRes();
    await handler(makeReq({ body: validBody() }), cap.res);
    expect(ratelimitMocks.calls).toHaveLength(1);
    expect(ratelimitMocks.calls[0].identifier).toBe('198.51.100.9');
  });
});
