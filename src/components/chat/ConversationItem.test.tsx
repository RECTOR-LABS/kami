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

  it('fires onStartRename when Pencil button is clicked', () => {
    const onStartRename = vi.fn();
    render(<ConversationItem {...baseProps} onStartRename={onStartRename} />);
    fireEvent.click(screen.getByLabelText(/rename conversation/i));
    expect(onStartRename).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire onSelect when Pencil button is clicked (stopPropagation)', () => {
    const onSelect = vi.fn();
    const onStartRename = vi.fn();
    render(<ConversationItem {...baseProps} onSelect={onSelect} onStartRename={onStartRename} />);
    fireEvent.click(screen.getByLabelText(/rename conversation/i));
    expect(onStartRename).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('fires onDelete when Trash2 button is clicked', () => {
    const onDelete = vi.fn();
    render(<ConversationItem {...baseProps} onDelete={onDelete} />);
    fireEvent.click(screen.getByLabelText(/delete conversation/i));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire onSelect when Trash2 button is clicked (stopPropagation)', () => {
    const onSelect = vi.fn();
    const onDelete = vi.fn();
    render(<ConversationItem {...baseProps} onSelect={onSelect} onDelete={onDelete} />);
    fireEvent.click(screen.getByLabelText(/delete conversation/i));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('fires onCommitRename when Enter is pressed in rename input', () => {
    const onCommitRename = vi.fn();
    render(
      <ConversationItem
        {...baseProps}
        isEditing={true}
        editingTitle="renamed"
        onCommitRename={onCommitRename}
      />
    );
    const input = screen.getByLabelText(/rename conversation/i);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommitRename).toHaveBeenCalledTimes(1);
  });

  it('fires onCancelRename when Escape is pressed in rename input', () => {
    const onCancelRename = vi.fn();
    render(
      <ConversationItem
        {...baseProps}
        isEditing={true}
        editingTitle="renamed"
        onCancelRename={onCancelRename}
      />
    );
    const input = screen.getByLabelText(/rename conversation/i);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onCancelRename).toHaveBeenCalledTimes(1);
  });

  it('fires onChangeRenameTitle when input value changes', () => {
    const onChangeRenameTitle = vi.fn();
    render(
      <ConversationItem
        {...baseProps}
        isEditing={true}
        editingTitle=""
        onChangeRenameTitle={onChangeRenameTitle}
      />
    );
    const input = screen.getByLabelText(/rename conversation/i);
    fireEvent.change(input, { target: { value: 'new title' } });
    expect(onChangeRenameTitle).toHaveBeenCalledWith('new title');
  });
});
