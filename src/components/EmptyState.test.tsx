import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LATEST_TX, SPONSORS, TOOL_CELLS } from '../lib/landing-content';

const setVisible = vi.fn();
const solflareConnect = vi.fn();

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({
    connected: false,
    connecting: false,
    wallets: [
      {
        adapter: {
          name: 'Solflare',
          connect: solflareConnect,
        },
      },
    ],
  }),
}));

vi.mock('@solana/wallet-adapter-react-ui', () => ({
  useWalletModal: () => ({ setVisible }),
}));

import EmptyState from './EmptyState';

describe('EmptyState bento landing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('clicking the CTA calls solflare.adapter.connect()', () => {
    render(<EmptyState />);
    fireEvent.click(screen.getByRole('button', { name: /connect with solflare/i }));
    expect(solflareConnect).toHaveBeenCalledTimes(1);
  });

  it('clicking "Use another Solana wallet" opens the wallet modal', () => {
    render(<EmptyState />);
    fireEvent.click(screen.getByRole('button', { name: /use another solana wallet/i }));
    expect(setVisible).toHaveBeenCalledWith(true);
  });
});
