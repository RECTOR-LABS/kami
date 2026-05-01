import { streamText, stepCountIs, tool } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { SYSTEM_PROMPT } from './prompt.js';
import {
  getPortfolio,
  findYield,
  simulateHealth,
  buildDeposit,
  buildBorrow,
  buildWithdraw,
  buildRepay,
} from './tools/kamino.js';
import type { ToolContext } from './tools/types.js';
import { createLogger } from './log.js';

// H1: Patterns that indicate the LLM is claiming a transaction was built
// when it wasn't. Conservative — only triggers on high-confidence phrases
// that actually appeared in Day 23 hallucination cases.
const HALLUCINATION_PATTERNS: ReadonlyArray<RegExp> = [
  /sign\s*&\s*send\s+card\s+should\s+(now\s+)?appear/i,
  /sign\s*&\s*send\s+card\s+should\s+already\s+be\s+visible/i,
  /transaction\s+is\s+ready/i,
  /your\s+(repay|deposit|borrow|withdraw)\s+transaction\s+is\s+ready/i,
];

interface ToolEventSummary {
  type: string;
  toolName?: string;
  isError?: boolean;
}

/**
 * H1: Detects when the LLM has claimed a transaction was built but no
 * successful build* tool-result event preceded the claim in this turn.
 *
 * Returns true → caller should append a system footnote to the response
 * informing the user no tx was built. Append-only, never blocks the response.
 */
export function detectHallucinatedTxClaim(
  fullText: string,
  toolEvents: ReadonlyArray<ToolEventSummary>
): boolean {
  const matched = HALLUCINATION_PATTERNS.some((p) => p.test(fullText));
  if (!matched) return false;
  const lastBuildResult = [...toolEvents].reverse().find(
    (e) => e.type === 'tool-result' && e.toolName?.startsWith('build') && !e.isError
  );
  return !lastBuildResult;
}

export interface ChatInput {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  walletAddress: string | null;
}

export interface ChatLogger {
  info: (obj: Record<string, unknown>, msg: string) => void;
  error: (obj: Record<string, unknown>, msg: string) => void;
}

const defaultLogger = createLogger();

function buildTools(ctx: ToolContext, log: ChatLogger) {
  const trace = (name: string, ok: boolean) => log.info({ tool: name, ok }, 'tool:result');
  const start = (name: string, input: unknown) =>
    log.info({ tool: name, wallet: ctx.walletAddress, input }, 'tool:invoke');

  return {
    getPortfolio: tool({
      description: getPortfolio.description,
      inputSchema: getPortfolio.schema,
      execute: async (input) => {
        start('getPortfolio', input);
        const r = await getPortfolio.handler(input, ctx);
        trace('getPortfolio', r.ok);
        return r;
      },
    }),
    findYield: tool({
      description: findYield.description,
      inputSchema: findYield.schema,
      execute: async (input) => {
        start('findYield', input);
        const r = await findYield.handler(input, ctx);
        trace('findYield', r.ok);
        return r;
      },
    }),
    simulateHealth: tool({
      description: simulateHealth.description,
      inputSchema: simulateHealth.schema,
      execute: async (input) => {
        start('simulateHealth', input);
        const r = await simulateHealth.handler(input, ctx);
        trace('simulateHealth', r.ok);
        return r;
      },
    }),
    buildDeposit: tool({
      description: buildDeposit.description,
      inputSchema: buildDeposit.schema,
      execute: async (input) => {
        start('buildDeposit', input);
        const r = await buildDeposit.handler(input, ctx);
        trace('buildDeposit', r.ok);
        return r;
      },
    }),
    buildBorrow: tool({
      description: buildBorrow.description,
      inputSchema: buildBorrow.schema,
      execute: async (input) => {
        start('buildBorrow', input);
        const r = await buildBorrow.handler(input, ctx);
        trace('buildBorrow', r.ok);
        return r;
      },
    }),
    buildWithdraw: tool({
      description: buildWithdraw.description,
      inputSchema: buildWithdraw.schema,
      execute: async (input) => {
        start('buildWithdraw', input);
        const r = await buildWithdraw.handler(input, ctx);
        trace('buildWithdraw', r.ok);
        return r;
      },
    }),
    buildRepay: tool({
      description: buildRepay.description,
      inputSchema: buildRepay.schema,
      execute: async (input) => {
        start('buildRepay', input);
        const r = await buildRepay.handler(input, ctx);
        trace('buildRepay', r.ok);
        return r;
      },
    }),
  };
}

export function createChatStream(
  input: ChatInput,
  apiKey: string,
  log: ChatLogger = defaultLogger,
  signal?: AbortSignal,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const model = process.env.KAMI_MODEL || 'anthropic/claude-sonnet-4.6';
  const maxSteps = Number(process.env.KAMI_MAX_STEPS) || 5;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const writeEvent = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      try {
        const openrouter = createOpenAI({
          apiKey,
          baseURL: 'https://openrouter.ai/api/v1',
        });

        const walletContext = input.walletAddress
          ? `\n\nThe user has connected wallet: ${input.walletAddress}`
          : '\n\nNo wallet connected yet.';

        const ctx: ToolContext = { walletAddress: input.walletAddress ?? null };
        const tools = buildTools(ctx, log);

        const result = streamText({
          model: openrouter.chat(model),
          system: SYSTEM_PROMPT + walletContext,
          messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
          tools,
          stopWhen: stepCountIs(maxSteps),
          abortSignal: signal,
        });

        let fullAssistantText = '';
        const toolEvents: ToolEventSummary[] = [];

        for await (const part of result.fullStream) {
          switch (part.type) {
            case 'text-delta':
              fullAssistantText += part.text;
              writeEvent({ text: part.text });
              break;
            case 'tool-call':
              toolEvents.push({ type: 'tool-call', toolName: part.toolName });
              writeEvent({
                toolCall: { id: part.toolCallId, name: part.toolName, input: part.input },
              });
              break;
            case 'tool-result': {
              const isError = Boolean(
                part.output && typeof part.output === 'object' && 'ok' in part.output && (part.output as { ok: boolean }).ok === false
              );
              toolEvents.push({ type: 'tool-result', toolName: part.toolName, isError });
              writeEvent({
                toolResult: { id: part.toolCallId, name: part.toolName, output: part.output },
              });
              break;
            }
            case 'tool-error':
              toolEvents.push({ type: 'tool-error', toolName: part.toolName, isError: true });
              writeEvent({
                toolError: {
                  id: part.toolCallId,
                  name: part.toolName,
                  error: part.error instanceof Error ? part.error.message : String(part.error),
                },
              });
              break;
            case 'error': {
              const message = part.error instanceof Error ? part.error.message : String(part.error);
              writeEvent({ error: message });
              break;
            }
          }
        }

        // H1: Post-stream hallucination guard. Append-only footnote, never blocks.
        if (detectHallucinatedTxClaim(fullAssistantText, toolEvents)) {
          const footnote =
            '\n\n---\n*⚠️ System note: a transaction was NOT actually built. Please rephrase your request and try again.*';
          writeEvent({ text: footnote });
          log.info(
            {
              matchedPattern: HALLUCINATION_PATTERNS.find((p) => p.test(fullAssistantText))?.toString(),
              toolCallCount: toolEvents.filter((e) => e.type === 'tool-call').length,
            },
            'hallucination_guard_triggered'
          );
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (err) {
        const aborted =
          signal?.aborted || (err instanceof Error && err.name === 'AbortError');
        if (!aborted) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          log.error({ err: message }, 'chat stream error');
          writeEvent({ error: message });
        }
      } finally {
        controller.close();
      }
    },
  });
}
