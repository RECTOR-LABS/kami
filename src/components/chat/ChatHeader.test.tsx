import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({ connected: false, publicKey: null, disconnect: vi.fn() }),
}));

import ChatHeader from './ChatHeader';

describe('ChatHeader', () => {
  it('renders the conversation title', () => {
    render(<ChatHeader conversationTitle="USDC yield matrix" onMenuToggle={vi.fn()} />);
    expect(screen.getByText('USDC yield matrix')).toBeInTheDocument();
  });

  it('renders the env overline', () => {
    render(<ChatHeader conversationTitle="x" onMenuToggle={vi.fn()} />);
    expect(screen.getByText(/KAMI · v1.0 · MAINNET/)).toBeInTheDocument();
  });

  it('renders the status indicator with pulse-dot', () => {
    const { container } = render(
      <ChatHeader conversationTitle="x" onMenuToggle={vi.fn()} />
    );
    expect(container.querySelector('[class*="animate-pulse-dot"]')).toBeInTheDocument();
    expect(screen.getByText(/sys.status: online/)).toBeInTheDocument();
  });

  it('calls onMenuToggle when hamburger is clicked', () => {
    const onMenuToggle = vi.fn();
    render(<ChatHeader conversationTitle="x" onMenuToggle={onMenuToggle} />);
    fireEvent.click(screen.getByLabelText(/menu/i));
    expect(onMenuToggle).toHaveBeenCalledTimes(1);
  });
});
