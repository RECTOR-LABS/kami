import { describe, it, expect } from 'vitest';

// Pure helper extracted from useChat's toolResult handler logic.
// Imported here so we can test the mapping without the full streaming machinery.
import { formatChatError, mapToolResultStatus } from './useChat';

describe('mapToolResultStatus', () => {
  it('returns "wallet-required" when output.code is WALLET_NOT_CONNECTED', () => {
    expect(mapToolResultStatus({ ok: false, error: 'x', code: 'WALLET_NOT_CONNECTED' }))
      .toBe('wallet-required');
  });

  it('returns "wallet-required" when output.code is INVALID_WALLET', () => {
    expect(mapToolResultStatus({ ok: false, error: 'x', code: 'INVALID_WALLET' }))
      .toBe('wallet-required');
  });

  it('returns "error" when output.ok is false without a code', () => {
    expect(mapToolResultStatus({ ok: false, error: 'rpc died' }))
      .toBe('error');
  });

  it('returns "error" when output.ok is false with a non-wallet code', () => {
    expect(mapToolResultStatus({ ok: false, error: 'x', code: 'STALE_ORACLE' }))
      .toBe('error');
  });

  it('returns "done" when output.ok is true', () => {
    expect(mapToolResultStatus({ ok: true, data: { foo: 1 } }))
      .toBe('done');
  });
});

describe('formatChatError', () => {
  it('returns "Rate limited — try again in {N}s." for 429 with retryAfterSeconds', () => {
    expect(formatChatError(429, { error: 'Too many requests', retryAfterSeconds: 12 }))
      .toBe('Rate limited — try again in 12s.');
  });

  it('returns generic rate-limit message for 429 without retryAfterSeconds', () => {
    expect(formatChatError(429, { error: 'Too many requests' }))
      .toBe('Rate limited — please slow down and try again shortly.');
  });

  it('returns "Message too large…" for 413', () => {
    expect(formatChatError(413, { error: 'Body exceeds 262144 bytes' }))
      .toBe('Message too large — try shortening or starting a new conversation.');
  });

  it('extracts first issue message for 400 zod validation', () => {
    expect(
      formatChatError(400, {
        error: 'Invalid request body',
        issues: [{ path: 'messages', message: 'messages array is required' }],
      })
    ).toBe('Invalid request: messages array is required.');
  });

  it('returns refresh-and-retry hint for 400 with "Invalid JSON body"', () => {
    expect(formatChatError(400, { error: 'Invalid JSON body' }))
      .toBe('Request format error — please refresh and try again.');
  });

  it('returns generic 400 fallback when shape is unknown', () => {
    expect(formatChatError(400, { error: 'unexpected' }))
      .toBe('Invalid request — please check your message format.');
  });

  it('returns "Server error — HTTP {status}." for unknown status without body.error', () => {
    expect(formatChatError(502, undefined))
      .toBe('Server error — HTTP 502.');
  });
});
