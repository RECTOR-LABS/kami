import { Code2, Wallet } from 'lucide-react';
import BentoCell from './BentoCell';
import KamiCursor from './KamiCursor';

interface Props {
  connecting: boolean;
  onConnectSolflare: () => void;
  onUseAnotherWallet: () => void;
}

export default function HeroCell({ connecting, onConnectSolflare, onUseAnotherWallet }: Props) {
  return (
    <BentoCell
      delay={1}
      className="col-span-12 lg:col-span-8 lg:row-span-2 rounded-[2rem] flex flex-col gap-8 lg:gap-12 min-h-[24rem] lg:min-h-[28rem]"
      as="section"
    >
      <div className="flex-1 flex flex-col gap-6">
        <span className="self-start inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-kami-sepiaBg border border-kami-cellBorder font-mono text-xs text-kami-creamMuted">
          <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
          env / mainnet-beta
        </span>
        <h1 className="font-display font-bold tracking-tight text-kami-cream text-5xl sm:text-6xl lg:text-7xl xl:text-[5rem] leading-[0.95]">
          <span className="block">Type. Sign.</span>
          <span className="block">
            Done
            <KamiCursor />
          </span>
        </h1>
        <p className="font-sans text-kami-cream/80 text-lg lg:text-xl max-w-xl leading-relaxed">
          Speak plain English. Kami parses your intent, calls Kamino{' '}
          <code className="font-mono text-kami-amber not-italic">klend-sdk</code> primitives, and
          queues a mainnet transaction. No dashboard scraping required.
        </p>
      </div>

      <div className="border-t border-kami-cellBorder/50 pt-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="font-mono text-sm text-kami-creamMuted px-4 py-3 rounded-xl bg-kami-sepiaBg/60 border border-kami-cellBorder">
          <span className="text-kami-amber/80">&gt; </span>find best USDC yield
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <button
            type="button"
            onClick={onConnectSolflare}
            disabled={connecting}
            className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-kami-amber text-kami-sepiaBg font-mono uppercase tracking-wider text-sm font-bold hover:opacity-95 active:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-wait"
          >
            <Wallet className="w-5 h-5" aria-hidden="true" />
            {connecting ? 'Opening Solflare…' : 'Connect with Solflare'}
          </button>
          <button
            type="button"
            onClick={onUseAnotherWallet}
            className="text-xs text-kami-creamMuted hover:text-kami-cream transition-colors"
          >
            Use another Solana wallet
          </button>
        </div>
      </div>
    </BentoCell>
  );
}
