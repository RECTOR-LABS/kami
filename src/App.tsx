import React, { useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import SolanaWalletProvider from './components/WalletProvider';
import Sidebar from './components/Sidebar';
import ChatPanel from './components/ChatPanel';
import { useChat } from './hooks/useChat';

function AppContent() {
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
  } = useChat();

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
