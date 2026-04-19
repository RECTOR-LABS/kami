import { createChatStream } from '../server/chat.js';

export const config = {
  maxDuration: 60,
};

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonError(405, 'Method not allowed');
  }

  const apiKey = process.env.KAMI_OPENROUTER_API_KEY;
  if (!apiKey) {
    return jsonError(500, 'KAMI_OPENROUTER_API_KEY not configured');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'Invalid JSON body');
  }

  if (typeof body !== 'object' || body === null) {
    return jsonError(400, 'Invalid body shape');
  }

  const { messages, walletAddress } = body as {
    messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
    walletAddress?: string | null;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonError(400, 'messages array is required');
  }

  const stream = createChatStream(
    { messages, walletAddress: walletAddress ?? null },
    apiKey
  );

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
