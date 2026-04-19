import Fastify from 'fastify';
import cors from '@fastify/cors';
import { streamText } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { SYSTEM_PROMPT } from './prompt.js';

const PORT = Number(process.env.PORT) || 3001;
const MODEL = process.env.KAMI_MODEL || 'anthropic/claude-sonnet-4.6';

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

fastify.post<{ Body: ChatBody }>('/api/chat', async (request, reply) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return reply.code(500).send({ error: 'OPENROUTER_API_KEY not configured' });
  }

  const { messages, walletAddress } = request.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return reply.code(400).send({ error: 'messages array is required' });
  }

  const openrouter = createOpenRouter({ apiKey });

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

    const result = streamText({
      model: openrouter(MODEL),
      system: SYSTEM_PROMPT + walletContext,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    for await (const chunk of result.textStream) {
      writeEvent({ text: chunk });
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
