import React from 'react';
import type { ChatMessage as ChatMessageType } from '../types';
import { renderMarkdown } from '../lib/markdown';
import { stripTransactionBlock } from '../lib/parseTransaction';
import TransactionCard from './TransactionCard';
import ToolCallBadges from './ToolCallBadges';

interface Props {
  message: ChatMessageType;
  walletConnected: boolean;
}

export default function ChatMessage({ message, walletConnected }: Props) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end mb-4 animate-fade-in">
        <div className="max-w-[80%] lg:max-w-[60%] bg-kami-accent/20 border border-kami-accent/30 rounded-2xl rounded-br-md px-4 py-3">
          <p className="text-sm text-kami-text whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  const displayContent = message.transaction
    ? stripTransactionBlock(message.content)
    : message.content;

  return (
    <div className="flex mb-4 animate-fade-in">
      <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-kami-accent to-purple-400 flex items-center justify-center text-white font-bold text-xs mr-3 mt-0.5">
        K
      </div>
      <div className="max-w-[80%] lg:max-w-[70%]">
        {message.toolCalls && message.toolCalls.length > 0 && (
          <ToolCallBadges calls={message.toolCalls} />
        )}
        <div className="text-sm space-y-1">{renderMarkdown(displayContent)}</div>
        {message.transaction && (
          <TransactionCard
            transaction={message.transaction}
            walletConnected={walletConnected}
          />
        )}
      </div>
    </div>
  );
}
