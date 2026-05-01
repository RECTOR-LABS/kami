import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PendingTransaction } from '../../types';

// vi.hoisted shared mocks for wallet + connection so each test can mutate them.
const wallet = vi.hoisted(() => ({
  publicKey: { toBase58: () => 'PubKey1234567890' },
  connected: true,
  signTransaction: vi.fn() as ReturnType<typeof vi.fn> | undefined,
}));

const connection = vi.hoisted(() => ({
  sendRawTransaction: vi.fn(),
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
    wallet.signTransaction = vi.fn();
    connection.sendRawTransaction.mockReset();
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
    (wallet.signTransaction as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {})
    ); // never resolves
    render(<TxStatusCard transaction={baseTx} />);
    fireEvent.click(screen.getByRole('button', { name: /sign transaction/i }));
    await waitFor(() => {
      expect(screen.getByText(/signing/i)).toBeInTheDocument();
    });
  });

  it('shows broadcasting state after sendTransaction resolves with a signature', async () => {
    (wallet.signTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
      serialize: () => new Uint8Array([1, 2, 3]),
    });
    connection.sendRawTransaction.mockResolvedValue('sig-from-rpc-12345');
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
    (wallet.signTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
      serialize: () => new Uint8Array([1, 2, 3]),
    });
    connection.sendRawTransaction.mockResolvedValue('sig-from-rpc-12345');
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
    (wallet.signTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
      serialize: () => new Uint8Array([1, 2, 3]),
    });
    connection.sendRawTransaction.mockResolvedValue('sig-confirm-1');
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
    (wallet.signTransaction as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('User rejected the request')
    );
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

  it('fires onStatusChange with failed+error when poll fails (blockhash-expired)', async () => {
    (wallet.signTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
      serialize: () => new Uint8Array([1, 2, 3]),
    });
    connection.sendRawTransaction.mockResolvedValue('sig-stale');
    // Poll never sees the signature on-chain, and blockhash check fails.
    connection.getSignatureStatuses.mockResolvedValue({ value: [null] });
    connection.getBlockHeight.mockResolvedValue(99999); // > lastValidBlockHeight (100)
    const onStatusChange = vi.fn();

    render(
      <TxStatusCard
        transaction={{ ...baseTx, lastValidBlockHeight: '100' }}
        onStatusChange={onStatusChange}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /sign transaction/i }));

    // POLL_INTERVAL_MS is 2_000 — extend waitFor beyond the default 1s ceiling.
    await waitFor(
      () => {
        const failedCalls = onStatusChange.mock.calls.filter(
          ([patch]) => patch.status === 'failed'
        );
        expect(failedCalls.length).toBeGreaterThan(0);
      },
      { timeout: 4_000 }
    );

    const failedCall = onStatusChange.mock.calls.find(
      ([patch]) => patch.status === 'failed'
    )!;
    expect(failedCall[0].error).toMatch(/blockhash expired/i);
  });

  it('does not throw when onStatusChange prop is omitted', async () => {
    (wallet.signTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
      serialize: () => new Uint8Array([1, 2, 3]),
    });
    connection.sendRawTransaction.mockResolvedValue('sig-orphan');
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

  it('hydrates to broadcasting and resumes polling when status=submitted+signature', async () => {
    connection.getSignatureStatuses.mockResolvedValue({
      value: [{ confirmationStatus: 'confirmed', err: null }],
    });
    connection.getBlockHeight.mockResolvedValue(50);
    const onStatusChange = vi.fn();

    const tx: PendingTransaction = {
      ...baseTx,
      status: 'submitted',
      signature: 'sig-resumed-on-mount',
    };
    render(<TxStatusCard transaction={tx} onStatusChange={onStatusChange} />);

    // No "Sign Transaction" button — we're past needs-sign.
    expect(screen.queryByRole('button', { name: /sign transaction/i })).not.toBeInTheDocument();

    // Poll runs and resolves to confirmed.
    // POLL_INTERVAL_MS is 2_000 — extend waitFor beyond the default 1s ceiling.
    await waitFor(
      () => {
        expect(connection.getSignatureStatuses).toHaveBeenCalledWith(
          ['sig-resumed-on-mount'],
          expect.any(Object)
        );
      },
      { timeout: 4_000 }
    );
    await waitFor(
      () => {
        expect(onStatusChange).toHaveBeenCalledWith({ status: 'confirmed' });
      },
      { timeout: 4_000 }
    );
    await waitFor(
      () => {
        expect(screen.getByText(/confirmed/i)).toBeInTheDocument();
      },
      { timeout: 4_000 }
    );
  });

  it('falls back to needs-sign when status=submitted but signature is missing', () => {
    const tx: PendingTransaction = {
      ...baseTx,
      status: 'submitted',
      // signature deliberately omitted
    };
    render(<TxStatusCard transaction={tx} />);

    // Defensive: missing signature → render Sign button so user can re-attempt.
    expect(screen.getByRole('button', { name: /sign transaction/i })).toBeInTheDocument();
    expect(connection.getSignatureStatuses).not.toHaveBeenCalled();
  });

  it('shows clear error when wallet does not support signTransaction', async () => {
    // Legacy wallet edge case: useWallet().signTransaction is undefined.
    wallet.signTransaction = undefined;

    render(<TxStatusCard transaction={baseTx} />);
    fireEvent.click(screen.getByRole('button', { name: /sign transaction/i }));
    await waitFor(() => {
      expect(screen.getByText(/does not support signTransaction/i)).toBeInTheDocument();
    });
    expect(connection.sendRawTransaction).not.toHaveBeenCalled();
  });

  it('classifies SendTransactionError from sendRawTransaction broadcast', async () => {
    (wallet.signTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
      serialize: () => new Uint8Array([1, 2, 3]),
    });
    // Helius returns SendTransactionError with logs containing on-chain failure.
    const rpcError = new Error(
      'Transaction simulation failed: Error processing Instruction 5: custom program error: 0x17cc'
    );
    rpcError.name = 'SendTransactionError';
    connection.sendRawTransaction.mockRejectedValue(rpcError);

    render(<TxStatusCard transaction={baseTx} />);
    fireEvent.click(screen.getByRole('button', { name: /sign transaction/i }));
    // walletError classifies "0x17cc" / "NetValueRemainingTooSmall" → kind 'dust-floor'.
    await waitFor(() => {
      expect(screen.getByText(/below the minimum value floor/i)).toBeInTheDocument();
    });
  });

  it('classifies WalletSignTransactionError when user declines sign', async () => {
    const signError = new Error('User declined the request');
    signError.name = 'WalletSignTransactionError';
    (wallet.signTransaction as ReturnType<typeof vi.fn>).mockRejectedValue(signError);

    render(<TxStatusCard transaction={baseTx} />);
    fireEvent.click(screen.getByRole('button', { name: /sign transaction/i }));
    // walletError classifies WalletSignTransactionError name → cancelled with sign-specific copy.
    await waitFor(() => {
      expect(screen.getByText(/declined the sign request/i)).toBeInTheDocument();
    });
  });

  it('broadcasts via connection.sendRawTransaction (not via wallet)', async () => {
    const signedBytes = new Uint8Array([10, 20, 30, 40]);
    (wallet.signTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
      serialize: () => signedBytes,
    });
    connection.sendRawTransaction.mockResolvedValue('finalsig-base58');
    connection.getSignatureStatuses.mockResolvedValue({
      value: [{ confirmationStatus: 'confirmed', err: null }],
    });
    connection.getBlockHeight.mockResolvedValue(50);

    render(<TxStatusCard transaction={baseTx} />);
    fireEvent.click(screen.getByRole('button', { name: /sign transaction/i }));

    // POLL_INTERVAL_MS is 2_000 — extend waitFor beyond the default 1s ceiling.
    await waitFor(
      () => {
        expect(screen.getByRole('link', { name: /solscan/i })).toBeInTheDocument();
      },
      { timeout: 4_000 }
    );

    expect(wallet.signTransaction).toHaveBeenCalledTimes(1);
    expect(connection.sendRawTransaction).toHaveBeenCalledTimes(1);
    // The exact bytes from signTransaction must be passed to sendRawTransaction.
    expect(connection.sendRawTransaction).toHaveBeenCalledWith(
      signedBytes,
      expect.objectContaining({ skipPreflight: true, maxRetries: 3 })
    );
  });

  it('fires onStatusChange with failed when resumed poll detects blockhash-expired', async () => {
    // Poll returns no signature info, then blockhash check fails.
    connection.getSignatureStatuses.mockResolvedValue({ value: [null] });
    connection.getBlockHeight.mockResolvedValue(99999);
    const onStatusChange = vi.fn();

    const tx: PendingTransaction = {
      ...baseTx,
      status: 'submitted',
      signature: 'sig-stale',
      lastValidBlockHeight: '100',
    };
    render(<TxStatusCard transaction={tx} onStatusChange={onStatusChange} />);

    // POLL_INTERVAL_MS is 2_000 — extend waitFor beyond the default 1s ceiling.
    await waitFor(
      () => {
        expect(onStatusChange).toHaveBeenCalled();
      },
      { timeout: 4_000 }
    );
    const lastCall = onStatusChange.mock.calls[onStatusChange.mock.calls.length - 1][0];
    expect(lastCall.status).toBe('failed');
    expect(lastCall.error).toMatch(/blockhash expired/i);
  });
});
