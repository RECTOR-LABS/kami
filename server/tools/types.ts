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

// Cluster H (H2) — structured preflight outcomes surfaced to the LLM so it can
// route recovery paths intent-aware (e.g. dust-floor → suggest add-collateral
// vs partial-action vs Kamino-UI close-out). All fields are optional; non-build
// tools simply omit them and the existing { ok: false, error } shape still works.
export type PreflightErrorCode =
  | 'insufficient-sol'
  | 'insufficient-rent'
  | 'dust-floor'
  | 'simulation-failed';

export interface PreflightContext {
  netValueAfterUsd?: number;
  currentDepositUsd?: number;
  currentBorrowUsd?: number;
  shortfallSol?: number;
  failingProgram?: string;
  failingLog?: string;
}

export type ToolResult<T = unknown> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      code?: ToolErrorCode;
      errorCode?: PreflightErrorCode;
      context?: PreflightContext;
      suggestedAlternatives?: string[];
    };
