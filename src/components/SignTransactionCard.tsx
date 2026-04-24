import React, { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { VersionedTransaction, type Connection } from '@solana/web3.js';
import type { PendingTransaction, PendingTxStatus } from '../types';
import { classifyWalletError, type ClassifiedWalletError } from '../lib/walletError';

const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 120_000;

type PollOutcome =
  | { status: 'confirmed' }
  | { status: 'failed'; reason: string };

async function pollSignatureStatus(
  connection: Connection,
  signature: string,
  lastValidBlockHeight: number
): Promise<PollOutcome> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    try {
      const statusResp = await connection.getSignatureStatuses([signature], {
        searchTransactionHistory: true,
      });
      const info = statusResp.value[0];
      if (info?.err) {
        return { status: 'failed', reason: `On-chain failure: ${JSON.stringify(info.err)}` };
      }
      if (info?.confirmationStatus === 'confirmed' || info?.confirmationStatus === 'finalized') {
        return { status: 'confirmed' };
      }
      const currentHeight = await connection.getBlockHeight('confirmed');
      if (currentHeight > lastValidBlockHeight) {
        return { status: 'failed', reason: 'Blockhash expired before confirmation.' };
      }
    } catch {
      // transient RPC hiccup — keep polling
    }
  }
  return { status: 'failed', reason: 'Timed out waiting for confirmation.' };
}

interface Props {
  transaction: PendingTransaction;
}

const ACTION_ICONS: Record<PendingTransaction['action'], string> = {
  deposit: '↓',
  borrow: '↗',
  withdraw: '↑',
  repay: '↙',
};

const ACTION_COLORS: Record<PendingTransaction['action'], string> = {
  deposit: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/30',
  borrow: 'from-amber-500/20 to-amber-600/5 border-amber-500/30',
  withdraw: 'from-blue-500/20 to-blue-600/5 border-blue-500/30',
  repay: 'from-purple-500/20 to-purple-600/5 border-purple-500/30',
};

function decodeBase64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}


export default function SignTransactionCard({ transaction }: Props) {
  const { connection } = useConnection();
  const { publicKey, connected, sendTransaction } = useWallet();

  const [status, setStatus] = useState<PendingTxStatus>(transaction.status ?? 'pending');
  const [signature, setSignature] = useState<string | null>(transaction.signature ?? null);
  const [error, setError] = useState<ClassifiedWalletError | null>(
    transaction.error ? { kind: 'unknown', message: transaction.error } : null
  );

  const icon = ACTION_ICONS[transaction.action];
  const colors = ACTION_COLORS[transaction.action];
  const actionLabel = transaction.action.charAt(0).toUpperCase() + transaction.action.slice(1);

  const busy = status === 'signing' || status === 'submitted';

  const handleSignAndSend = async () => {
    if (!connected || !publicKey) {
      setError({ kind: 'unknown', message: 'Connect a wallet first.' });
      setStatus('failed');
      return;
    }
    setError(null);
    setStatus('signing');

    try {
      const txBytes = decodeBase64ToBytes(transaction.base64Txn);
      const tx = VersionedTransaction.deserialize(txBytes);

      const sig = await sendTransaction(tx, connection, {
        skipPreflight: false,
        maxRetries: 3,
      });
      setSignature(sig);
      setStatus('submitted');

      const lastValidBlockHeight = Number(transaction.lastValidBlockHeight);
      const outcome = await pollSignatureStatus(connection, sig, lastValidBlockHeight);

      if (outcome.status === 'confirmed') {
        setStatus('confirmed');
      } else {
        const classified = classifyWalletError(new Error(outcome.reason));
        setError(classified);
        setStatus('failed');
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Kami] sendTransaction failed', err);
      const classified = classifyWalletError(err);
      setError(classified);
      setStatus(classified.kind === 'cancelled' ? 'cancelled' : 'failed');
    }
  };

  return (
    <div className={`mt-3 rounded-xl border bg-gradient-to-br ${colors} p-4 animate-fade-in`}>
      <div className="flex items-start gap-3 mb-3">
        <div className="text-xl font-bold text-white">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-kami-muted uppercase tracking-wider mb-1">
            {actionLabel} · {transaction.protocol}
          </div>
          <p className="text-sm text-white font-medium break-words">{transaction.summary}</p>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <DetailRow label="Action" value={actionLabel} />
        <DetailRow label="Amount" value={`${transaction.amount} ${transaction.symbol}`} />
        <DetailRow label="Protocol" value={transaction.protocol} />
        <DetailRow label="Reserve" value={truncate(transaction.reserveAddress)} />
      </div>

      {status === 'pending' && connected && (
        <button
          onClick={handleSignAndSend}
          className="w-full py-2.5 px-4 rounded-lg bg-kami-accent hover:bg-kami-accentHover text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          Sign &amp; Send
        </button>
      )}

      {status === 'pending' && !connected && (
        <div className="text-center py-2 text-xs text-kami-muted">
          Connect your wallet to sign this transaction.
        </div>
      )}

      {status === 'signing' && (
        <StatusPill tone="info" label="Awaiting wallet signature…" spin />
      )}

      {status === 'submitted' && (
        <StatusPill tone="info" label="Submitted — waiting for confirmation…" spin />
      )}

      {status === 'confirmed' && signature && (
        <div className="space-y-2">
          <StatusPill tone="success" label="Confirmed on mainnet" />
          <a
            href={`https://solscan.io/tx/${signature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center py-2 px-3 rounded-lg border border-kami-border text-xs text-kami-accent hover:text-kami-accentHover hover:border-kami-accent/40 transition-colors font-mono break-all"
          >
            {truncate(signature, 12, 12)} ↗
          </a>
        </div>
      )}

      {(status === 'failed' || status === 'cancelled') && (
        <div className="space-y-2">
          <StatusPill
            tone={status === 'cancelled' ? 'warning' : 'error'}
            label={status === 'cancelled' ? 'Cancelled' : 'Failed'}
          />
          {error && (
            <div className="space-y-1">
              <p
                className={`text-xs break-words font-mono ${
                  status === 'cancelled' ? 'text-amber-200/90' : 'text-red-300/80'
                }`}
              >
                {error.message}
              </p>
              {error.hint && (
                <p className="text-xs text-kami-muted break-words">{error.hint}</p>
              )}
            </div>
          )}
          {!busy && connected && (
            <button
              onClick={handleSignAndSend}
              className="w-full py-2 px-4 rounded-lg border border-kami-border hover:border-kami-accent/40 text-kami-muted hover:text-white text-xs transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-kami-muted">{label}</span>
      <span className="text-kami-text font-mono">{value}</span>
    </div>
  );
}

function StatusPill({
  tone,
  label,
  spin,
}: {
  tone: 'info' | 'success' | 'error' | 'warning';
  label: string;
  spin?: boolean;
}) {
  const toneStyles = {
    info: 'bg-kami-accent/15 border-kami-accent/30 text-kami-accent',
    success: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
    warning: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
    error: 'bg-red-500/15 border-red-500/30 text-red-300',
  }[tone];
  return (
    <div
      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border ${toneStyles} text-xs`}
    >
      {spin && (
        <span className="inline-block w-3 h-3 rounded-full border-2 border-current border-r-transparent animate-spin" />
      )}
      <span>{label}</span>
    </div>
  );
}

function truncate(value: string, head = 6, tail = 4): string {
  if (!value) return '';
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}
