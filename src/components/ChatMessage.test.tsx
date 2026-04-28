import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@solana/wallet-adapter-react-ui', () => ({
  useWalletModal: () => ({ setVisible: vi.fn() }),
}));

import ChatMessage from './ChatMessage';
import type { ChatMessage as ChatMessageType } from '../types';

const assistantMsg = (overrides: Partial<ChatMessageType>): ChatMessageType => ({
  id: 'm-1',
  role: 'assistant',
  content: 'Hi there.',
  timestamp: 0,
  ...overrides,
});

describe('ChatMessage', () => {
  it('renders the assistant content', () => {
    render(<ChatMessage message={assistantMsg({})} />);
    expect(screen.getByText('Hi there.')).toBeInTheDocument();
  });

  it('renders the inline Connect Wallet CTA when any tool call is wallet-required', () => {
    render(
      <ChatMessage
        message={assistantMsg({
          toolCalls: [
            { id: 'tc-1', name: 'getPortfolio', status: 'wallet-required' },
          ],
        })}
      />
    );
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
  });

  it('does not render the CTA when no tool call is wallet-required', () => {
    render(
      <ChatMessage
        message={assistantMsg({
          toolCalls: [{ id: 'tc-1', name: 'getPortfolio', status: 'done' }],
        })}
      />
    );
    expect(screen.queryByRole('button', { name: /connect wallet/i })).not.toBeInTheDocument();
  });

  it('does not render the CTA when toolCalls is undefined', () => {
    render(<ChatMessage message={assistantMsg({})} />);
    expect(screen.queryByRole('button', { name: /connect wallet/i })).not.toBeInTheDocument();
  });

  it('renders 3 pulsing dots when content is empty and no tool calls', () => {
    const { container } = render(
      <ChatMessage message={assistantMsg({ content: '' })} />
    );
    const dots = container.querySelectorAll('.typing-dot');
    expect(dots.length).toBe(3);
    // No empty markdown body alongside dots
    expect(screen.queryByText('Hi there.')).not.toBeInTheDocument();
  });

  it('hides the dots once content arrives (re-render with content)', () => {
    const { container, rerender } = render(
      <ChatMessage message={assistantMsg({ content: '' })} />
    );
    expect(container.querySelectorAll('.typing-dot').length).toBe(3);

    rerender(<ChatMessage message={assistantMsg({ content: 'Hello world.' })} />);
    expect(container.querySelectorAll('.typing-dot').length).toBe(0);
    expect(screen.getByText('Hello world.')).toBeInTheDocument();
  });
});
