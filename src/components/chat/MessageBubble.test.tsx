import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/markdown', () => ({
  Markdown: ({ text }: { text: string }) => <span data-testid="md">{text}</span>,
}));

vi.mock('./TxStatusCard', () => ({
  default: () => <div data-testid="tx-card" />,
}));

vi.mock('../ConnectWalletButton', () => ({
  default: () => <div data-testid="connect-btn" />,
}));

import MessageBubble from './MessageBubble';
import type { ChatMessage } from '../../types';

const userMsg: ChatMessage = {
  id: 'm1',
  role: 'user',
  content: 'find best USDC yield',
  timestamp: 1,
};

const assistantMsg: ChatMessage = {
  id: 'm2',
  role: 'assistant',
  content: 'Kamino Main Market — USDC supply at 8.4% APY.',
  timestamp: 2,
};

describe('MessageBubble', () => {
  it('renders user message right-aligned with amber haze', () => {
    const { container } = render(<MessageBubble message={userMsg} isStreaming={false} />);
    expect(container.querySelector('[class*="justify-end"]')).toBeInTheDocument();
    expect(container.querySelector('[class*="bg-kami-amberHaze"]')).toBeInTheDocument();
    expect(screen.getByText('find best USDC yield')).toBeInTheDocument();
  });

  it('renders assistant message with cellBase background', () => {
    const { container } = render(<MessageBubble message={assistantMsg} isStreaming={false} />);
    expect(container.querySelector('[class*="bg-kami-cellBase"]')).toBeInTheDocument();
    expect(screen.getByTestId('md')).toHaveTextContent(/8.4% APY/);
  });

  it('renders ToolBadge row when assistant message has toolCalls', () => {
    const msg: ChatMessage = {
      ...assistantMsg,
      toolCalls: [{ id: 't1', name: 'tool/findYield', status: 'done' }],
    };
    render(<MessageBubble message={msg} isStreaming={false} />);
    expect(screen.getByText('tool/findYield')).toBeInTheDocument();
  });

  it('appends KamiCursor when assistant is streaming', () => {
    const { container } = render(<MessageBubble message={assistantMsg} isStreaming={true} />);
    expect(container.querySelector('[class*="animate-blink"]')).toBeInTheDocument();
  });
});
