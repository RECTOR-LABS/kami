import React, { useRef, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import type { Conversation } from '../types';
import ChatMessageComponent from './ChatMessage';
import ChatInput from './ChatInput';
import EmptyState from './EmptyState';

interface Props {
  conversation: Conversation;
  isStreaming: boolean;
  onSend: (msg: string, walletAddress?: string | null) => void;
  onStop: () => void;
  onMenuToggle: () => void;
}

export default function ChatPanel({ conversation, isStreaming, onSend, onStop, onMenuToggle }: Props) {
  const { publicKey } = useWallet();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation.messages]);

  const handleSend = (msg: string) => {
    onSend(msg, publicKey?.toBase58() || null);
  };

  const hasMessages = conversation.messages.length > 0;

  return (
    <div className="flex-1 flex flex-col h-full min-w-0">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-kami-border bg-kami-bg/80 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-1 text-kami-muted hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="truncate">
            <h2 className="text-sm font-medium text-white truncate">{conversation.title}</h2>
            <p className="text-[11px] text-kami-muted">
              {conversation.messages.filter((m) => m.role === 'user').length} messages
            </p>
          </div>
        </div>
        <WalletMultiButton />
      </header>

      {/* Messages */}
      {hasMessages ? (
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto">
            {conversation.messages.map((msg) => (
              <ChatMessageComponent key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      ) : (
        <EmptyState />
      )}

      {/* Input */}
      <ChatInput onSend={handleSend} onStop={onStop} isStreaming={isStreaming} />
    </div>
  );
}
