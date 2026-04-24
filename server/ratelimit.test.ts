import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { IncomingMessage } from 'node:http';
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

  it('returns "anonymous" when no IP headers are present', () => {
    expect(identify(mockReq({}))).toBe('anonymous');
  });

  it('handles array values for x-forwarded-for', () => {
    const req = mockReq({ 'x-forwarded-for': ['203.0.113.1', '10.0.0.2'] });
    expect(identify(req)).toBe('203.0.113.1');
  });

  it('trims whitespace from header values', () => {
    const req = mockReq({ 'x-forwarded-for': '  203.0.113.1  ,  10.0.0.2  ' });
    expect(identify(req)).toBe('203.0.113.1');
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
