import Fastify from 'fastify';
import cors from '@fastify/cors';
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

const PORT = Number(process.env.PORT) || 3001;
const MODEL = process.env.KAMI_MODEL || 'anthropic/claude-sonnet-4.6';
const MAX_STEPS = Number(process.env.KAMI_MAX_STEPS) || 5;

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'production' ? undefined : {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss' },
    },
  },
});

await fastify.register(cors, { origin: true });

interface ChatBody {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  walletAddress: string | null;
}

function buildTools(ctx: ToolContext, log: typeof fastify.log) {
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

fastify.post<{ Body: ChatBody }>('/api/chat', async (request, reply) => {
  const apiKey = process.env.KAMI_OPENROUTER_API_KEY;
  if (!apiKey) {
    return reply.code(500).send({ error: 'KAMI_OPENROUTER_API_KEY not configured' });
  }

  const { messages, walletAddress } = request.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return reply.code(400).send({ error: 'messages array is required' });
  }

  const openrouter = createOpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
  });

  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const writeEvent = (payload: Record<string, unknown>) => {
    reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    const walletContext = walletAddress
      ? `\n\nThe user has connected wallet: ${walletAddress}`
      : '\n\nNo wallet connected yet.';

    const ctx: ToolContext = { walletAddress: walletAddress ?? null };
    const tools = buildTools(ctx, fastify.log);

    const result = streamText({
      model: openrouter.chat(MODEL),
      system: SYSTEM_PROMPT + walletContext,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      tools,
      stopWhen: stepCountIs(MAX_STEPS),
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

    reply.raw.write('data: [DONE]\n\n');
    reply.raw.end();
  } catch (err) {
    fastify.log.error({ err }, 'chat stream error');
    const message = err instanceof Error ? err.message : 'Unknown error';
    writeEvent({ error: message });
    reply.raw.end();
  }
});

fastify.get('/healthz', async () => ({ ok: true, model: MODEL }));

try {
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  fastify.log.info(`Kami server ready on :${PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
