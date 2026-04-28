import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({ connected: false, connecting: false, wallets: [] }),
}));

vi.mock('@solana/wallet-adapter-react-ui', () => ({
  useWalletModal: () => ({ setVisible: vi.fn() }),
}));

import EmptyState from './EmptyState';

describe('EmptyState feature cards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all 4 feature card titles', () => {
    render(<EmptyState onSend={vi.fn()} />);
    expect(screen.getByText('Live Yields')).toBeInTheDocument();
    expect(screen.getByText('Build & Sign')).toBeInTheDocument();
    expect(screen.getByText('Portfolio')).toBeInTheDocument();
    expect(screen.getByText('Health Sim')).toBeInTheDocument();
  });

  it('fires the Live Yields query on click', () => {
    const onSend = vi.fn();
    render(<EmptyState onSend={onSend} />);
    fireEvent.click(screen.getByText('Live Yields').closest('button')!);
    expect(onSend).toHaveBeenCalledWith('What are the best Kamino yields right now?');
  });

  it('fires the Build & Sign query on click', () => {
    const onSend = vi.fn();
    render(<EmptyState onSend={onSend} />);
    fireEvent.click(screen.getByText('Build & Sign').closest('button')!);
    expect(onSend).toHaveBeenCalledWith('Show me a 5 USDC deposit example');
  });

  it('fires the Portfolio query on click', () => {
    const onSend = vi.fn();
    render(<EmptyState onSend={onSend} />);
    fireEvent.click(screen.getByText('Portfolio').closest('button')!);
    expect(onSend).toHaveBeenCalledWith('Show me my Kamino portfolio');
  });

  it('fires the Health Sim query on click', () => {
    const onSend = vi.fn();
    render(<EmptyState onSend={onSend} />);
    fireEvent.click(screen.getByText('Health Sim').closest('button')!);
    expect(onSend).toHaveBeenCalledWith('Will my borrow position liquidate at SOL $50?');
  });
});
