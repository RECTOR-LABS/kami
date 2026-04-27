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

export interface ChatInput {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  walletAddress: string | null;
}

export interface ChatLogger {
  info: (obj: Record<string, unknown>, msg: string) => void;
  error: (obj: Record<string, unknown>, msg: string) => void;
}

const consoleLogger: ChatLogger = {
  info: (obj, msg) => console.log(msg, obj),
  error: (obj, msg) => console.error(msg, obj),
};

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
  log: ChatLogger = consoleLogger,
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

        for await (const part of result.fullStream) {
          switch (part.type) {
            case 'text-delta':
              writeEvent({ text: part.text });
              break;
            case 'tool-call':
              writeEvent({
                toolCall: { id: part.toolCallId, name: part.toolName, input: part.input },
              });
              break;
            case 'tool-result':
              writeEvent({
                toolResult: { id: part.toolCallId, name: part.toolName, output: part.output },
              });
              break;
            case 'tool-error':
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
