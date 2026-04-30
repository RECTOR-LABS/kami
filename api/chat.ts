import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { z } from 'zod';
import { createChatStream } from '../server/chat.js';
import { applyLimit, identify, type LimitResult } from '../server/ratelimit.js';
import { createLogger } from '../server/log.js';

const CHAT_RATE_LIMIT = { name: 'chat', limit: 30, window: '1 m' as const };
const logger = createLogger();

export const config = {
  maxDuration: 60,
};

const MAX_BODY_BYTES = 256 * 1024;
const MAX_MESSAGES = 50;
const MAX_MESSAGE_CHARS = 8000;

const base58Re = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const chatBodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(MAX_MESSAGE_CHARS, `message exceeds ${MAX_MESSAGE_CHARS} chars`),
      }),
    )
    .min(1, 'messages array is required')
    .max(MAX_MESSAGES, `at most ${MAX_MESSAGES} messages per request`),
  walletAddress: z
    .union([z.string().regex(base58Re, 'walletAddress must be base58 32-44 chars'), z.null()])
    .optional(),
});

async function readBody(req: IncomingMessage): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > MAX_BODY_BYTES) return null;
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function setRateLimitHeaders(res: ServerResponse, r: LimitResult) {
  res.setHeader('X-RateLimit-Limit', String(r.limit));
  res.setHeader('X-RateLimit-Remaining', String(r.remaining));
  res.setHeader('X-RateLimit-Reset', String(r.reset));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.KAMI_OPENROUTER_API_KEY;
  if (!apiKey) {
    sendJson(res, 500, { error: 'KAMI_OPENROUTER_API_KEY not configured' });
    return;
  }

  const rate = await applyLimit(CHAT_RATE_LIMIT, identify(req));
  if (rate) {
    setRateLimitHeaders(res, rate);
    if (!rate.ok) {
      const retryAfter = Math.max(1, Math.ceil((rate.reset - Date.now()) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      sendJson(res, 429, {
        error: 'Too many requests',
        limit: rate.limit,
        remaining: rate.remaining,
        retryAfterSeconds: retryAfter,
      });
      return;
    }
  }

  const raw = await readBody(req);
  if (raw === null) {
    sendJson(res, 413, { error: `Body exceeds ${MAX_BODY_BYTES} bytes` });
    return;
  }

  let parsed: unknown;
  try {
    parsed = raw.length === 0 ? null : JSON.parse(raw.toString('utf-8'));
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' });
    return;
  }

  const validation = chatBodySchema.safeParse(parsed);
  if (!validation.success) {
    sendJson(res, 400, {
      error: 'Invalid request body',
      issues: validation.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
    return;
  }

  const { messages, walletAddress } = validation.data;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const controller = new AbortController();
  // Listen on res, not req: in Vercel's serverless runtime req.on('close') fires
  // after readBody() drains the body, which kills the LLM stream before any
  // tokens are produced. res.on('close') only fires when the response is
  // forcibly destroyed before res.end() — i.e., the client genuinely disconnected.
  res.on('close', () => {
    if (!res.writableEnded) {
      controller.abort();
      logger.info({ wallet: walletAddress ?? null }, 'chat:aborted');
    }
  });

  const webStream = createChatStream(
    { messages, walletAddress: walletAddress ?? null },
    apiKey,
    undefined,
    controller.signal,
  );

  const nodeStream = Readable.fromWeb(
    webStream as unknown as Parameters<typeof Readable.fromWeb>[0],
  );

  await new Promise<void>((resolve, reject) => {
    nodeStream.on('end', resolve);
    nodeStream.on('error', reject);
    nodeStream.pipe(res);
  });
}
