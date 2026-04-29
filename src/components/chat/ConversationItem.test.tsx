import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ConversationItem from './ConversationItem';
import type { Conversation } from '../../types';

const conv: Conversation = {
  id: 'c1',
  title: 'USDC yield matrix',
  messages: [],
  createdAt: 1,
  updatedAt: 1,
};

const baseProps = {
  conversation: conv,
  isActive: false,
  isEditing: false,
  editingTitle: '',
  onSelect: vi.fn(),
  onStartRename: vi.fn(),
  onCommitRename: vi.fn(),
  onCancelRename: vi.fn(),
  onChangeRenameTitle: vi.fn(),
  onDelete: vi.fn(),
};

describe('ConversationItem', () => {
  it('renders conversation title', () => {
    render(<ConversationItem {...baseProps} />);
    expect(screen.getByText('USDC yield matrix')).toBeInTheDocument();
  });

  it('applies active styling when isActive is true', () => {
    render(<ConversationItem {...baseProps} isActive={true} />);
    const cell = screen.getByText('USDC yield matrix').closest('[class*="bg-kami-amberHaze"]');
    expect(cell).toBeInTheDocument();
  });

  it('fires onSelect when row is clicked', () => {
    const onSelect = vi.fn();
    render(<ConversationItem {...baseProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('USDC yield matrix'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('renders rename input when isEditing is true', () => {
    render(
      <ConversationItem
        {...baseProps}
        isEditing={true}
        editingTitle="USDC yield matrix"
      />
    );
    const input = screen.getByLabelText(/rename conversation/i) as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('USDC yield matrix');
  });
});
