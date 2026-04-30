import { useState, useEffect, useRef } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { VersionedTransaction, type Connection } from '@solana/web3.js';
import { Loader2, CheckCircle2, XCircle, ExternalLink, Wallet } from 'lucide-react';
import BentoCell from '../bento/BentoCell';
import KamiCursor from '../bento/KamiCursor';
import KeyValueRows from './KeyValueRows';
import { classifyWalletError, type ClassifiedWalletError } from '../../lib/walletError';
import type { PendingTransaction } from '../../types';

type Phase = 'needs-sign' | 'signing' | 'broadcasting' | 'confirmed' | 'failed';

interface Props {
  transaction: PendingTransaction;
  onStatusChange?: (patch: Partial<PendingTransaction>) => void;
}

const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 120_000;

const SOLSCAN_TX = (sig: string) => `https://solscan.io/tx/${sig}`;

function truncateSig(sig: string): string {
  if (sig.length <= 16) return sig;
  return `${sig.slice(0, 10)}…${sig.slice(-5)}`;
}

function decodeBase64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

type PollOutcome = { status: 'confirmed' } | { status: 'failed'; reason: string };

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
    } catch (err) {
      // Visibility for unexpected RPC errors. Silent swallowing hides programmer
      // bugs (TypeErrors, unbound calls) behind a "transient" lie. Polling
      // continues regardless — POLL_INTERVAL_MS bounds log volume.
      // eslint-disable-next-line no-console
      console.warn('[Kami] pollSignatureStatus retry', err);
    }
  }
  return { status: 'failed', reason: 'Timed out waiting for confirmation.' };
}

export default function TxStatusCard({ transaction, onStatusChange }: Props) {
  const { publicKey, connected, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [phase, setPhase] = useState<Phase>(() => {
    if (transaction.status === 'confirmed' && transaction.signature) return 'confirmed';
    if (
      transaction.status === 'failed' ||
      transaction.status === 'cancelled' ||
      transaction.error
    ) {
      return 'failed';
    }
    return 'needs-sign';
  });
  const [signature, setSignature] = useState<string | null>(transaction.signature ?? null);
  const [error, setError] = useState<ClassifiedWalletError | null>(
    transaction.error ? { kind: 'unknown', message: transaction.error } : null
  );
  const cancelRef = useRef(false);

  useEffect(
    () => () => {
      cancelRef.current = true;
    },
    []
  );

  const handleSign = async () => {
    if (!connected || !publicKey) {
      setError({ kind: 'unknown', message: 'Connect a wallet first.' });
      setPhase('failed');
      return;
    }
    setError(null);
    setPhase('signing');
    try {
      const txBytes = decodeBase64ToBytes(transaction.base64Txn);
      const tx = VersionedTransaction.deserialize(txBytes);
      const sig = await sendTransaction(tx, connection, {
        skipPreflight: false,
        maxRetries: 3,
      });
      setSignature(sig);
      setPhase('broadcasting');
      onStatusChange?.({ status: 'submitted', signature: sig });

      const lastValidBlockHeight = Number(transaction.lastValidBlockHeight);
      const outcome = await pollSignatureStatus(connection, sig, lastValidBlockHeight);
      if (cancelRef.current) return;

      if (outcome.status === 'confirmed') {
        setPhase('confirmed');
        onStatusChange?.({ status: 'confirmed' });
      } else {
        const classified = classifyWalletError(new Error(outcome.reason));
        setError(classified);
        setPhase('failed');
        onStatusChange?.({ status: 'failed', error: outcome.reason });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Kami] sendTransaction failed', err);
      const classified = classifyWalletError(err);
      setError(classified);
      setPhase('failed');
      onStatusChange?.({ status: 'failed', error: classified.message });
    }
  };

  const txRows = [
    { key: 'action', value: transaction.action },
    { key: 'amount', value: `${transaction.amount} ${transaction.symbol}` },
    { key: 'protocol', value: transaction.protocol },
  ];

  return (
    <BentoCell delay={0} variant="compact" className="bg-kami-cellBase border-kami-cellBorder">
      <KeyValueRows rows={txRows} />

      {phase === 'needs-sign' && (
        <button
          type="button"
          onClick={handleSign}
          className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-kami-amber text-kami-sepiaBg font-mono uppercase tracking-wider text-xs font-bold hover:opacity-95 active:opacity-90 transition-opacity"
        >
          <Wallet className="w-4 h-4" aria-hidden="true" />
          Sign Transaction
        </button>
      )}

      {phase === 'signing' && (
        <div className="mt-3 inline-flex items-center gap-2 font-mono text-xs text-kami-amber">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          Signing<KamiCursor />
        </div>
      )}

      {phase === 'broadcasting' && (
        <div className="mt-3 inline-flex items-center gap-2 font-mono text-xs text-kami-amber">
          <span
            className="w-2 h-2 rounded-full bg-kami-amber animate-pulse-dot"
            aria-hidden="true"
          />
          Broadcasting…
        </div>
      )}

      {phase === 'confirmed' && signature && (
        <div className="mt-3 flex items-center gap-3 p-3 rounded-xl bg-kami-cellElevated border border-kami-cellBorder">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-kami-amber/15 text-kami-amber font-mono text-[10px] uppercase tracking-widest">
            <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
            Confirmed
          </span>
          <span className="font-mono text-xs text-kami-cream">{truncateSig(signature)}</span>
          <a
            href={SOLSCAN_TX(signature)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View ${truncateSig(signature)} on Solscan`}
            className="inline-flex items-center gap-1 text-kami-amber hover:opacity-80 transition-opacity ml-auto"
          >
            <span className="font-mono text-[11px]">Solscan</span>
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
        </div>
      )}

      {phase === 'failed' && (
        <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-kami-amber/5 border border-kami-amber/30">
          <XCircle className="w-4 h-4 text-kami-amber flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-widest text-kami-amber mb-1">
              Failed
            </div>
            <p className="font-mono text-xs text-kami-cream/80 break-words">
              {error?.message ?? 'Unknown error'}
            </p>
            {error?.hint && (
              <p className="font-mono text-[11px] text-kami-creamMuted mt-1 break-words">
                {error.hint}
              </p>
            )}
            <button
              type="button"
              onClick={handleSign}
              className="mt-2 font-mono text-[11px] text-kami-amber hover:underline"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </BentoCell>
  );
}
