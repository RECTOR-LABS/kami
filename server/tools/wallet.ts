import { address, type Address } from '@solana/kit';
import type { ToolContext, ToolErrorCode } from './types.js';

type WalletAssertResult =
  | { ok: false; error: string; code: ToolErrorCode }
  | { wallet: Address };

export function assertWallet(ctx: ToolContext): WalletAssertResult {
  if (!ctx.walletAddress) {
    return {
      ok: false,
      error: 'Ask the user to connect Solflare (recommended) or another Solana wallet first.',
      code: 'WALLET_NOT_CONNECTED',
    };
  }
  try {
    return { wallet: address(ctx.walletAddress) };
  } catch {
    return {
      ok: false,
      error: `Invalid wallet address: ${ctx.walletAddress}`,
      code: 'INVALID_WALLET',
    };
  }
}
