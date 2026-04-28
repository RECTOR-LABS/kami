import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LATEST_TX, SPONSORS, TOOL_CELLS } from '../lib/landing-content';

const setVisible = vi.fn();
const select = vi.fn();

const walletState = vi.hoisted(() => ({
  wallets: [{ adapter: { name: 'Solflare' } }] as Array<{ adapter: { name: string } }>,
}));

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({
    connected: false,
    connecting: false,
    wallets: walletState.wallets,
    select,
  }),
}));

vi.mock('@solana/wallet-adapter-react-ui', () => ({
  useWalletModal: () => ({ setVisible }),
}));

import EmptyState from './EmptyState';

describe('EmptyState bento landing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    walletState.wallets = [{ adapter: { name: 'Solflare' } }];
  });

  it('renders the hero headline', () => {
    render(<EmptyState />);
    expect(screen.getByText('Type. Sign.')).toBeInTheDocument();
    expect(screen.getByText(/^Done/)).toBeInTheDocument();
  });

  it('renders all 4 tool cells by name', () => {
    render(<EmptyState />);
    TOOL_CELLS.forEach((t) => {
      expect(screen.getByText(t.name)).toBeInTheDocument();
    });
  });

  it('renders the latest tx truncated signature', () => {
    render(<EmptyState />);
    expect(screen.getByText(LATEST_TX.shortSignature)).toBeInTheDocument();
  });

  it('renders all 5 sponsor wordmarks', () => {
    render(<EmptyState />);
    SPONSORS.forEach((s) => {
      expect(screen.getByText(s)).toBeInTheDocument();
    });
  });

  it('renders the 3 pipeline step labels', () => {
    render(<EmptyState />);
    expect(screen.getByText('INTENT')).toBeInTheDocument();
    expect(screen.getByText('SIGNATURE')).toBeInTheDocument();
    expect(screen.getByText('EXECUTION')).toBeInTheDocument();
  });

  it('clicking the CTA calls select("Solflare") to drive WalletProvider autoConnect', () => {
    // Calling adapter.connect() directly (the previous approach) connects the
    // wallet but bypasses WalletProvider's walletName → adapter binding, so
    // useWallet().connected stays false. select() is the proper API.
    render(<EmptyState />);
    fireEvent.click(screen.getByRole('button', { name: /connect with solflare/i }));
    expect(select).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledWith('Solflare');
  });

  it('clicking the CTA opens the install URL when Solflare is not detected', () => {
    walletState.wallets = [];
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<EmptyState />);
    fireEvent.click(screen.getByRole('button', { name: /connect with solflare/i }));
    expect(open).toHaveBeenCalledWith(
      'https://solflare.com/download',
      '_blank',
      'noopener,noreferrer'
    );
    expect(select).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it('clicking "Use another Solana wallet" opens the wallet modal', () => {
    render(<EmptyState />);
    fireEvent.click(screen.getByRole('button', { name: /use another solana wallet/i }));
    expect(setVisible).toHaveBeenCalledWith(true);
  });
});
