import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { IncomingMessage } from 'node:http';

const mocks = vi.hoisted(() => ({
  behavior: 'success' as 'success' | 'blocked' | 'throw',
  resetAt: 0,
}));

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static slidingWindow() {
      return {};
    }
    constructor() {}
    async limit(_id: string) {
      if (mocks.behavior === 'throw') throw new Error('upstash unreachable');
      const reset = mocks.resetAt || Date.now() + 60_000;
      return {
        success: mocks.behavior === 'success',
        limit: 10,
        remaining: mocks.behavior === 'success' ? 9 : 0,
        reset,
      };
    }
  },
}));

vi.mock('@upstash/redis', () => ({
  Redis: class {
    constructor() {}
  },
}));

import { identify, applyLimit, getLimiter, _resetForTesting } from './ratelimit';

function mockReq(headers: Record<string, string | string[] | undefined>): IncomingMessage {
  return { headers } as unknown as IncomingMessage;
}

describe('identify', () => {
  it('takes the first entry from x-forwarded-for', () => {
    const req = mockReq({ 'x-forwarded-for': '203.0.113.1, 10.0.0.2, 10.0.0.3' });
    expect(identify(req)).toBe('203.0.113.1');
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const req = mockReq({ 'x-real-ip': '203.0.113.9' });
    expect(identify(req)).toBe('203.0.113.9');
  });

  it('prefers x-forwarded-for over x-real-ip when both are present', () => {
    const req = mockReq({
      'x-forwarded-for': '203.0.113.1',
      'x-real-ip': '10.0.0.1',
    });
    expect(identify(req)).toBe('203.0.113.1');
  });

  it('returns empty string when no IP headers are present in production (fail-closed)', () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(identify(mockReq({}))).toBe('');
    } finally {
      if (origEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = origEnv;
    }
  });

  it('handles array values for x-forwarded-for', () => {
    const req = mockReq({ 'x-forwarded-for': ['203.0.113.1', '10.0.0.2'] });
    expect(identify(req)).toBe('203.0.113.1');
  });

  it('trims whitespace from header values', () => {
    const req = mockReq({ 'x-forwarded-for': '  203.0.113.1  ,  10.0.0.2  ' });
    expect(identify(req)).toBe('203.0.113.1');
  });

  it('returns a dev-prefixed UUID-shaped token outside production when no IP headers are present', () => {
    const origEnv = process.env.NODE_ENV;
    delete process.env.NODE_ENV;
    try {
      const id = identify(mockReq({}));
      expect(id).toMatch(/^dev-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    } finally {
      if (origEnv !== undefined) process.env.NODE_ENV = origEnv;
    }
  });
});

describe('getLimiter / applyLimit without env vars', () => {
  const origUrl = process.env.UPSTASH_REDIS_REST_URL;
  const origToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    _resetForTesting();
  });

  afterEach(() => {
    if (origUrl) process.env.UPSTASH_REDIS_REST_URL = origUrl;
    if (origToken) process.env.UPSTASH_REDIS_REST_TOKEN = origToken;
    _resetForTesting();
  });

  it('getLimiter returns null when env vars are missing', () => {
    expect(getLimiter({ name: 'test', limit: 10, window: '1 m' })).toBeNull();
  });

  it('applyLimit returns null when env vars are missing (graceful degradation)', async () => {
    const result = await applyLimit({ name: 'test', limit: 10, window: '1 m' }, '1.1.1.1');
    expect(result).toBeNull();
  });
});

describe('applyLimit with mocked Upstash', () => {
  const origUrl = process.env.UPSTASH_REDIS_REST_URL;
  const origToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const origErr = console.error;

  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://stub.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'stub-token';
    mocks.behavior = 'success';
    mocks.resetAt = 0;
    _resetForTesting();
    console.error = () => {};
  });

  afterEach(() => {
    if (origUrl) process.env.UPSTASH_REDIS_REST_URL = origUrl;
    else delete process.env.UPSTASH_REDIS_REST_URL;
    if (origToken) process.env.UPSTASH_REDIS_REST_TOKEN = origToken;
    else delete process.env.UPSTASH_REDIS_REST_TOKEN;
    _resetForTesting();
    console.error = origErr;
  });

  it('returns {ok: true} when limiter allows the request', async () => {
    mocks.behavior = 'success';
    const r = await applyLimit({ name: 'test', limit: 10, window: '1 m' }, '1.1.1.1');
    expect(r).not.toBeNull();
    expect(r!.ok).toBe(true);
    expect(r!.remaining).toBe(9);
  });

  it('returns {ok: false} when limiter blocks the request', async () => {
    mocks.behavior = 'blocked';
    const r = await applyLimit({ name: 'test', limit: 10, window: '1 m' }, '1.1.1.1');
    expect(r).not.toBeNull();
    expect(r!.ok).toBe(false);
    expect(r!.remaining).toBe(0);
  });

  it('fails open (returns null) when limiter.limit() throws', async () => {
    mocks.behavior = 'throw';
    const r = await applyLimit({ name: 'test', limit: 10, window: '1 m' }, '1.1.1.1');
    expect(r).toBeNull();
  });

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
