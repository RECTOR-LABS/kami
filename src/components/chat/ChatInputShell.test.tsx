import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ChatInputShell from './ChatInputShell';

describe('ChatInputShell', () => {
  it('renders the textarea with placeholder', () => {
    render(
      <ChatInputShell onSend={vi.fn()} onStop={vi.fn()} isStreaming={false} />
    );
    expect(screen.getByPlaceholderText(/ask kami about defi/i)).toBeInTheDocument();
  });

  it('renders suggestion chips when input is empty and not streaming', () => {
    render(
      <ChatInputShell onSend={vi.fn()} onStop={vi.fn()} isStreaming={false} />
    );
    expect(screen.getByRole('button', { name: /show me my kamino portfolio/i })).toBeInTheDocument();
  });

  it('hides suggestion chips when streaming', () => {
    render(<ChatInputShell onSend={vi.fn()} onStop={vi.fn()} isStreaming={true} />);
    expect(screen.queryByRole('button', { name: /show me my kamino portfolio/i })).not.toBeInTheDocument();
  });

  it('fires onSend with input text on Enter', () => {
    const onSend = vi.fn();
    render(<ChatInputShell onSend={onSend} onStop={vi.fn()} isStreaming={false} />);
    const textarea = screen.getByPlaceholderText(/ask kami about defi/i);
    fireEvent.change(textarea, { target: { value: 'test query' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(onSend).toHaveBeenCalledWith('test query');
  });

  it('fires onStop when stop button is clicked while streaming', () => {
    const onStop = vi.fn();
    render(<ChatInputShell onSend={vi.fn()} onStop={onStop} isStreaming={true} />);
    fireEvent.click(screen.getByLabelText(/stop streaming/i));
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});
