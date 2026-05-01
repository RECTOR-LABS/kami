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

import { createChatStream, detectHallucinatedTxClaim, type ChatLogger } from './chat';

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

describe('detectHallucinatedTxClaim (H1 / Cluster H)', () => {
  const buildResultEvent = (toolName: string, isError = false) => ({
    type: 'tool-result',
    toolName,
    isError,
  });

  it('returns true when "Sign & Send card should appear" appears with no build* tool-result', () => {
    const text = 'Got it! A Sign & Send card should now appear in your UI.';
    const events = [
      { type: 'tool-call', toolName: 'getPortfolio' },
      buildResultEvent('getPortfolio'),
    ];
    expect(detectHallucinatedTxClaim(text, events)).toBe(true);
  });

  it('returns false when "transaction is ready" appears AFTER a successful buildDeposit', () => {
    const text = 'Your deposit transaction is ready! Click Sign.';
    const events = [
      { type: 'tool-call', toolName: 'buildDeposit' },
      buildResultEvent('buildDeposit', false),
    ];
    expect(detectHallucinatedTxClaim(text, events)).toBe(false);
  });

  it('returns true when "your repay transaction is ready" appears AFTER a FAILED buildRepay', () => {
    const text = 'Your repay transaction is ready! 🎉';
    const events = [
      { type: 'tool-call', toolName: 'buildRepay' },
      buildResultEvent('buildRepay', true),
    ];
    expect(detectHallucinatedTxClaim(text, events)).toBe(true);
  });

  it('returns false for benign text without hallucination phrases', () => {
    const text = "Here's your portfolio. You have $5 USDC deposited.";
    const events = [buildResultEvent('getPortfolio')];
    expect(detectHallucinatedTxClaim(text, events)).toBe(false);
  });

  it('matches case-insensitively across whitespace variations', () => {
    const text = 'A SIGN  &  SEND CARD SHOULD now appear in your UI.';
    expect(detectHallucinatedTxClaim(text, [])).toBe(true);
  });

  it('returns false when "Sign & Send card already visible" appears AFTER successful build*', () => {
    const text = 'A Sign & Send card should already be visible.';
    const events = [buildResultEvent('buildBorrow')];
    expect(detectHallucinatedTxClaim(text, events)).toBe(false);
  });
});
