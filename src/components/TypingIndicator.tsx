import React from 'react';

export default function TypingIndicator() {
  return (
    <div className="flex mb-4">
      <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-kami-accent to-purple-400 flex items-center justify-center text-white font-bold text-xs mr-3">
        K
      </div>
      <div className="flex items-center gap-1.5 px-4 py-3 bg-kami-surface rounded-2xl rounded-bl-md border border-kami-border">
        <div className="typing-dot w-2 h-2 rounded-full bg-kami-accent" />
        <div className="typing-dot w-2 h-2 rounded-full bg-kami-accent" />
        <div className="typing-dot w-2 h-2 rounded-full bg-kami-accent" />
      </div>
    </div>
  );
}
