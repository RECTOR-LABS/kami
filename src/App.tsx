import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import SolanaWalletProvider from './components/WalletProvider';
import Sidebar from './components/Sidebar';
import ChatPanel from './components/ChatPanel';
import EmptyState from './components/EmptyState';
import { useChat } from './hooks/useChat';

function AppContent() {
  const { connected } = useWallet();
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
  } = useChat();

  if (!connected) {
    return (
      <div className="flex h-screen bg-kami-sepiaBg text-kami-cream overflow-hidden">
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-kami-bg text-kami-text overflow-hidden">
      <Sidebar
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
      {activeConversation && (
        <ChatPanel
          conversation={activeConversation}
          isStreaming={isStreaming}
          onSend={sendMessage}
          onStop={stopStreaming}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <SolanaWalletProvider>
      <AppContent />
      <Analytics />
      <SpeedInsights />
    </SolanaWalletProvider>
  );
}
