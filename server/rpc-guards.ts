export const MAX_BATCH_SIZE = 20;
export const MAX_PARAMS_ARRAY_LENGTH = 100;

export const ALLOWED_METHODS = new Set([
  // Connectivity / health
  'getHealth',
  // Transaction lifecycle
  'getLatestBlockhash',
  'simulateTransaction',
  'sendTransaction',
  'getSignatureStatuses',
  'getBlockHeight',
  'getMinimumBalanceForRentExemption',
  // Wallet / account reads
  'getBalance',
  'getAccountInfo',
  'getMultipleAccounts',
]);

export function disallowedMethodIn(payload: unknown): string | null {
  const calls = Array.isArray(payload) ? payload : [payload];
  for (const c of calls) {
    if (c && typeof c === 'object' && typeof (c as { method?: unknown }).method === 'string') {
      const method = (c as { method: string }).method;
      if (!ALLOWED_METHODS.has(method)) return method;
    }
  }
  return null;
}

// NOTE: This guard inspects only DIRECT array children of `params`. RPC methods
// that wrap long arrays inside config objects (e.g.,
// `params: [{ accounts: [...100 items...] }]`) would slip through. The current
// ALLOWED_METHODS set covers methods whose direct-params shape is well-known;
// if an allowlist addition has nested array params, audit this function for
// recursive descent before relying on it.
export function oversizedParamsIn(payload: unknown): string | null {
  if (Array.isArray(payload) && payload.length > MAX_BATCH_SIZE) {
    return `batch of ${payload.length} calls exceeds limit of ${MAX_BATCH_SIZE}`;
  }
  const calls = Array.isArray(payload) ? payload : [payload];
  for (const c of calls) {
    if (!c || typeof c !== 'object') continue;
    const params = (c as { params?: unknown }).params;
    if (!Array.isArray(params)) continue;
    for (const p of params) {
      if (Array.isArray(p) && p.length > MAX_PARAMS_ARRAY_LENGTH) {
        return `params array length ${p.length} exceeds limit of ${MAX_PARAMS_ARRAY_LENGTH}`;
      }
    }
  }
  return null;
}
