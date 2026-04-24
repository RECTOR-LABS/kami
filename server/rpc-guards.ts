export const MAX_BATCH_SIZE = 20;
export const MAX_PARAMS_ARRAY_LENGTH = 100;

export const DENIED_METHODS = new Set([
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

export function deniedMethodIn(payload: unknown): string | null {
  const calls = Array.isArray(payload) ? payload : [payload];
  for (const c of calls) {
    if (c && typeof c === 'object' && typeof (c as { method?: unknown }).method === 'string') {
      const method = (c as { method: string }).method;
      if (DENIED_METHODS.has(method)) return method;
    }
  }
  return null;
}

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
