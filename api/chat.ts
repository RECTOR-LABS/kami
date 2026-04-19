import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { createChatStream } from '../server/chat.js';

export const config = {
  maxDuration: 60,
};

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return null;
  return JSON.parse(Buffer.concat(chunks).toString('utf-8'));
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.KAMI_OPENROUTER_API_KEY;
  if (!apiKey) {
    sendJson(res, 500, { error: 'KAMI_OPENROUTER_API_KEY not configured' });
    return;
  }

  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' });
    return;
  }

  if (typeof body !== 'object' || body === null) {
    sendJson(res, 400, { error: 'Invalid body shape' });
    return;
  }

  const { messages, walletAddress } = body as {
    messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
    walletAddress?: string | null;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    sendJson(res, 400, { error: 'messages array is required' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const webStream = createChatStream(
    { messages, walletAddress: walletAddress ?? null },
    apiKey
  );

  const nodeStream = Readable.fromWeb(
    webStream as unknown as Parameters<typeof Readable.fromWeb>[0]
  );

  await new Promise<void>((resolve, reject) => {
    nodeStream.on('end', resolve);
    nodeStream.on('error', reject);
    nodeStream.pipe(res);
  });
}
