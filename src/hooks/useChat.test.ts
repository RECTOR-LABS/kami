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

describe('useChat sendMessage streaming', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function streamResponse(chunks: string[]): Response {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });
    return new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  it('accumulates text-delta chunks into the assistant message content', async () => {
    global.fetch = vi.fn(async () =>
      streamResponse([
        'data: {"text":"Hello"}\n',
        'data: {"text":", "}\n',
        'data: {"text":"world."}\n',
        'data: [DONE]\n',
      ])
    ) as unknown as typeof fetch;

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage('hi');
    });

    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    const assistantMsg = result.current.activeConversation.messages.find((m) => m.role === 'assistant');
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg!.content).toBe('Hello, world.');
  });

  it('threads toolCall + toolResult chunks into messages[last].toolCalls', async () => {
    global.fetch = vi.fn(async () =>
      streamResponse([
        'data: {"toolCall":{"id":"tc-1","name":"getPortfolio"}}\n',
        'data: {"toolResult":{"id":"tc-1","name":"getPortfolio","output":{"ok":true,"data":{"positions":[]}}}}\n',
        'data: {"text":"You have no positions."}\n',
        'data: [DONE]\n',
      ])
    ) as unknown as typeof fetch;

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage('show me my portfolio');
    });

    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    const assistantMsg = result.current.activeConversation.messages.find((m) => m.role === 'assistant');
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg!.toolCalls).toHaveLength(1);
    expect(assistantMsg!.toolCalls![0].id).toBe('tc-1');
    expect(assistantMsg!.toolCalls![0].name).toBe('getPortfolio');
    expect(assistantMsg!.toolCalls![0].status).toBe('done');
    expect(assistantMsg!.content).toBe('You have no positions.');
  });

  it('marks toolCalls as error when a toolError chunk arrives', async () => {
    global.fetch = vi.fn(async () =>
      streamResponse([
        'data: {"toolCall":{"id":"tc-1","name":"buildDeposit"}}\n',
        'data: {"toolError":{"id":"tc-1","name":"buildDeposit","error":"insufficient balance"}}\n',
        'data: [DONE]\n',
      ])
    ) as unknown as typeof fetch;

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage('deposit 5 USDC');
    });

    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    const assistantMsg = result.current.activeConversation.messages.find((m) => m.role === 'assistant');
    expect(assistantMsg!.toolCalls).toHaveLength(1);
    expect(assistantMsg!.toolCalls![0].status).toBe('error');
    expect(assistantMsg!.toolCalls![0].error).toBe('insufficient balance');
  });

  it('aborts the in-flight stream when stopStreaming is called', async () => {
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
      result.current.stopStreaming();
    });

    expect(capturedSignal?.aborted).toBe(true);
    expect(result.current.isStreaming).toBe(false);
  });
});

