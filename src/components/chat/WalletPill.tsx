import { useState, useRef, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Wallet, ChevronDown, Copy, ExternalLink, LogOut } from 'lucide-react';

const SOLSCAN_BASE = 'https://solscan.io/account/';

function truncatePubkey(pubkey: string): string {
  if (pubkey.length <= 8) return pubkey;
  return `${pubkey.slice(0, 4)}..${pubkey.slice(-4)}`;
}

export default function WalletPill() {
  const { connected, publicKey, disconnect } = useWallet();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!connected || !publicKey) return null;

  const pubkey = publicKey.toBase58();
  const truncated = truncatePubkey(pubkey);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pubkey);
    } catch {
      // ignore — clipboard may be unavailable in some contexts
    }
    setOpen(false);
  };

  const handleSolscan = () => {
    window.open(`${SOLSCAN_BASE}${pubkey}`, '_blank', 'noopener,noreferrer');
    setOpen(false);
  };

  const handleDisconnect = () => {
    void disconnect();
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Wallet menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-kami-amber text-kami-sepiaBg hover:opacity-95 active:opacity-90 transition-opacity"
      >
        <Wallet className="w-3.5 h-3.5 hidden sm:inline" aria-hidden="true" />
        <span className="font-mono text-xs font-bold tracking-tight">{truncated}</span>
        <ChevronDown className="w-3.5 h-3.5 opacity-70" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 z-50 min-w-[200px] bg-kami-cellBase border border-kami-cellBorder rounded-2xl shadow-lg py-1"
        >
          <button
            role="menuitem"
            type="button"
            onClick={handleCopy}
            className="w-full text-left px-4 py-2 font-mono text-xs text-kami-cream hover:bg-kami-amberHaze hover:text-kami-amber transition-colors flex items-center gap-2"
          >
            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
            Copy address
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={handleSolscan}
            className="w-full text-left px-4 py-2 font-mono text-xs text-kami-cream hover:bg-kami-amberHaze hover:text-kami-amber transition-colors flex items-center gap-2"
          >
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            View on Solscan
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={handleDisconnect}
            className="w-full text-left px-4 py-2 font-mono text-xs text-kami-cream hover:bg-kami-amberHaze hover:text-kami-amber transition-colors flex items-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
