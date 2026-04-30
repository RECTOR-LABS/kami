import { Menu } from 'lucide-react';
import WalletPill from './WalletPill';

interface Props {
  conversationTitle: string;
  onMenuToggle: () => void;
}

export default function ChatHeader({ conversationTitle, onMenuToggle }: Props) {
  return (
    <header className="flex items-center justify-between px-4 lg:px-6 py-3 border-b border-kami-cellBorder bg-kami-sepiaBg/80 backdrop-blur-sm flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onMenuToggle}
          aria-label="Toggle menu"
          className="lg:hidden p-1 text-kami-creamMuted hover:text-kami-cream transition-colors"
        >
          <Menu className="w-5 h-5" aria-hidden="true" />
        </button>
        <div className="flex flex-col min-w-0">
          <span className="hidden sm:block font-mono text-[11px] uppercase tracking-widest text-kami-creamMuted leading-tight mb-0.5">
            &gt; KAMI · v1.0 · MAINNET
          </span>
          <h1 className="font-display font-bold text-base lg:text-lg text-kami-cream leading-none truncate">
            {conversationTitle}
          </h1>
        </div>
        <span className="hidden md:inline-flex items-center gap-1.5 ml-3 font-mono text-[10px] uppercase tracking-widest text-kami-creamMuted">
          [sys.status: online]
          <span
            className="w-1.5 h-1.5 rounded-full bg-kami-amber animate-pulse-dot"
            aria-hidden="true"
          />
        </span>
      </div>
      <WalletPill />
    </header>
  );
}
