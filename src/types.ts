export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  pendingTransaction?: PendingTransaction | null;
  toolCalls?: ToolCallRecord[];
}

export type PendingTxAction = 'deposit' | 'borrow' | 'withdraw' | 'repay';

export type PendingTxStatus = 'pending' | 'signing' | 'submitted' | 'confirmed' | 'failed' | 'cancelled';

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
  status: 'calling' | 'done' | 'error' | 'wallet-required';
  error?: string;
  code?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}
