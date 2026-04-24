import type { IncomingMessage, ServerResponse } from 'node:http';
import { applyLimit, identify, type LimitResult } from '../server/ratelimit.js';

export const config = {
  maxDuration: 30,
};

const MAX_BODY_BYTES = 64 * 1024;
const RPC_RATE_LIMIT = { name: 'rpc', limit: 120, window: '1 m' as const };

function setRateLimitHeaders(res: ServerResponse, r: LimitResult) {
  res.setHeader('X-RateLimit-Limit', String(r.limit));
  res.setHeader('X-RateLimit-Remaining', String(r.remaining));
  res.setHeader('X-RateLimit-Reset', String(r.reset));
}

const DENIED_METHODS = new Set([
  'getProgramAccounts',
  'getSignaturesForAddress',
  'getConfirmedSignaturesForAddress2',
  'getConfirmedBlock',
  'getBlock',
  'getBlocks',
  'getBlocksWithLimit',
  'getBlockProduction',
  'getInflationReward',
  'getRecentPerformanceSamples',
  'getRecentPrioritizationFees',
  'getLargestAccounts',
  'getSupply',
  'getVoteAccounts',
  'getClusterNodes',
]);

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

function deniedMethodIn(payload: unknown): string | null {
  const calls = Array.isArray(payload) ? payload : [payload];
  for (const c of calls) {
    if (c && typeof c === 'object' && typeof (c as { method?: unknown }).method === 'string') {
      const method = (c as { method: string }).method;
      if (DENIED_METHODS.has(method)) return method;
    }
  }
  return null;
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

  const rate = await applyLimit(RPC_RATE_LIMIT, identify(req));
  if (rate) {
    setRateLimitHeaders(res, rate);
    if (!rate.ok) {
      const retryAfter = Math.max(1, Math.ceil((rate.reset - Date.now()) / 1000));
      res.statusCode = 429;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Retry-After', String(retryAfter));
      res.end(
        JSON.stringify({
          error: 'Too many requests',
          limit: rate.limit,
          remaining: rate.remaining,
          retryAfterSeconds: retryAfter,
        }),
      );
      return;
    }
  }

  const body = await readBody(req);
  if (body === null) {
    res.statusCode = 413;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: `Body exceeds ${MAX_BODY_BYTES} bytes` }));
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body.toString('utf-8'));
  } catch {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    return;
  }

  const denied = deniedMethodIn(parsed);
  if (denied) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: `RPC method "${denied}" is not allowed through this proxy`,
        hint: 'Use a public RPC or your own Helius key for heavy historical queries.',
      }),
    );
    return;
  }

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
