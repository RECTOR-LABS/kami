import React from 'react';

export default function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-kami-accent to-purple-400 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-6">
          K
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Welcome to Kami</h2>
        <p className="text-sm text-kami-muted mb-8 leading-relaxed">
          Your AI co-pilot for Solana DeFi. Ask about token prices, swap strategies, yield
          farming, liquid staking, or get help building transactions.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
          {[
            { icon: '📊', title: 'Market Data', desc: 'Token prices and analytics' },
            { icon: '🔄', title: 'Swaps', desc: 'Jupiter, Raydium, Orca' },
            { icon: '💰', title: 'Yield', desc: 'Staking and farming strategies' },
            { icon: '🔐', title: 'Security', desc: 'Transaction review and safety' },
          ].map((item) => (
            <div
              key={item.title}
              className="p-3 rounded-xl border border-kami-border bg-kami-surface/50 hover:bg-kami-surface transition-colors"
            >
              <div className="text-lg mb-1">{item.icon}</div>
              <div className="text-sm font-medium text-white">{item.title}</div>
              <div className="text-xs text-kami-muted">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
