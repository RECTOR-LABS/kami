import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PendingTransaction } from '../../types';

// vi.hoisted shared mocks for wallet + connection so each test can mutate them.
const wallet = vi.hoisted(() => ({
  publicKey: { toBase58: () => 'PubKey1234567890' },
  connected: true,
  sendTransaction: vi.fn(),
}));

const connection = vi.hoisted(() => ({
  getSignatureStatuses: vi.fn(),
  getBlockHeight: vi.fn(),
  rpcEndpoint: 'https://x',
}));

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => wallet,
  useConnection: () => ({ connection }),
}));

vi.mock('@solana/web3.js', () => ({
  VersionedTransaction: { deserialize: vi.fn(() => ({})) },
}));

import TxStatusCard from './TxStatusCard';

const baseTx: PendingTransaction = {
  action: 'deposit',
  protocol: 'Kamino',
  symbol: 'USDC',
  amount: 0.1,
  reserveAddress: 'reserve111',
  mint: 'mint11',
  summary: 'Deposit 0.1 USDC into Kamino main market',
  base64Txn: 'AAAA',
  blockhash: 'bh',
  lastValidBlockHeight: '100',
};

describe('TxStatusCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wallet.connected = true;
    wallet.sendTransaction = vi.fn();
    connection.getSignatureStatuses.mockReset();
    connection.getBlockHeight.mockReset();
  });

  it('renders the needs-sign state with action summary and Sign Transaction CTA', () => {
    render(<TxStatusCard transaction={baseTx} />);
    expect(screen.getByRole('button', { name: /sign transaction/i })).toBeInTheDocument();
    expect(screen.getByText(/deposit/i)).toBeInTheDocument();
    expect(screen.getByText(/0.1/)).toBeInTheDocument();
    expect(screen.getByText(/USDC/)).toBeInTheDocument();
  });

  it('renders the confirmed state with truncated signature and Solscan link', () => {
    const tx: PendingTransaction = {
      ...baseTx,
      status: 'confirmed',
      signature: '5XKeETjGfm1234567890pUvZE',
    };
    render(<TxStatusCard transaction={tx} />);
    expect(screen.getByText(/confirmed/i)).toBeInTheDocument();
    // Truncated signature: first 10 + ellipsis + last 5
    expect(screen.getByText(/5XKeETjGfm.*pUvZE/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /solscan/i })).toBeInTheDocument();
  });

  it('renders the failed state with error message and Retry button', () => {
    const tx: PendingTransaction = {
      ...baseTx,
      status: 'failed',
      error: 'Transaction simulation failed: insufficient funds',
    };
    render(<TxStatusCard transaction={tx} />);
    // 'Failed' heading + the error message both contain /failed/i — use getAllByText
    expect(screen.getAllByText(/failed/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/insufficient funds/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('flips to signing state when Sign Transaction CTA is clicked', async () => {
    wallet.sendTransaction.mockImplementation(() => new Promise(() => {})); // never resolves
    render(<TxStatusCard transaction={baseTx} />);
    fireEvent.click(screen.getByRole('button', { name: /sign transaction/i }));
    await waitFor(() => {
      expect(screen.getByText(/signing/i)).toBeInTheDocument();
    });
  });

  it('shows broadcasting state after sendTransaction resolves with a signature', async () => {
    wallet.sendTransaction.mockResolvedValue('sig-from-rpc-12345');
    // First poll returns null (still in flight) — keeps the broadcasting state visible
    connection.getSignatureStatuses.mockResolvedValue({ value: [null] });
    connection.getBlockHeight.mockResolvedValue(50);
    render(<TxStatusCard transaction={baseTx} />);
    fireEvent.click(screen.getByRole('button', { name: /sign transaction/i }));
    await waitFor(() => {
      expect(screen.getByText(/broadcasting/i)).toBeInTheDocument();
    });
  });

  it('fires onStatusChange with submitted+signature after sendTransaction resolves', async () => {
    wallet.sendTransaction.mockResolvedValue('sig-from-rpc-12345');
    // First poll returns null — keeps state in broadcasting so we can assert the submitted callback fired pre-confirm.
    connection.getSignatureStatuses.mockResolvedValue({ value: [null] });
    connection.getBlockHeight.mockResolvedValue(50);
    const onStatusChange = vi.fn();

    render(<TxStatusCard transaction={baseTx} onStatusChange={onStatusChange} />);
    fireEvent.click(screen.getByRole('button', { name: /sign transaction/i }));

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith({
        status: 'submitted',
        signature: 'sig-from-rpc-12345',
      });
    });
  });

  it('fires onStatusChange with confirmed when poll succeeds', async () => {
    wallet.sendTransaction.mockResolvedValue('sig-confirm-1');
    connection.getSignatureStatuses.mockResolvedValue({
      value: [{ confirmationStatus: 'confirmed', err: null }],
    });
    connection.getBlockHeight.mockResolvedValue(50);
    const onStatusChange = vi.fn();

    render(<TxStatusCard transaction={baseTx} onStatusChange={onStatusChange} />);
    fireEvent.click(screen.getByRole('button', { name: /sign transaction/i }));

    // POLL_INTERVAL_MS is 2_000 — extend waitFor beyond the default 1s ceiling.
    await waitFor(
      () => {
        expect(onStatusChange).toHaveBeenCalledWith({ status: 'confirmed' });
      },
      { timeout: 4_000 }
    );
  });

  it('fires onStatusChange with failed+error when sendTransaction throws', async () => {
    wallet.sendTransaction.mockRejectedValue(new Error('User rejected the request'));
    const onStatusChange = vi.fn();

    render(<TxStatusCard transaction={baseTx} onStatusChange={onStatusChange} />);
    fireEvent.click(screen.getByRole('button', { name: /sign transaction/i }));

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalled();
    });
    const lastCall = onStatusChange.mock.calls[onStatusChange.mock.calls.length - 1][0];
    expect(lastCall.status).toBe('failed');
    expect(typeof lastCall.error).toBe('string');
    expect(lastCall.error.length).toBeGreaterThan(0);
  });

  it('does not throw when onStatusChange prop is omitted', async () => {
    wallet.sendTransaction.mockResolvedValue('sig-orphan');
    connection.getSignatureStatuses.mockResolvedValue({
      value: [{ confirmationStatus: 'confirmed', err: null }],
    });
    connection.getBlockHeight.mockResolvedValue(50);

    render(<TxStatusCard transaction={baseTx} />);
    fireEvent.click(screen.getByRole('button', { name: /sign transaction/i }));

    // No throw → confirmed UI eventually renders. POLL_INTERVAL_MS is 2_000 —
    // extend waitFor beyond the default 1s ceiling.
    await waitFor(
      () => {
        expect(screen.getByText(/confirmed/i)).toBeInTheDocument();
      },
      { timeout: 4_000 }
    );
  });
});
