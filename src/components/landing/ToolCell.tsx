import {
  FolderOpen,
  Wallet,
  ShieldCheck,
  PenLine,
  type LucideIcon,
} from 'lucide-react';
import BentoCell from '../bento/BentoCell';
import type { ToolCellData, ToolIconKey } from '../../lib/landing-content';

const ICON_MAP: Record<ToolIconKey, LucideIcon> = {
  findYield: FolderOpen,
  getPortfolio: Wallet,
  simulateHealth: ShieldCheck,
  buildSign: PenLine,
};

interface Props {
  tool: ToolCellData;
  delay: number;
}

export default function ToolCell({ tool, delay }: Props) {
  const Icon = ICON_MAP[tool.iconKey];
  return (
    <BentoCell
      delay={delay}
      className="col-span-12 sm:col-span-6 lg:col-span-3 flex flex-col gap-3 group"
    >
      <div className="flex items-center gap-2 font-mono text-sm text-kami-amber">
        <Icon className="w-4 h-4" aria-hidden="true" />
        {tool.name}
      </div>
      <p className="font-sans text-sm text-kami-cream/80 leading-relaxed flex-1">
        {tool.description}
      </p>
      <div className="font-mono text-[11px] text-kami-creamMuted px-3 py-2 rounded-lg border border-kami-cellBorder bg-kami-sepiaBg/40 group-hover:border-kami-amber/40 transition-colors break-all">
        {tool.hint}
      </div>
    </BentoCell>
  );
}
