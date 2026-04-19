import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { ToolCallRecord } from '../types';

const TOOL_LABELS: Record<string, string> = {
  getPortfolio: 'Fetching Kamino portfolio',
};

function labelFor(name: string): string {
  return TOOL_LABELS[name] ?? `Calling ${name}`;
}

interface Props {
  calls: ToolCallRecord[];
}

export default function ToolCallBadges({ calls }: Props) {
  if (calls.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {calls.map((call) => {
        const label = labelFor(call.name);
        if (call.status === 'calling') {
          return (
            <span
              key={call.id}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-kami-accent/10 border border-kami-accent/30 text-xs text-kami-accent"
            >
              <Loader2 className="w-3 h-3 animate-spin" />
              {label}
            </span>
          );
        }
        if (call.status === 'error') {
          return (
            <span
              key={call.id}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-kami-danger/10 border border-kami-danger/30 text-xs text-kami-danger"
              title={call.error ?? 'Tool error'}
            >
              <AlertCircle className="w-3 h-3" />
              {label} failed
            </span>
          );
        }
        return (
          <span
            key={call.id}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-kami-success/10 border border-kami-success/30 text-xs text-kami-success"
          >
            <CheckCircle2 className="w-3 h-3" />
            {label}
          </span>
        );
      })}
    </div>
  );
}
