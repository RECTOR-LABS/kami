import type { IncomingMessage } from 'node:http';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

type Duration = `${number} ${'ms' | 's' | 'm' | 'h' | 'd'}`;

export interface LimiterConfig {
  name: string;
  limit: number;
  window: Duration;
}

export interface LimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

let redisSingleton: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisSingleton !== undefined) return redisSingleton;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    redisSingleton = null;
    return null;
  }
  redisSingleton = new Redis({ url, token });
  return redisSingleton;
}

const limiterCache = new Map<string, Ratelimit>();

export function getLimiter(config: LimiterConfig): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  const key = `${config.name}:${config.limit}:${config.window}`;
  const cached = limiterCache.get(key);
  if (cached) return cached;
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.limit, config.window),
    analytics: false,
    prefix: `kami:ratelimit:${config.name}`,
  });
  limiterCache.set(key, limiter);
  return limiter;
}

export function identify(req: IncomingMessage): string {
  const xfwd = req.headers['x-forwarded-for'];
  const xreal = req.headers['x-real-ip'];

  const fwdStr = Array.isArray(xfwd) ? xfwd[0] : xfwd;
  const fromFwd = typeof fwdStr === 'string' ? fwdStr.split(',')[0]?.trim() : '';
  const fromReal = typeof xreal === 'string' ? xreal.trim() : '';
  const ip = fromFwd || fromReal;

  if (ip) return ip;
  // Vercel always populates x-forwarded-for on incoming traffic. A missing IP
  // in production is anomalous — refuse to bucket every such caller under a
  // shared 'anonymous' key that a single actor could then exhaust and DoS.
  return process.env.NODE_ENV === 'production' ? '' : 'anonymous';
}

export async function applyLimit(
  config: LimiterConfig,
  identifier: string
): Promise<LimitResult | null> {
  const limiter = getLimiter(config);
  if (!limiter) return null;
  if (!identifier) {
    return { ok: false, limit: 0, remaining: 0, reset: Date.now() + 60_000 };
  }
  try {
    const r = await limiter.limit(identifier);
    return {
      ok: r.success,
      limit: r.limit,
      remaining: r.remaining,
      reset: r.reset,
    };
  } catch (err) {
    // Fail-open: an Upstash outage must not cascade into Kami unavailability.
    // Logged for post-hoc analysis; legitimate traffic continues to flow.
    console.error('[ratelimit] limiter.limit threw — failing open', err);
    return null;
  }
}

/** For tests only — clears the in-memory singleton so env-var changes take effect.
 *  Throws when invoked outside `NODE_ENV === 'test'` to defend against accidental
 *  use in app code (the helper exists in the prod bundle but refuses to run). */
export function _resetForTesting(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('_resetForTesting may only be called when NODE_ENV === "test"');
  }
  redisSingleton = undefined;
  limiterCache.clear();
}
