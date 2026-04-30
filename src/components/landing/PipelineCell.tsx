import { Terminal, PenLine, CheckCircle2, type LucideIcon } from 'lucide-react';
import BentoCell from '../bento/BentoCell';
import { PIPELINE_STEPS, type PipelineIconKey } from '../../lib/landing-content';

const ICON_MAP: Record<PipelineIconKey, LucideIcon> = {
  intent: Terminal,
  signature: PenLine,
  execution: CheckCircle2,
};

interface Props {
  delay: number;
}

export default function PipelineCell({ delay }: Props) {
  return (
    <BentoCell
      delay={delay}
      className="col-span-12 border-dashed lg:p-10"
    >
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div
          className="hidden lg:block absolute left-0 right-0 top-1/2 h-px bg-kami-cellBorder"
          aria-hidden="true"
        />
        {PIPELINE_STEPS.map((step) => {
          const Icon = ICON_MAP[step.iconKey];
          return (
            <div
              key={step.label}
              className="relative flex items-center gap-4 px-6 py-4 rounded-xl bg-kami-sepiaBg/60 border border-kami-cellBorder hover:border-kami-amber/40 transition-colors group"
            >
              <Icon className="w-6 h-6 text-kami-amber" aria-hidden="true" />
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-[10px] text-kami-creamMuted group-hover:text-kami-amber transition-colors">
                  [{step.index}]
                </span>
                <span className="font-mono text-sm font-bold uppercase tracking-wider text-kami-cream">
                  {step.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </BentoCell>
  );
}
