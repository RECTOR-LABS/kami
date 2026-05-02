import React, { useState, useRef, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import SolanaWalletProvider from './components/WalletProvider';
import SidebarShell from './components/chat/SidebarShell';
import ChatHeader from './components/chat/ChatHeader';
import ChatInputShell from './components/chat/ChatInputShell';
import MessageBubble from './components/chat/MessageBubble';
import EmptyState from './components/EmptyState';
import PitchPage from './components/pitch/PitchPage';
import { useChat } from './hooks/useChat';

function AppContent() {
  const { connected, publicKey } = useWallet();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const {
    conversations,
    activeConversation,
    activeId,
    isStreaming,
    sendMessage,
    stopStreaming,
    newConversation,
    switchConversation,
    deleteConversation,
    clearAllConversations,
    renameConversation,
    updatePendingTransaction,
  } = useChat();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages]);

  if (!connected) {
    return (
      <div className="flex h-screen bg-kami-sepiaBg text-kami-cream overflow-hidden">
        <EmptyState />
      </div>
    );
  }

  if (!activeConversation) {
    return (
      <div className="flex h-screen bg-kami-sepiaBg text-kami-cream overflow-hidden" />
    );
  }

  const hasMessages = activeConversation.messages.length > 0;
  const handleSend = (msg: string) => sendMessage(msg, publicKey?.toBase58() || null);

  return (
    <div className="flex h-screen bg-kami-sepiaBg text-kami-cream overflow-hidden">
      <SidebarShell
        conversations={conversations}
        activeId={activeId}
        isOpen={sidebarOpen}
        onSelect={(id) => {
          switchConversation(id);
          setSidebarOpen(false);
        }}
        onNew={() => {
          newConversation();
          setSidebarOpen(false);
        }}
        onDelete={deleteConversation}
        onClose={() => setSidebarOpen(false)}
        onClearAll={clearAllConversations}
        onRename={renameConversation}
      />
      <div className="flex-1 flex flex-col h-full min-w-0">
        <ChatHeader
          conversationTitle={activeConversation.title}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        {hasMessages ? (
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="max-w-3xl mx-auto">
              {activeConversation.messages.map((msg, idx) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isStreaming={
                    isStreaming &&
                    msg.role === 'assistant' &&
                    idx === activeConversation.messages.length - 1
                  }
                  onPendingTransactionChange={updatePendingTransaction}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
        ) : (
          <div className="flex-1" />
        )}
        <ChatInputShell onSend={handleSend} onStop={stopStreaming} isStreaming={isStreaming} />
      </div>
    </div>
  );
}

export default function App() {
  if (typeof window !== 'undefined' && window.location.pathname === '/pitch') {
    return (
      <>
        <PitchPage />
        <Analytics />
        <SpeedInsights />
      </>
    );
  }

  return (
    <SolanaWalletProvider>
      <AppContent />
      <Analytics />
      <SpeedInsights />
    </SolanaWalletProvider>
  );
}
