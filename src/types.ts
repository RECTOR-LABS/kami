export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  transaction?: TransactionIntent | null;
  pendingTransaction?: PendingTransaction | null;
  toolCalls?: ToolCallRecord[];
}

export type PendingTxAction = 'deposit' | 'borrow' | 'withdraw' | 'repay';

export type PendingTxStatus = 'pending' | 'signing' | 'submitted' | 'confirmed' | 'failed';

export interface PendingTransaction {
  action: PendingTxAction;
  protocol: 'Kamino';
  symbol: string;
  amount: number;
  reserveAddress: string;
  mint: string;
  summary: string;
  base64Txn: string;
  blockhash: string;
  lastValidBlockHeight: string;
  status?: PendingTxStatus;
  signature?: string;
  error?: string;
}

export interface ToolCallRecord {
  id: string;
  name: string;
  status: 'calling' | 'done' | 'error';
  error?: string;
}

export interface TransactionIntent {
  type: 'transfer' | 'swap' | 'stake' | 'unstake' | 'custom';
  summary: string;
  details: {
    from?: string;
    to?: string;
    amount?: string;
    token?: string;
    tokenMint?: string;
    estimatedFee?: string;
    protocol?: string;
    slippage?: string;
  };
  raw?: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}
