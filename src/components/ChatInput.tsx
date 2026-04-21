import React, { useState, useRef, useEffect } from 'react';

interface Props {
  onSend: (message: string) => void;
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

export default function ChatInput({ onSend, onStop, isStreaming, disabled }: Props) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const handleSubmit = () => {
    if (!input.trim() || disabled) return;
    onSend(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-kami-border bg-kami-bg/80 backdrop-blur-sm px-4 py-4">
      {!disabled && input === '' && !isStreaming && (
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1 no-scrollbar">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => onSend(s)}
              className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full border border-kami-border text-kami-muted hover:text-kami-text hover:border-kami-accent/40 transition-colors whitespace-nowrap"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-3 max-w-3xl mx-auto">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Kami about DeFi..."
            rows={1}
            disabled={disabled}
            className="w-full resize-none bg-kami-surface border border-kami-border rounded-xl px-4 py-3 pr-12 text-sm text-kami-text placeholder-kami-muted focus:outline-none focus:border-kami-accent/50 focus:ring-1 focus:ring-kami-accent/20 transition-all disabled:opacity-50"
          />
        </div>
        {isStreaming ? (
          <button
            onClick={onStop}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-kami-danger/20 border border-kami-danger/30 text-kami-danger hover:bg-kami-danger/30 transition-colors flex items-center justify-center"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || disabled}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-kami-accent hover:bg-kami-accentHover disabled:opacity-30 disabled:hover:bg-kami-accent text-white transition-colors flex items-center justify-center"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
      <p className="text-center text-[10px] text-kami-muted mt-2 max-w-3xl mx-auto">
        Kami provides information only. Always verify before signing transactions.
      </p>
    </div>
  );
}
