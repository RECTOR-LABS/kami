import { useState, useCallback, useRef } from 'react';
import type { ChatMessage, Conversation, PendingTransaction, ToolCallRecord } from '../types';

const BUILD_TOOL_NAMES = new Set(['buildDeposit', 'buildBorrow', 'buildWithdraw', 'buildRepay']);

type ToolStreamOutput =
  | { ok: true; data?: unknown }
  | { ok: false; error?: string; code?: string };

export function mapToolResultStatus(output: ToolStreamOutput | undefined): 'done' | 'error' | 'wallet-required' {
  if (!output) return 'done';
  if (output.ok === true) return 'done';
  if (output.code === 'WALLET_NOT_CONNECTED' || output.code === 'INVALID_WALLET') {
    return 'wallet-required';
  }
  return 'error';
}

export function formatChatError(status: number, body: unknown): string {
  const obj = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};

  if (status === 429) {
    const retry = typeof obj.retryAfterSeconds === 'number' ? obj.retryAfterSeconds : null;
    return retry !== null
      ? `Rate limited — try again in ${retry}s.`
      : 'Rate limited — please slow down and try again shortly.';
  }

  if (status === 413) {
    return 'Message too large — try shortening or starting a new conversation.';
  }

  if (status === 400) {
    if (Array.isArray(obj.issues) && obj.issues.length > 0) {
      const first = obj.issues[0] as { message?: string };
      const message = typeof first?.message === 'string' ? first.message : 'request format invalid';
      return `Invalid request: ${message}.`;
    }
    if (typeof obj.error === 'string' && obj.error === 'Invalid JSON body') {
      return 'Request format error — please refresh and try again.';
    }
    return 'Invalid request — please check your message format.';
  }

  const errString = typeof obj.error === 'string' ? obj.error : null;
  const isHtmlOrLong = errString !== null && (errString.startsWith('<') || errString.length > 200);
  const fallback = errString !== null && !isHtmlOrLong ? errString : `HTTP ${status}`;
  return `Server error — ${fallback}.`;
}
import {
  loadConversations,
  saveConversations,
  createConversation,
  getActiveConversationId,
  setActiveConversationId,
} from '../lib/storage';

