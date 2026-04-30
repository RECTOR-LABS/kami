import { Loader2, CheckCircle, AlertCircle, Wallet, type LucideIcon } from 'lucide-react';
import type { ToolCallRecord } from '../../types';

type Status = ToolCallRecord['status'];

interface Props {
  name: string;
  status: Status;
  count?: number;
}

const STATUS_ICONS: Record<Status, LucideIcon> = {
  calling: Loader2,
  done: CheckCircle,
  error: AlertCircle,
  'wallet-required': Wallet,
};

const STATUS_ICON_CLASS: Record<Status, string> = {
  calling: 'w-3 h-3 animate-spin',
  done: 'w-3 h-3',
  error: 'w-3 h-3',
  'wallet-required': 'w-3 h-3',
};

export default function ToolBadge({ name, status, count }: Props) {
  const Icon = STATUS_ICONS[status];
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-kami-amber/40 bg-kami-amber/10 text-kami-amber font-mono text-[11px]">
      <Icon className={STATUS_ICON_CLASS[status]} aria-hidden="true" />
      <span>{name}</span>
      {count !== undefined && count > 1 && <span className="opacity-70">×{count}</span>}
    </span>
  );
}
