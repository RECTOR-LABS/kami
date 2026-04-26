import { z } from 'zod';

export interface ToolDefinition<TInput, TOutput> {
  name: string;
  description: string;
  schema: z.ZodType<TInput>;
  handler: (input: TInput, ctx: ToolContext) => Promise<TOutput>;
}

export interface ToolContext {
  walletAddress: string | null;
}

// Non-exhaustive union — new codes (e.g. 'OBLIGATION_TOO_SMALL', 'STALE_ORACLE')
// may be added later without touching every consumer.
export type ToolErrorCode = 'WALLET_NOT_CONNECTED' | 'INVALID_WALLET';

export type ToolResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: ToolErrorCode };
