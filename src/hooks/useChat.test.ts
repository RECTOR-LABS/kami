import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { formatChatError, mapToolResultStatus, useChat } from './useChat';

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

  it('falls back to generic message when 5xx body.error is HTML or too long', () => {
    expect(formatChatError(502, { error: '<!DOCTYPE html><html><body>Bad Gateway</body></html>' }))
      .toBe('Server error — HTTP 502.');
    const longString = 'x'.repeat(201);
    expect(formatChatError(502, { error: longString }))
      .toBe('Server error — HTTP 502.');
    // Sanity: short string still surfaces directly
    expect(formatChatError(500, { error: 'KAMI_OPENROUTER_API_KEY not configured' }))
      .toBe('Server error — KAMI_OPENROUTER_API_KEY not configured.');
  });
});

describe('useChat abort behavior', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('aborts in-flight stream when newConversation is called (switchConversation path)', async () => {
    let capturedSignal: AbortSignal | undefined;
    global.fetch = vi.fn((_url: unknown, init: unknown) => {
      capturedSignal = (init as RequestInit | undefined)?.signal ?? undefined;
      return new Promise(() => {}); // never resolves — keeps stream open
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useChat());

    await act(async () => {
      result.current.sendMessage('hello');
    });

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(capturedSignal?.aborted).toBe(false);

    act(() => {
      result.current.newConversation();
    });

    expect(capturedSignal?.aborted).toBe(true);
  });

  it('aborts in-flight stream when deleteConversation is called on the active conversation', async () => {
    let capturedSignal: AbortSignal | undefined;
    global.fetch = vi.fn((_url: unknown, init: unknown) => {
      capturedSignal = (init as RequestInit | undefined)?.signal ?? undefined;
      return new Promise(() => {});
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useChat());
    const activeId = result.current.activeId;

    await act(async () => {
      result.current.sendMessage('hello');
    });
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    act(() => {
      result.current.deleteConversation(activeId);
    });

    expect(capturedSignal?.aborted).toBe(true);
  });

  it('does not abort in-flight stream when deleteConversation deletes a non-active conversation', async () => {
    const conv1 = { id: 'c1', title: 'one', messages: [], createdAt: 1, updatedAt: 1 };
    const conv2 = { id: 'c2', title: 'two', messages: [], createdAt: 2, updatedAt: 2 };
    localStorage.setItem('kami_conversations', JSON.stringify([conv1, conv2]));
    localStorage.setItem('kami_active_conversation', 'c2');

    let capturedSignal: AbortSignal | undefined;
    global.fetch = vi.fn((_url: unknown, init: unknown) => {
      capturedSignal = (init as RequestInit | undefined)?.signal ?? undefined;
      return new Promise(() => {});
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useChat());
    expect(result.current.activeId).toBe('c2');

    await act(async () => {
      result.current.sendMessage('hello');
    });
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    act(() => {
      result.current.deleteConversation('c1');
    });

    expect(capturedSignal?.aborted).toBe(false);
  });
});

describe('useChat 4xx error rendering integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs formatChatError on a 4xx response and renders the formatted message in the assistant bubble', async () => {
    global.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({ error: 'Too many requests', retryAfterSeconds: 12 }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage('hi');
    });

    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    const assistantMsg = result.current.activeConversation.messages.find((m) => m.role === 'assistant');
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg!.content).toBe('Rate limited — try again in 12s.');
  });
});

describe('useChat clearAllConversations', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('replaces all conversations with one fresh empty conversation', () => {
    const conv1 = { id: 'c1', title: 'one', messages: [], createdAt: 1, updatedAt: 1 };
    const conv2 = { id: 'c2', title: 'two', messages: [], createdAt: 2, updatedAt: 2 };
    const conv3 = { id: 'c3', title: 'three', messages: [], createdAt: 3, updatedAt: 3 };
    localStorage.setItem('kami_conversations', JSON.stringify([conv1, conv2, conv3]));
    localStorage.setItem('kami_active_conversation', 'c2');

    const { result } = renderHook(() => useChat());
    expect(result.current.conversations.length).toBe(3);

    act(() => {
      result.current.clearAllConversations();
    });

    expect(result.current.conversations.length).toBe(1);
    expect(result.current.conversations[0].id).not.toBe('c1');
    expect(result.current.conversations[0].id).not.toBe('c2');
    expect(result.current.conversations[0].id).not.toBe('c3');
    expect(result.current.conversations[0].messages.length).toBe(0);
    expect(result.current.activeId).toBe(result.current.conversations[0].id);
  });

  it('aborts in-flight stream when clearAllConversations is called', async () => {
    let capturedSignal: AbortSignal | undefined;
    global.fetch = vi.fn((_url: unknown, init: unknown) => {
      capturedSignal = (init as RequestInit | undefined)?.signal ?? undefined;
      return new Promise(() => {});
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useChat());

    await act(async () => {
      result.current.sendMessage('hello');
    });
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(capturedSignal?.aborted).toBe(false);

    act(() => {
      result.current.clearAllConversations();
    });

    expect(capturedSignal?.aborted).toBe(true);
  });
});

describe('useChat renameConversation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('updates the title for the matching conversation id', () => {
    const conv1 = { id: 'c1', title: 'old title', messages: [], createdAt: 1, updatedAt: 1 };
    const conv2 = { id: 'c2', title: 'untouched', messages: [], createdAt: 2, updatedAt: 2 };
    localStorage.setItem('kami_conversations', JSON.stringify([conv1, conv2]));
    localStorage.setItem('kami_active_conversation', 'c1');

    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.renameConversation('c1', 'fresh title');
    });

    const c1 = result.current.conversations.find((c) => c.id === 'c1');
    const c2 = result.current.conversations.find((c) => c.id === 'c2');
    expect(c1?.title).toBe('fresh title');
    expect(c2?.title).toBe('untouched');
  });

  it('rejects empty or whitespace-only titles as a silent no-op', () => {
    const conv1 = { id: 'c1', title: 'keep this', messages: [], createdAt: 1, updatedAt: 1 };
    localStorage.setItem('kami_conversations', JSON.stringify([conv1]));
    localStorage.setItem('kami_active_conversation', 'c1');

    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.renameConversation('c1', '   ');
    });

    expect(result.current.conversations[0].title).toBe('keep this');

    act(() => {
      result.current.renameConversation('c1', '');
    });

    expect(result.current.conversations[0].title).toBe('keep this');
  });
});
