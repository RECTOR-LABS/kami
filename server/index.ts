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

fastify.post('/api/rpc', async (request, reply) => {
  const upstream = process.env.SOLANA_RPC_URL;
  if (!upstream) {
    return reply.code(500).send({ error: 'SOLANA_RPC_URL not configured' });
  }
  try {
    const upstreamRes = await fetch(upstream, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.body ?? {}),
    });
    const text = await upstreamRes.text();
    return reply
      .code(upstreamRes.status)
      .header('Content-Type', upstreamRes.headers.get('content-type') ?? 'application/json')
      .send(text);
  } catch (err) {
    return reply.code(502).send({
      error: 'Upstream RPC error',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
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
