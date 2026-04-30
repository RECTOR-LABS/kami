import { ArrowLeftRight, ArrowUpRight, Check } from 'lucide-react';
import BentoCell from '../bento/BentoCell';
import { LATEST_TX } from '../../lib/landing-content';

interface Props {
  delay: number;
}

export default function LatestTxCell({ delay }: Props) {
  return (
    <BentoCell
      delay={delay}
      className="col-span-12 md:col-span-6 lg:col-span-4 bg-kami-cellElevated"
    >
      {/* bg-kami-cellElevated overrides BentoCell's default bg-kami-cellBase via Tailwind class-emit order. */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-kami-creamMuted">
          <ArrowLeftRight className="w-4 h-4" aria-hidden="true" />
          log.latest_tx
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-kami-amberHaze border border-kami-amber/40 text-kami-amber font-mono text-[10px] uppercase tracking-wider">
          <Check className="w-3 h-3" aria-hidden="true" />
          Confirmed
        </span>
      </div>
      <div className="rounded-xl border border-kami-cellBorder bg-kami-sepiaBg/40 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-kami-creamMuted">
            Signature
          </span>
          <a
            href={LATEST_TX.solscanUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View Solscan transaction ${LATEST_TX.shortSignature}`}
            className="font-mono text-sm text-kami-cream hover:text-kami-amber transition-colors inline-flex items-center gap-1"
          >
            {LATEST_TX.shortSignature}
            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        </div>
        <hr className="border-kami-cellBorder/50" />
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-kami-amber flex-shrink-0" aria-hidden="true" />
          <span className="font-sans text-sm text-kami-cream/90">{LATEST_TX.action}</span>
        </div>
      </div>
    </BentoCell>
  );
}
