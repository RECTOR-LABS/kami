import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';

const ratelimitMocks = vi.hoisted(() => ({
  next: null as null | { ok: boolean; limit: number; remaining: number; reset: number },
  identify: '203.0.113.7',
  calls: [] as Array<{ identifier: string }>,
}));

vi.mock('../server/ratelimit.js', () => ({
  applyLimit: vi.fn(async (_cfg: unknown, identifier: string) => {
    ratelimitMocks.calls.push({ identifier });
    return ratelimitMocks.next;
  }),
  identify: vi.fn(() => ratelimitMocks.identify),
}));

import handler from './rpc';

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
  let body = '';
  const res = {
    setHeader: (k: string, v: string | number) => {
      headers[k.toLowerCase()] = String(v);
    },
    end: (payload?: string | Buffer) => {
      if (payload) body += typeof payload === 'string' ? payload : payload.toString();
    },
  };
  Object.defineProperty(res, 'statusCode', {
    get: () => statusCode,
    set: (v: number) => {
      statusCode = v;
    },
    configurable: true,
  });
  return {
    res: res as unknown as ServerResponse,
    headers,
    getStatus: () => statusCode,
    getBody: () => body,
  };
}

describe('api/rpc handler', () => {
  const origUpstream = process.env.SOLANA_RPC_URL;
  const origFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.SOLANA_RPC_URL = 'https://stub-rpc.example.com';
    ratelimitMocks.next = null;
    ratelimitMocks.identify = '203.0.113.7';
    ratelimitMocks.calls.length = 0;
  });

  afterEach(() => {
    if (origUpstream) process.env.SOLANA_RPC_URL = origUpstream;
    else delete process.env.SOLANA_RPC_URL;
    globalThis.fetch = origFetch;
  });

  it('rejects non-POST with 405 and Allow header', async () => {
    const req = makeReq({ method: 'GET' });
    const cap = makeRes();
    await handler(req, cap.res);
    expect(cap.getStatus()).toBe(405);
    expect(cap.headers['allow']).toBe('POST');
    expect(JSON.parse(cap.getBody())).toEqual({ error: 'Method not allowed' });
  });

  it('returns 500 when SOLANA_RPC_URL is missing', async () => {
    delete process.env.SOLANA_RPC_URL;
    const req = makeReq({ body: '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' });
    const cap = makeRes();
    await handler(req, cap.res);
    expect(cap.getStatus()).toBe(500);
    expect(JSON.parse(cap.getBody()).error).toMatch(/SOLANA_RPC_URL/);
  });

  it('returns 429 with Retry-After + X-RateLimit headers when rate-limit blocks', async () => {
    ratelimitMocks.next = {
      ok: false,
      limit: 120,
      remaining: 0,
      reset: Date.now() + 30_000,
    };
    const req = makeReq({ body: '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' });
    const cap = makeRes();
    await handler(req, cap.res);
    expect(cap.getStatus()).toBe(429);
    expect(cap.headers['x-ratelimit-limit']).toBe('120');
    expect(cap.headers['x-ratelimit-remaining']).toBe('0');
    expect(cap.headers['retry-after']).toMatch(/^\d+$/);
    const body = JSON.parse(cap.getBody());
    expect(body.error).toBe('Too many requests');
    expect(body.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it('sets X-RateLimit-* headers and proceeds when rate-limit allows', async () => {
    ratelimitMocks.next = {
      ok: true,
      limit: 120,
      remaining: 119,
      reset: Date.now() + 60_000,
    };
    globalThis.fetch = vi.fn(async () =>
      new Response('{"jsonrpc":"2.0","id":1,"result":"ok"}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const req = makeReq({ body: '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' });
    const cap = makeRes();
    await handler(req, cap.res);
    expect(cap.headers['x-ratelimit-limit']).toBe('120');
    expect(cap.headers['x-ratelimit-remaining']).toBe('119');
    expect(cap.getStatus()).toBe(200);
  });

  it('returns 413 when body exceeds 64 KiB', async () => {
    const oversized = 'x'.repeat(64 * 1024 + 1);
    const req = makeReq({ body: oversized });
    const cap = makeRes();
    await handler(req, cap.res);
    expect(cap.getStatus()).toBe(413);
    expect(JSON.parse(cap.getBody()).error).toMatch(/exceeds/);
  });

  it('returns 400 on invalid JSON', async () => {
    const req = makeReq({ body: '{"not-valid-json' });
    const cap = makeRes();
    await handler(req, cap.res);
    expect(cap.getStatus()).toBe(400);
    expect(JSON.parse(cap.getBody()).error).toBe('Invalid JSON body');
  });

  it('returns 403 when a denied method is in a single call', async () => {
    const req = makeReq({
      body: '{"jsonrpc":"2.0","id":1,"method":"getProgramAccounts"}',
    });
    const cap = makeRes();
    await handler(req, cap.res);
    expect(cap.getStatus()).toBe(403);
    const body = JSON.parse(cap.getBody());
    expect(body.error).toContain('getProgramAccounts');
    expect(body.hint).toContain('Helius');
  });

  it('returns 403 when a denied method is in a batch', async () => {
    const req = makeReq({
      body: JSON.stringify([
        { jsonrpc: '2.0', id: 1, method: 'getHealth' },
        { jsonrpc: '2.0', id: 2, method: 'getBlock' },
      ]),
    });
    const cap = makeRes();
    await handler(req, cap.res);
    expect(cap.getStatus()).toBe(403);
    expect(JSON.parse(cap.getBody()).error).toContain('getBlock');
  });

  it('returns 400 when params array exceeds 100 entries', async () => {
    const oversizedParams = new Array(101).fill('addr');
    const req = makeReq({
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getMultipleAccounts',
        params: [oversizedParams],
      }),
    });
    const cap = makeRes();
    await handler(req, cap.res);
    expect(cap.getStatus()).toBe(400);
    expect(JSON.parse(cap.getBody()).error).toContain('params array length 101');
  });

  it('returns 400 when a batch exceeds 20 calls', async () => {
    const batch = new Array(21).fill({ jsonrpc: '2.0', id: 1, method: 'getHealth' });
    const req = makeReq({ body: JSON.stringify(batch) });
    const cap = makeRes();
    await handler(req, cap.res);
    expect(cap.getStatus()).toBe(400);
    expect(JSON.parse(cap.getBody()).error).toContain('batch of 21');
  });

  it('proxies request to upstream and forwards status + body', async () => {
    let captured: { url: string; body: string | null } | null = null;
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      captured = {
        url: String(url),
        body:
          init?.body === undefined
            ? null
            : typeof init.body === 'string'
              ? init.body
              : init.body instanceof Buffer
                ? init.body.toString()
                : String(init.body),
      };
      return new Response('{"jsonrpc":"2.0","id":1,"result":{"slot":12345}}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const payload = '{"jsonrpc":"2.0","id":1,"method":"getSlot"}';
    const req = makeReq({ body: payload });
    const cap = makeRes();
    await handler(req, cap.res);
    expect(cap.getStatus()).toBe(200);
    expect(cap.headers['content-type']).toBe('application/json');
    expect(JSON.parse(cap.getBody()).result.slot).toBe(12345);
    expect(captured!.url).toBe('https://stub-rpc.example.com');
    expect(captured!.body).toBe(payload);
  });

  it('returns 502 when upstream fetch throws', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('econnrefused');
    });
    const req = makeReq({ body: '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' });
    const cap = makeRes();
    await handler(req, cap.res);
    expect(cap.getStatus()).toBe(502);
    const body = JSON.parse(cap.getBody());
    expect(body.error).toBe('Upstream RPC error');
    expect(body.detail).toContain('econnrefused');
  });

  it('passes the identified IP to applyLimit', async () => {
    ratelimitMocks.identify = '198.51.100.42';
    ratelimitMocks.next = {
      ok: true,
      limit: 120,
      remaining: 119,
      reset: Date.now() + 60_000,
    };
    globalThis.fetch = vi.fn(
      async () => new Response('{"result":"ok"}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const req = makeReq({ body: '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' });
    const cap = makeRes();
    await handler(req, cap.res);
    expect(ratelimitMocks.calls).toHaveLength(1);
    expect(ratelimitMocks.calls[0].identifier).toBe('198.51.100.42');
  });
});
