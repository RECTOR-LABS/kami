import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { TrendingUp, ArrowLeftRight, Wallet, ShieldCheck, type LucideIcon } from 'lucide-react';

const SOLFLARE_WALLET_NAME = 'Solflare';
const SOLFLARE_INSTALL_URL = 'https://solflare.com/download';

function SolflareLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#FFFFFF" fillOpacity="0.12" />
      <path
        d="M11.5 9h6.2c2.9 0 4.6 1.7 4.6 4.4 0 2.1-1.1 3.6-3 4.1l3.3 5.5h-3.2l-3-5.2h-2.2V23H11.5V9zm6.1 6.3c1.4 0 2.3-.8 2.3-2 0-1.3-.9-2-2.3-2h-2.9v4h2.9z"
        fill="#FCA311"
      />
    </svg>
  );
}

export default function EmptyState() {
  const { connected, connecting, wallets } = useWallet();
  const { setVisible } = useWalletModal();

  const handleConnectSolflare = async () => {
    if (connected || connecting) return;
    const solflare = wallets.find((w) => w.adapter.name === SOLFLARE_WALLET_NAME);
    if (!solflare) {
      window.open(SOLFLARE_INSTALL_URL, '_blank', 'noopener,noreferrer');
      return;
    }
    try {
      await solflare.adapter.connect();
    } catch {
      setVisible(true);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-kami-accent to-purple-400 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-6">
          K
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Welcome to Kami</h2>
        <p className="text-sm text-kami-muted mb-8 leading-relaxed">
          Your AI co-pilot for Kamino Finance on Solana. Ask about your obligations, find yield,
          simulate health factors, or deposit / borrow / withdraw — all in plain English.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left mb-6">
          {(
            [
              { Icon: TrendingUp, title: 'Live Yields', desc: 'Find best APYs on Kamino' },
              { Icon: ArrowLeftRight, title: 'Build & Sign', desc: 'Deposit, borrow, withdraw, repay' },
              { Icon: Wallet, title: 'Portfolio', desc: 'Your Kamino positions + APY' },
              { Icon: ShieldCheck, title: 'Health Sim', desc: 'Liquidation-risk checks' },
            ] satisfies Array<{ Icon: LucideIcon; title: string; desc: string }>
          ).map(({ Icon, title, desc }) => (
            <div
              key={title}
              className="p-3 rounded-xl border border-kami-border bg-kami-surface/50 hover:bg-kami-surface transition-colors"
            >
              <Icon className="w-5 h-5 text-kami-accent mb-2" aria-hidden="true" />
              <div className="text-sm font-medium text-white">{title}</div>
              <div className="text-xs text-kami-muted">{desc}</div>
            </div>
          ))}
        </div>

        {!connected && (
          <button
            type="button"
            onClick={handleConnectSolflare}
            disabled={connecting}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl bg-gradient-to-r from-[#FCA311] to-[#E8920D] text-black font-semibold hover:opacity-95 active:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-wait"
          >
            <SolflareLogo className="w-5 h-5" />
            {connecting ? 'Opening Solflare…' : 'Connect with Solflare'}
          </button>
        )}
        {!connected && (
          <button
            type="button"
            onClick={() => setVisible(true)}
            className="mt-2 w-full text-xs text-kami-muted hover:text-kami-text transition-colors"
          >
            Use another Solana wallet
          </button>
        )}
      </div>
    </div>
  );
}