describe('useChat updatePendingTransaction', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function seedConversationsWithPendingTx() {
    const conv = {
      id: 'c1',
      title: 'deposit flow',
      messages: [
        { id: 'u1', role: 'user' as const, content: 'deposit 5 USDC', timestamp: 1 },
        {
          id: 'a1',
          role: 'assistant' as const,
          content: 'tx ready',
          timestamp: 2,
          pendingTransaction: {
            action: 'deposit' as const,
            protocol: 'Kamino' as const,
            symbol: 'USDC',
            amount: 5,
            reserveAddress: 'D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59',
            mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            summary: 'Deposit 5 USDC',
            base64Txn: 'AQAAAA==',
            blockhash: 'bh-1',
            lastValidBlockHeight: '300000000',
            status: 'pending' as const,
          },
        },
      ],
      createdAt: 1,
      updatedAt: 2,
    };
    localStorage.setItem('kami_conversations', JSON.stringify([conv]));
    localStorage.setItem('kami_active_conversation', 'c1');
  }

  it('patches the target message pendingTransaction with shallow merge', () => {
    seedConversationsWithPendingTx();
    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.updatePendingTransaction('a1', {
        status: 'submitted',
        signature: 'sig-abc',
      });
    });

    const msg = result.current.activeConversation.messages.find((m) => m.id === 'a1');
    expect(msg?.pendingTransaction?.status).toBe('submitted');
    expect(msg?.pendingTransaction?.signature).toBe('sig-abc');
    // Untouched fields preserved:
    expect(msg?.pendingTransaction?.base64Txn).toBe('AQAAAA==');
    expect(msg?.pendingTransaction?.amount).toBe(5);
  });

  it('persists the update to localStorage via saveConversations', () => {
    seedConversationsWithPendingTx();
    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.updatePendingTransaction('a1', { status: 'confirmed' });
    });

    const raw = localStorage.getItem('kami_conversations');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    const persistedMsg = parsed[0].messages.find((m: { id: string }) => m.id === 'a1');
    expect(persistedMsg.pendingTransaction.status).toBe('confirmed');
  });

  it('is a no-op when messageId is not found', () => {
    seedConversationsWithPendingTx();
    const { result } = renderHook(() => useChat());
    const before = JSON.stringify(result.current.conversations);

    act(() => {
      result.current.updatePendingTransaction('non-existent-id', {
        status: 'confirmed',
      });
    });

    const after = JSON.stringify(result.current.conversations);
    expect(after).toBe(before);
  });

  it('is a no-op when the message exists but has no pendingTransaction', () => {
    const conv = {
      id: 'c1',
      title: 'plain chat',
      messages: [
        { id: 'u1', role: 'user' as const, content: 'hi', timestamp: 1 },
        { id: 'a1', role: 'assistant' as const, content: 'hello', timestamp: 2 },
      ],
      createdAt: 1,
      updatedAt: 2,
    };
    localStorage.setItem('kami_conversations', JSON.stringify([conv]));
    localStorage.setItem('kami_active_conversation', 'c1');

    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.updatePendingTransaction('a1', { status: 'confirmed' });
    });

    const msg = result.current.activeConversation.messages.find((m) => m.id === 'a1');
    expect(msg?.pendingTransaction).toBeUndefined();
  });

  it('does not mutate other messages when patching one', () => {
    const conv = {
      id: 'c1',
      title: 'two txs',
      messages: [
        {
          id: 'a1',
          role: 'assistant' as const,
          content: 'tx1',
          timestamp: 1,
          pendingTransaction: {
            action: 'deposit' as const,
            protocol: 'Kamino' as const,
            symbol: 'USDC',
            amount: 1,
            reserveAddress: 'r1',
            mint: 'm1',
            summary: 's1',
            base64Txn: 'AAAA',
            blockhash: 'b1',
            lastValidBlockHeight: '100',
            status: 'pending' as const,
          },
        },
        {
          id: 'a2',
          role: 'assistant' as const,
          content: 'tx2',
          timestamp: 2,
          pendingTransaction: {
            action: 'borrow' as const,
            protocol: 'Kamino' as const,
            symbol: 'SOL',
            amount: 0.5,
            reserveAddress: 'r2',
            mint: 'm2',
            summary: 's2',
            base64Txn: 'BBBB',
            blockhash: 'b2',
            lastValidBlockHeight: '200',
            status: 'pending' as const,
          },
        },
      ],
      createdAt: 1,
      updatedAt: 2,
    };
    localStorage.setItem('kami_conversations', JSON.stringify([conv]));
    localStorage.setItem('kami_active_conversation', 'c1');

    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.updatePendingTransaction('a1', {
        status: 'confirmed',
        signature: 'sig-1',
      });
    });

    const msg1 = result.current.activeConversation.messages.find((m) => m.id === 'a1');
    const msg2 = result.current.activeConversation.messages.find((m) => m.id === 'a2');
    expect(msg1?.pendingTransaction?.status).toBe('confirmed');
    expect(msg1?.pendingTransaction?.signature).toBe('sig-1');
    expect(msg2?.pendingTransaction?.status).toBe('pending');
    expect(msg2?.pendingTransaction?.signature).toBeUndefined();
  });
});

describe('useChat updatePendingTransaction stability', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('updatePendingTransaction reference is stable across re-renders', () => {
    const { result } = renderHook(() => useChat());
    const ref1 = result.current.updatePendingTransaction;

    act(() => {
      result.current.newConversation();
    });

    const ref2 = result.current.updatePendingTransaction;
    expect(ref1).toBe(ref2);
  });

  it('a captured updatePendingTransaction reference reads latest conversations on call', () => {
    const conv = {
      id: 'c1',
      title: 'deposit',
      messages: [
        {
          id: 'a1',
          role: 'assistant' as const,
          content: 'tx',
          timestamp: 1,
          pendingTransaction: {
            action: 'deposit' as const,
            protocol: 'Kamino' as const,
            symbol: 'USDC',
            amount: 5,
            reserveAddress: 'r1',
            mint: 'm1',
            summary: 's1',
            base64Txn: 'AAAA',
            blockhash: 'b1',
            lastValidBlockHeight: '100',
            status: 'submitted' as const,
            signature: 'sig-1',
          },
        },
      ],
      createdAt: 1,
      updatedAt: 1,
    };
    localStorage.setItem('kami_conversations', JSON.stringify([conv]));
    localStorage.setItem('kami_active_conversation', 'c1');

    const { result } = renderHook(() => useChat());

    // Capture the mount-time reference (simulating what TxStatusCard's resume useEffect does).
    const capturedUpdate = result.current.updatePendingTransaction;

    // Now mutate state via a different code path — this would invalidate a stale-snapshot closure.
    act(() => {
      result.current.newConversation();
    });

    // Verify state change happened: 2 conversations now.
    expect(result.current.conversations.length).toBe(2);

    // Call the captured (mount-time) reference and patch the original message.
    act(() => {
      capturedUpdate('a1', { status: 'confirmed' });
    });

    // BOTH the new conversation AND the patched message must survive.
    expect(result.current.conversations.length).toBe(2); // new conversation NOT wiped
    const c1 = result.current.conversations.find((c) => c.id === 'c1');
    expect(c1?.messages[0].pendingTransaction?.status).toBe('confirmed');

    // localStorage agrees.
    const stored = JSON.parse(localStorage.getItem('kami_conversations')!);
    expect(stored.length).toBe(2);
    const storedC1 = stored.find((c: { id: string }) => c.id === 'c1');
    expect(storedC1.messages[0].pendingTransaction.status).toBe('confirmed');
  });
});
