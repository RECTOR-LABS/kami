import React, { useMemo, useEffect } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';

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
        background: #221a14 !important;
        border: 1px solid rgba(245, 230, 211, 0.12) !important;
        border-radius: 24px !important;
        box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5) !important;
      }
      .wallet-adapter-modal-title {
        color: #F5E6D3 !important;
        font-weight: 700 !important;
      }
      .wallet-adapter-modal-list {
        gap: 6px !important;
      }
      .wallet-adapter-modal-list .wallet-adapter-button {
        background: #2a2117 !important;
        color: #F5E6D3 !important;
        border: 1px solid rgba(245, 230, 211, 0.12) !important;
        font-weight: 500 !important;
        border-radius: 16px !important;
        transition: background 0.15s, border-color 0.15s !important;
      }
      .wallet-adapter-modal-list .wallet-adapter-button:hover,
      .wallet-adapter-modal-list .wallet-adapter-button:not(:disabled):active {
        background: rgba(255, 165, 0, 0.05) !important;
        border-color: rgba(255, 165, 0, 0.4) !important;
        color: #FFA500 !important;
      }
      .wallet-adapter-modal-list-more {
        color: rgba(245, 230, 211, 0.6) !important;
      }
      .wallet-adapter-modal-button-close {
        background: transparent !important;
      }
      .wallet-adapter-modal-button-close:hover {
        background: rgba(255, 165, 0, 0.05) !important;
      }
    `;
    document.head.appendChild(style);
  }, []);
}

function InnerProvider({ children }: { children: React.ReactNode }) {
  useWalletModalTheme();
  const wallets = useMemo(() => [], []);
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
