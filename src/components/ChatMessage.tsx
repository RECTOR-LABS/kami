import React from 'react';
import type { ChatMessage as ChatMessageType } from '../types';
import { Markdown } from '../lib/markdown';
import SignTransactionCard from './SignTransactionCard';
import ToolCallBadges from './ToolCallBadges';
import ConnectWalletButton from './ConnectWalletButton';

interface Props {
  message: ChatMessageType;
}

export default function ChatMessage({ message }: Props) {
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

  const showConnectCta = message.toolCalls?.some((c) => c.status === 'wallet-required') ?? false;
  const isWaitingForFirstToken =
    message.content === '' &&
    !message.toolCalls?.length &&
    !message.pendingTransaction &&
    !showConnectCta;

  return (
    <div className="flex mb-4 animate-fade-in">
      <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-kami-accent to-purple-400 flex items-center justify-center text-white font-bold text-xs mr-3 mt-0.5">
        K
      </div>
      <div className="max-w-[80%] lg:max-w-[70%]">
        {message.toolCalls && message.toolCalls.length > 0 && (
          <ToolCallBadges calls={message.toolCalls} />
        )}
        {isWaitingForFirstToken ? (
          <div className="flex items-center gap-1.5 px-4 py-3 bg-kami-surface rounded-2xl rounded-bl-md border border-kami-border w-fit">
            <div className="typing-dot w-2 h-2 rounded-full bg-kami-accent" />
            <div className="typing-dot w-2 h-2 rounded-full bg-kami-accent" />
            <div className="typing-dot w-2 h-2 rounded-full bg-kami-accent" />
          </div>
        ) : (
          <div className="text-sm space-y-1"><Markdown text={message.content} /></div>
        )}
        {message.pendingTransaction && (
          <SignTransactionCard transaction={message.pendingTransaction} />
        )}
        {showConnectCta && <ConnectWalletButton />}
      </div>
    </div>
  );
}
