import { createSolanaRpc, type Rpc, type SolanaRpcApi } from '@solana/kit';

const DEFAULT_RPC = 'https://api.mainnet-beta.solana.com';

let sharedRpc: Rpc<SolanaRpcApi> | null = null;
let sharedRpcUrl: string | null = null;

export function getRpcUrl(): string {
  return process.env.SOLANA_RPC_URL?.trim() || DEFAULT_RPC;
}

export function getRpc(): Rpc<SolanaRpcApi> {
  const currentUrl = getRpcUrl();
  if (sharedRpc && sharedRpcUrl === currentUrl) return sharedRpc;
  sharedRpc = createSolanaRpc(currentUrl);
  sharedRpcUrl = currentUrl;
  return sharedRpc;
}
