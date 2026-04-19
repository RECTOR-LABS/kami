import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Readable } from 'node:stream';
import { createChatStream, type ChatInput } from './chat.js';

const PORT = Number(process.env.PORT) || 3001;

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

fastify.post<{ Body: ChatInput }>('/api/chat', async (request, reply) => {
  const apiKey = process.env.KAMI_OPENROUTER_API_KEY;
  if (!apiKey) {
    return reply.code(500).send({ error: 'KAMI_OPENROUTER_API_KEY not configured' });
  }

  const { messages, walletAddress } = request.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return reply.code(400).send({ error: 'messages array is required' });
  }

  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const stream = createChatStream({ messages, walletAddress }, apiKey, fastify.log);
  const nodeStream = Readable.fromWeb(stream as unknown as Parameters<typeof Readable.fromWeb>[0]);
  nodeStream.pipe(reply.raw);
  await new Promise<void>((resolve) => nodeStream.once('end', () => resolve()));
});

fastify.get('/healthz', async () => ({
  ok: true,
  model: process.env.KAMI_MODEL || 'anthropic/claude-sonnet-4.6',
}));

try {
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  fastify.log.info(`Kami server ready on :${PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
