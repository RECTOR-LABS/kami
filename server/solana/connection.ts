import { Connection } from '@solana/web3.js';

const DEFAULT_RPC = 'https://api.mainnet-beta.solana.com';

let sharedConnection: Connection | null = null;

export function getRpcUrl(): string {
  return process.env.SOLANA_RPC_URL?.trim() || DEFAULT_RPC;
}

export function getConnection(): Connection {
  if (sharedConnection) return sharedConnection;
  sharedConnection = new Connection(getRpcUrl(), { commitment: 'confirmed' });
  return sharedConnection;
}