export function useChat() {
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const loaded = loadConversations();
    if (loaded.length === 0) {
      const first = createConversation('Welcome');
      saveConversations([first]);
      setActiveConversationId(first.id);
      return [first];
    }
    return loaded;
  });

  const [activeId, setActiveId] = useState<string>(() => {
    const stored = getActiveConversationId();
    if (stored && conversations.find((c) => c.id === stored)) return stored;
    return conversations[0]?.id || '';
  });

  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const activeConversation = conversations.find((c) => c.id === activeId) || conversations[0];

  const persist = useCallback((updated: Conversation[]) => {
    setConversations(updated);
    saveConversations(updated);
  }, []);

  const switchConversation = useCallback((id: string) => {
    abortRef.current?.abort();
    setActiveId(id);
    setActiveConversationId(id);
  }, []);

  const newConversation = useCallback(() => {
    const conv = createConversation();
    const updated = [conv, ...conversations];
    persist(updated);
    switchConversation(conv.id);
    return conv.id;
  }, [conversations, persist, switchConversation]);

  const deleteConversation = useCallback(
    (id: string) => {
      if (id === activeId) {
        abortRef.current?.abort();
      }
      const remaining = conversations.filter((c) => c.id !== id);
      if (remaining.length === 0) {
        const fresh = createConversation();
        persist([fresh]);
        switchConversation(fresh.id);
      } else {
        persist(remaining);
        if (activeId === id) {
          switchConversation(remaining[0].id);
        }
      }
    },
    [conversations, activeId, persist, switchConversation]
  );

  const clearAllConversations = useCallback(() => {
    abortRef.current?.abort();
    const fresh = createConversation();
    persist([fresh]);
    switchConversation(fresh.id);
  }, [persist, switchConversation]);

  const sendMessage = useCallback(
    async (content: string, walletAddress?: string | null) => {
      if (!content.trim() || isStreaming) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: content.trim(),
        timestamp: Date.now(),
      };

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };

      let current = conversations.map((c) =>
        c.id === activeId
          ? {
              ...c,
              messages: [...c.messages, userMsg, assistantMsg],
              updatedAt: Date.now(),
              title:
                c.messages.length === 0
                  ? content.trim().slice(0, 40) + (content.trim().length > 40 ? '...' : '')
                  : c.title,
            }
          : c
      );
      persist(current);

      setIsStreaming(true);
      abortRef.current = new AbortController();

      try {
        const conv = current.find((c) => c.id === activeId)!;
        const historyMessages = conv.messages.slice(0, -1).map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

        const response = await fetch('api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: historyMessages,
            walletAddress: walletAddress || null,
          }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          const text = await response.text();
          let body: unknown;
          try {
            body = JSON.parse(text);
          } catch {
            body = { error: text };
          }
          throw new Error(formatChatError(response.status, body));
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response stream');

        const decoder = new TextDecoder();
        let accumulated = '';
        let pendingTransaction: PendingTransaction | null = null;
        const toolCalls = new Map<string, ToolCallRecord>();

        const commitToolCalls = (msgPatch: Partial<ChatMessage>) => {
          current = current.map((c) =>
            c.id === activeId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantMsg.id
                      ? {
                          ...m,
                          ...msgPatch,
                          toolCalls: Array.from(toolCalls.values()),
                          pendingTransaction,
                        }
                      : m
                  ),
                }
              : c
          );
          setConversations([...current]);
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') break;
              try {
                const parsed = JSON.parse(data);
                if (parsed.text) {
                  accumulated += parsed.text;
                  commitToolCalls({ content: accumulated });
                }
                if (parsed.toolCall) {
                  toolCalls.set(parsed.toolCall.id, {
                    id: parsed.toolCall.id,
                    name: parsed.toolCall.name,
                    status: 'calling',
                  });
                  commitToolCalls({ content: accumulated });
                }
                if (parsed.toolResult) {
                  const existing = toolCalls.get(parsed.toolResult.id);
                  const output = parsed.toolResult.output;
                  toolCalls.set(parsed.toolResult.id, {
                    id: parsed.toolResult.id,
                    name: parsed.toolResult.name,
                    status: mapToolResultStatus(output),
                    error: output?.ok === false ? output.error : existing?.error,
                    code: output?.ok === false ? output.code : existing?.code,
                  });
                  if (
                    BUILD_TOOL_NAMES.has(parsed.toolResult.name) &&
                    output?.ok === true &&
                    output.data?.base64Txn
                  ) {
                    pendingTransaction = { ...output.data, status: 'pending' } as PendingTransaction;
                  }
                  commitToolCalls({ content: accumulated });
                }
                if (parsed.toolError) {
                  toolCalls.set(parsed.toolError.id, {
                    id: parsed.toolError.id,
                    name: parsed.toolError.name,
                    status: 'error',
                    error: parsed.toolError.error,
                  });
                  commitToolCalls({ content: accumulated });
                }
                if (parsed.error) {
                  throw new Error(parsed.error);
                }
              } catch (e) {
                if (e instanceof SyntaxError) continue;
                throw e;
              }
            }
          }
        }

        saveConversations(current);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        const errorContent = err instanceof Error ? err.message : 'Unknown error.';
        current = current.map((c) =>
          c.id === activeId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === assistantMsg.id ? { ...m, content: errorContent } : m
                ),
              }
            : c
        );
        persist(current);
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [conversations, activeId, isStreaming, persist]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return {
    conversations,
    activeConversation,
    activeId,
    isStreaming,
    sendMessage,
    stopStreaming,
    newConversation,
    switchConversation,
    deleteConversation,
    clearAllConversations,
  };
}
