import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import HeroCell from './landing/HeroCell';
import SysMetricsCell from './landing/SysMetricsCell';
import LatestTxCell from './landing/LatestTxCell';
import ToolCell from './landing/ToolCell';
import PipelineCell from './landing/PipelineCell';
import SponsorStrip from './landing/SponsorStrip';
import DemoVideoBand from './landing/DemoVideoBand';
import { TOOL_CELLS } from '../lib/landing-content';

const SOLFLARE_WALLET_NAME = 'Solflare';
const SOLFLARE_INSTALL_URL = 'https://solflare.com/download';
const DEMO_VIDEO_URL =
  'https://aheyudueboveptjv.public.blob.vercel-storage.com/demo/kami-walkthrough.mp4';
const DEMO_POSTER_URL =
  'https://aheyudueboveptjv.public.blob.vercel-storage.com/demo/kami-walkthrough-poster.jpg';

export default function EmptyState() {
  const { connected, connecting, wallets, select } = useWallet();
  const { setVisible } = useWalletModal();

  const handleConnectSolflare = () => {
    if (connected || connecting) return;
    const solflare = wallets.find((w) => w.adapter.name === SOLFLARE_WALLET_NAME);
    if (!solflare) {
      window.open(SOLFLARE_INSTALL_URL, '_blank', 'noopener,noreferrer');
      return;
    }
    // select() updates WalletProvider's walletName → adapter binding → triggers
    // autoConnect via WalletProviderBase's useEffect. Calling adapter.connect()
    // directly (the previous approach) bypasses that state propagation, so
    // useWallet().connected stays false even after the wallet authorizes.
    select(solflare.adapter.name);
  };

  const handleUseAnotherWallet = () => setVisible(true);

  return (
    <div className="flex-1 overflow-y-auto bg-kami-sepiaBg text-kami-cream relative">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(245,230,211,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(245,230,211,0.03) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
        aria-hidden="true"
      />
      <div
        className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full bg-kami-amberHaze blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="flex items-center justify-between font-mono text-xs text-kami-creamMuted uppercase tracking-wider mb-6 lg:mb-10">
          <span>&gt; KAMI · v1.0 · MAINNET</span>
          <span className="inline-flex items-center gap-2">
            [sys.status: online]
            <span
              className="w-2 h-2 rounded-full bg-kami-amber animate-pulse-dot"
              aria-hidden="true"
            />
          </span>
        </div>

        <DemoVideoBand videoSrc={DEMO_VIDEO_URL} posterSrc={DEMO_POSTER_URL} />

        <div className="grid grid-cols-12 gap-3 lg:gap-4">
          <HeroCell
            connecting={connecting}
            onConnectSolflare={handleConnectSolflare}
            onUseAnotherWallet={handleUseAnotherWallet}
          />
          <SysMetricsCell delay={2} />
          <LatestTxCell delay={3} />
          {TOOL_CELLS.map((tool, i) => (
            <ToolCell key={tool.name} tool={tool} delay={4 + i} />
          ))}
          <PipelineCell delay={8} />
          <SponsorStrip />
        </div>
      </div>
    </div>
  );
}
