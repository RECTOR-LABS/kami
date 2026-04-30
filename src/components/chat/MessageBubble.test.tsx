import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/markdown', () => ({
  Markdown: ({ text }: { text: string }) => <span data-testid="md">{text}</span>,
}));

const txCardProps = vi.hoisted(() => ({ lastOnStatusChange: null as ((p: unknown) => void) | null }));

vi.mock('./TxStatusCard', () => ({
  default: ({ onStatusChange }: { onStatusChange?: (p: unknown) => void }) => {
    txCardProps.lastOnStatusChange = onStatusChange ?? null;
    return <div data-testid="tx-card" />;
  },
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

  it('renders ConnectWalletButton when toolCalls have wallet-required status', () => {
    const msg: ChatMessage = {
      ...assistantMsg,
      toolCalls: [{ id: 't1', name: 'tool/deposit', status: 'wallet-required' }],
    };
    render(<MessageBubble message={msg} isStreaming={false} />);
    expect(screen.getByTestId('connect-btn')).toBeInTheDocument();
  });

  it('renders TxStatusCard when message has pendingTransaction', () => {
    const msg: ChatMessage = {
      ...assistantMsg,
      pendingTransaction: {
        action: 'deposit',
        protocol: 'Kamino',
        symbol: 'USDC',
        amount: 5,
        reserveAddress: 'D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59',
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        summary: 'Deposit 5 USDC to Kamino Main Market',
        base64Txn: 'AQAAAA==',
        blockhash: '11111111111111111111111111111111',
        lastValidBlockHeight: '300000000',
      },
    };
    render(<MessageBubble message={msg} isStreaming={false} />);
    expect(screen.getByTestId('tx-card')).toBeInTheDocument();
  });

  it('renders KamiCursor alone (no Markdown) when waiting for first token', () => {
    const msg: ChatMessage = {
      id: 'm-empty',
      role: 'assistant',
      content: '',
      timestamp: 0,
    };
    const { container } = render(<MessageBubble message={msg} isStreaming={true} />);
    expect(container.querySelector('[class*="animate-blink"]')).toBeInTheDocument();
    expect(screen.queryByTestId('md')).not.toBeInTheDocument();
  });

  it('forwards onPendingTransactionChange to TxStatusCard, capturing message id in closure', () => {
    const onPendingTransactionChange = vi.fn();
    const msg: ChatMessage = {
      ...assistantMsg,
      id: 'msg-with-tx',
      pendingTransaction: {
        action: 'deposit',
        protocol: 'Kamino',
        symbol: 'USDC',
        amount: 5,
        reserveAddress: 'r1',
        mint: 'm1',
        summary: 's1',
        base64Txn: 'AAAA',
        blockhash: 'b1',
        lastValidBlockHeight: '100',
      },
    };
    render(
      <MessageBubble
        message={msg}
        isStreaming={false}
        onPendingTransactionChange={onPendingTransactionChange}
      />
    );

    // The mock captured the closure that the parent passed to TxStatusCard.
    expect(txCardProps.lastOnStatusChange).toBeDefined();
    txCardProps.lastOnStatusChange!({ status: 'confirmed' });

    // The closure invoked the parent callback with the message id.
    expect(onPendingTransactionChange).toHaveBeenCalledWith('msg-with-tx', { status: 'confirmed' });
  });

  it('passes undefined onStatusChange when onPendingTransactionChange is omitted', () => {
    const msg: ChatMessage = {
      ...assistantMsg,
      pendingTransaction: {
        action: 'deposit',
        protocol: 'Kamino',
        symbol: 'USDC',
        amount: 5,
        reserveAddress: 'r1',
        mint: 'm1',
        summary: 's1',
        base64Txn: 'AAAA',
        blockhash: 'b1',
        lastValidBlockHeight: '100',
      },
    };
    txCardProps.lastOnStatusChange = null; // reset before render
    render(<MessageBubble message={msg} isStreaming={false} />);
    expect(txCardProps.lastOnStatusChange).toBeNull();
  });
});
