import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mutable wallet mock so each test can vary `connected` state. Hoisted so
// the mock factory below can reference it without a temporal dead-zone.
const mockWallet = vi.hoisted(() => ({
  connected: false,
  connecting: false,
  wallets: [],
  publicKey: null,
}));

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => mockWallet,
}));

vi.mock('@solana/wallet-adapter-react-ui', () => ({
  useWalletModal: () => ({ setVisible: vi.fn() }),
  WalletMultiButton: () => null,
}));

vi.mock('@vercel/analytics/react', () => ({ Analytics: () => null }));
vi.mock('@vercel/speed-insights/react', () => ({ SpeedInsights: () => null }));

vi.mock('./components/WalletProvider', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./components/chat/SidebarShell', () => ({
  default: () => <div data-testid="sidebar-shell" />,
}));

vi.mock('./components/chat/ChatHeader', () => ({
  default: ({ conversationTitle }: { conversationTitle: string }) => (
    <div data-testid="chat-header">{conversationTitle}</div>
  ),
}));

vi.mock('./components/chat/ChatInputShell', () => ({
  default: () => <div data-testid="chat-input-shell" />,
}));

vi.mock('./components/chat/MessageBubble', () => ({
  default: () => <div data-testid="message-bubble" />,
}));

vi.mock('./hooks/useChat', () => ({
  useChat: () => ({
    conversations: [{ id: 'c1', title: 'first chat', messages: [], createdAt: 1, updatedAt: 1 }],
    activeConversation: {
      id: 'c1',
      title: 'first chat',
      messages: [],
      createdAt: 1,
      updatedAt: 1,
    },
    activeId: 'c1',
    isStreaming: false,
    sendMessage: vi.fn(),
    stopStreaming: vi.fn(),
    newConversation: vi.fn(),
    switchConversation: vi.fn(),
    deleteConversation: vi.fn(),
    clearAllConversations: vi.fn(),
    renameConversation: vi.fn(),
  }),
}));

import App from './App';

describe('App connect-gating', () => {
  beforeEach(() => {
    mockWallet.connected = false;
    mockWallet.connecting = false;
  });

  it('renders the full-screen bento landing when wallet is not connected', () => {
    mockWallet.connected = false;
    render(<App />);
    expect(screen.getByText('Type. Sign.')).toBeInTheDocument();
  });

  it('does NOT render the bento landing when wallet is connected', () => {
    mockWallet.connected = true;
    render(<App />);
    expect(screen.queryByText('Type. Sign.')).not.toBeInTheDocument();
  });

  it('renders the chat shell when wallet is connected', () => {
    mockWallet.connected = true;
    render(<App />);
    expect(screen.getByTestId('sidebar-shell')).toBeInTheDocument();
    expect(screen.getByTestId('chat-header')).toBeInTheDocument();
    expect(screen.getByTestId('chat-input-shell')).toBeInTheDocument();
  });
});
