export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  transaction?: TransactionIntent | null;
  toolCalls?: ToolCallRecord[];
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
