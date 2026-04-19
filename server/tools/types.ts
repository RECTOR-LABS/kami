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

export type ToolResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };
