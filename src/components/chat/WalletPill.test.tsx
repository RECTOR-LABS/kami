import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const disconnect = vi.fn();
const writeText = vi.fn();
const open = vi.fn();

const wallet = vi.hoisted(() => ({
  connected: true,
  publicKey: { toBase58: () => 'HclZ8AaB12345678901234567890123456789012345' },
  disconnect: vi.fn(),
}));

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => wallet,
}));

import WalletPill from './WalletPill';

describe('WalletPill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wallet.connected = true;
    wallet.disconnect = disconnect;
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    vi.spyOn(window, 'open').mockImplementation(open);
  });

  it('renders truncated pubkey when connected', () => {
    render(<WalletPill />);
    expect(screen.getByText('HclZ..2345')).toBeInTheDocument();
  });

  it('opens dropdown when pill is clicked', () => {
    render(<WalletPill />);
    fireEvent.click(screen.getByRole('button', { name: /wallet/i }));
    expect(screen.getByRole('menuitem', { name: /copy address/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /solscan/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /disconnect/i })).toBeInTheDocument();
  });

  it('copies pubkey when "Copy address" is clicked', () => {
    render(<WalletPill />);
    fireEvent.click(screen.getByRole('button', { name: /wallet/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /copy address/i }));
    expect(writeText).toHaveBeenCalledWith('HclZ8AaB12345678901234567890123456789012345');
  });

  it('opens Solscan in new tab when "View on Solscan" is clicked', () => {
    render(<WalletPill />);
    fireEvent.click(screen.getByRole('button', { name: /wallet/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /solscan/i }));
    expect(open).toHaveBeenCalledWith(
      'https://solscan.io/account/HclZ8AaB12345678901234567890123456789012345',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('calls wallet.disconnect when "Disconnect" is clicked', () => {
    render(<WalletPill />);
    fireEvent.click(screen.getByRole('button', { name: /wallet/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /disconnect/i }));
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
