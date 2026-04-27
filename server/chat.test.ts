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
