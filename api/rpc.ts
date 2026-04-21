import type { IncomingMessage, ServerResponse } from 'node:http';

export const config = {
  maxDuration: 30,
};

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Allow', 'POST');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const upstream = process.env.SOLANA_RPC_URL;
  if (!upstream) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'SOLANA_RPC_URL not configured' }));
    return;
  }

  const body = await readBody(req);

  try {
    const upstreamRes = await fetch(upstream, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const text = await upstreamRes.text();
    res.statusCode = upstreamRes.status;
    res.setHeader(
      'Content-Type',
      upstreamRes.headers.get('content-type') ?? 'application/json'
    );
    res.end(text);
  } catch (err) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: 'Upstream RPC error',
        detail: err instanceof Error ? err.message : String(err),
      })
    );
  }
}
