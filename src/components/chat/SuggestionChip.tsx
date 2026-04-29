interface Props {
  label: string;
  onClick: () => void;
}

export default function SuggestionChip({ label, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full border border-kami-cellBorder font-mono text-kami-creamMuted hover:text-kami-amber hover:border-kami-amber/40 hover:bg-kami-amberHaze transition-colors whitespace-nowrap"
    >
      {label}
    </button>
  );
}
