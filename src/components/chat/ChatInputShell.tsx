import React, { useState, useRef, useEffect } from 'react';
import { Square, ArrowUp } from 'lucide-react';
import SuggestionChip from './SuggestionChip';

interface Props {
  onSend: (msg: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

const SUGGESTIONS = [
  'Show me my Kamino portfolio',
  "What's the best USDC supply APY on Kamino right now?",
  'Deposit 0.1 USDC into Kamino',
  'Simulate my health factor if I borrow 5 USDC',
];

export default function ChatInputShell({ onSend, onStop, isStreaming, disabled }: Props) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const handleSubmit = (text?: string) => {
    const value = (text ?? input).trim();
    if (!value || disabled) return;
    onSend(value);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-kami-cellBorder bg-kami-sepiaBg/80 backdrop-blur-sm px-4 py-4">
      {!disabled && input === '' && !isStreaming && (
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1 max-w-3xl mx-auto no-scrollbar">
          {SUGGESTIONS.map((s) => (
            <SuggestionChip key={s} label={s} onClick={() => handleSubmit(s)} />
          ))}
        </div>
      )}
      <div className="max-w-3xl mx-auto bg-kami-cellBase border border-kami-cellBorder rounded-2xl p-2 flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Kami about DeFi…"
          rows={1}
          disabled={disabled}
          className="flex-1 bg-transparent outline-none border-none resize-none px-3 py-2 text-sm text-kami-cream placeholder-kami-creamMuted/60 max-h-[160px] no-scrollbar"
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop streaming"
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-kami-amber/15 border border-kami-amber/40 text-kami-amber hover:bg-kami-amber/25 transition-colors flex items-center justify-center"
          >
            <Square className="w-4 h-4 fill-current" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={!input.trim() || disabled}
            aria-label="Send message"
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-kami-amber text-kami-sepiaBg disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-95 transition-opacity flex items-center justify-center"
          >
            <ArrowUp className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="text-center text-[10px] text-kami-creamMuted/70 mt-2 max-w-3xl mx-auto">
        Kami provides information only. Always verify before signing transactions.
      </p>
    </div>
  );
}
