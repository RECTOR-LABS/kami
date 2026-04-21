import React, { useMemo, useEffect } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';

function getSolanaRpcEndpoint() {
  if (typeof window === 'undefined') return '/api/rpc';
  return new URL('/api/rpc', window.location.origin).toString();
}

function useWalletModalTheme() {
  useEffect(() => {
    const STYLE_ID = 'kami-wallet-modal-theme';
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .wallet-adapter-modal-wrapper {
        background: #12121a !important;
        border: 1px solid #1e1e2e !important;
        border-radius: 14px !important;
        box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5) !important;
      }
      .wallet-adapter-modal-title {
        color: #e2e8f0 !important;
        font-weight: 600 !important;
      }
      .wallet-adapter-modal-list {
        gap: 6px !important;
      }
      .wallet-adapter-modal-list .wallet-adapter-button {
        background: #17171f !important;
        color: #e2e8f0 !important;
        border: 1px solid #1e1e2e !important;
        font-weight: 500 !important;
        border-radius: 10px !important;
        transition: background 0.15s, border-color 0.15s !important;
      }
      .wallet-adapter-modal-list .wallet-adapter-button:hover,
      .wallet-adapter-modal-list .wallet-adapter-button:not(:disabled):active {
        background: #1e1e2e !important;
        color: #ffffff !important;
      }
      .wallet-adapter-modal-list-more {
        color: #64748b !important;
      }
      .wallet-adapter-modal-button-close {
        background: transparent !important;
      }
      .wallet-adapter-modal-button-close:hover {
        background: rgba(255, 255, 255, 0.06) !important;
      }
    `;
    document.head.appendChild(style);
  }, []);
}

function InnerProvider({ children }: { children: React.ReactNode }) {
  useWalletModalTheme();
  const wallets = useMemo(
    () => [new SolflareWalletAdapter({ network: WalletAdapterNetwork.Mainnet })],
    []
  );
  const endpoint = useMemo(() => getSolanaRpcEndpoint(), []);

  const connectionConfig = useMemo(
    () => ({
      commitment: 'confirmed' as const,
      wsEndpoint: '',
      disableRetryOnRateLimit: false,
    }),
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint} config={connectionConfig}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default function SolanaWalletProvider({ children }: { children: React.ReactNode }) {
  return <InnerProvider>{children}</InnerProvider>;
}
