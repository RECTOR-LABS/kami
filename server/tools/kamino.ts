import { z } from 'zod';
import type { ToolDefinition, ToolResult } from './types.js';

// Kamino main market address on Solana mainnet-beta.
export const KAMINO_MAIN_MARKET = '7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF';

export const getPortfolioSchema = z.object({});

export interface PortfolioSnapshot {
  wallet: string;
  hasObligation: boolean;
  totalDepositedUsd: number;
  totalBorrowedUsd: number;
  netValueUsd: number;
  loanToValue: number;
  liquidationLtv: number;
  healthFactor: number;
  deposits: Array<{ token: string; amount: number; valueUsd: number; apyPercent: number }>;
  borrows: Array<{ token: string; amount: number; valueUsd: number; apyPercent: number }>;
}

// TODO(day-2): wire real klend-sdk via @solana/kit.
// klend-sdk@latest migrated its RPC client from web3.js v1 (Connection)
// to @solana/kit v2 (createSolanaRpc). Need createSolanaRpc(QUICKNODE_RPC_URL)
// + address() helper + KaminoMarket.load(rpc, address, recentSlotDurationMs).
export const getPortfolio: ToolDefinition<
  z.infer<typeof getPortfolioSchema>,
  ToolResult<PortfolioSnapshot>
> = {
  name: 'getPortfolio',
  description:
    "Fetch the connected wallet's Kamino main-market obligation: deposits, borrows, health factor, LTV.",
  schema: getPortfolioSchema,
  handler: async (_input, ctx) => {
    if (!ctx.walletAddress) {
      return {
        ok: false,
        error: 'No wallet connected. Ask the user to connect Phantom or Solflare first.',
      };
    }
    return {
      ok: false,
      error: 'getPortfolio is not yet implemented — Kamino SDK wiring lands on day 2.',
    };
  },
};

export const TOOLS = {
  getPortfolio,
} as const;
