import React from 'react';
import type { TransactionIntent } from '../types';

interface Props {
  transaction: TransactionIntent;
  walletConnected: boolean;
}

const TYPE_ICONS: Record<string, string> = {
  transfer: '↗',
  swap: '⇄',
  stake: '🔒',
  unstake: '🔓',
  custom: '⚙',
};

const TYPE_COLORS: Record<string, string> = {
  transfer: 'from-blue-500/20 to-blue-600/5 border-blue-500/30',
  swap: 'from-purple-500/20 to-purple-600/5 border-purple-500/30',
  stake: 'from-green-500/20 to-green-600/5 border-green-500/30',
  unstake: 'from-amber-500/20 to-amber-600/5 border-amber-500/30',
  custom: 'from-gray-500/20 to-gray-600/5 border-gray-500/30',
};

export default function TransactionCard({ transaction, walletConnected }: Props) {
  const { type, summary, details } = transaction;
  const icon = TYPE_ICONS[type] || '⚙';
  const colors = TYPE_COLORS[type] || TYPE_COLORS.custom;

  return (
    <div
      className={`mt-3 rounded-xl border bg-gradient-to-br ${colors} p-4 animate-fade-in`}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="text-xl">{icon}</div>
        <div className="flex-1">
          <div className="text-xs font-medium text-kami-muted uppercase tracking-wider mb-1">
            {type} Transaction
          </div>
          <p className="text-sm text-white font-medium">{summary}</p>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {details.amount && details.token && (
          <DetailRow label="Amount" value={`${details.amount} ${details.token}`} />
        )}
        {details.to && <DetailRow label="To" value={truncateAddress(details.to)} />}
        {details.protocol && <DetailRow label="Protocol" value={details.protocol} />}
        {details.slippage && <DetailRow label="Slippage" value={`${details.slippage}%`} />}
        {details.estimatedFee && <DetailRow label="Est. Fee" value={details.estimatedFee} />}
      </div>

      {walletConnected ? (
        <button className="w-full py-2.5 px-4 rounded-lg bg-kami-accent hover:bg-kami-accentHover text-white text-sm font-medium transition-colors flex items-center justify-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Confirm & Sign
        </button>
      ) : (
        <div className="text-center py-2 text-xs text-kami-muted">
          Connect your wallet to execute this transaction
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

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
