import { Connection } from '@solana/web3.js';

const DEFAULT_RPC = 'https://api.mainnet-beta.solana.com';

let sharedConnection: Connection | null = null;

export function getConnection(): Connection {
  if (sharedConnection) return sharedConnection;
  const url = process.env.QUICKNODE_RPC_URL?.trim() || DEFAULT_RPC;
  sharedConnection = new Connection(url, { commitment: 'confirmed' });
  return sharedConnection;
}
