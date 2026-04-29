type Accent = 'amber' | 'cream' | 'muted';

interface Row {
  key: string;
  value: string;
  accent?: Accent;
}

interface Props {
  rows: Row[];
}

const ACCENT_CLASS: Record<Accent, string> = {
  amber: 'text-kami-amber',
  cream: 'text-kami-cream',
  muted: 'text-kami-creamMuted',
};

export default function KeyValueRows({ rows }: Props) {
  return (
    <div className="bg-kami-cellElevated border border-kami-cellBorder rounded-2xl p-3">
      {rows.map((row, i) => (
        <div
          key={row.key}
          className={[
            'flex justify-between items-center py-1.5 font-mono text-xs',
            i < rows.length - 1 ? 'border-b border-kami-cellBorder/50' : '',
          ].join(' ')}
        >
          <span className="text-kami-creamMuted">{row.key}</span>
          <span className={ACCENT_CLASS[row.accent ?? 'cream']}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}
