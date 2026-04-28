import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Sidebar from './Sidebar';
import type { Conversation } from '../types';

const originalConfirm = window.confirm;

const sampleConvs: Conversation[] = [
  { id: 'c1', title: 'first chat', messages: [], createdAt: 1, updatedAt: 1 },
  { id: 'c2', title: 'second chat', messages: [], createdAt: 2, updatedAt: 2 },
];

const noopProps = {
  conversations: sampleConvs,
  activeId: 'c1',
  isOpen: true,
  onSelect: vi.fn(),
  onNew: vi.fn(),
  onDelete: vi.fn(),
  onClose: vi.fn(),
  onClearAll: vi.fn(),
  onRename: vi.fn(),
};

describe('Sidebar settings menu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.confirm = originalConfirm;
  });

  it('opens and closes the settings popover when the gear is clicked', () => {
    render(<Sidebar {...noopProps} />);

    expect(screen.queryByRole('button', { name: /clear all conversations/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    expect(screen.getByRole('button', { name: /clear all conversations/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    expect(screen.queryByRole('button', { name: /clear all conversations/i })).not.toBeInTheDocument();
  });

  it('calls onClearAll after the user confirms the native dialog', () => {
    const onClearAll = vi.fn();
    // happy-dom doesn't define window.confirm natively; assign a mock directly.
    window.confirm = vi.fn(() => true);

    render(<Sidebar {...noopProps} onClearAll={onClearAll} />);

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    fireEvent.click(screen.getByRole('button', { name: /clear all conversations/i }));

    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });
});

describe('Sidebar rename', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('switches the row to an inline input when the pencil is clicked', () => {
    render(<Sidebar {...noopProps} />);

    expect(screen.queryByRole('textbox', { name: /rename conversation/i })).not.toBeInTheDocument();

    const pencilButtons = screen.getAllByRole('button', { name: /rename conversation/i });
    fireEvent.click(pencilButtons[0]);

    const input = screen.getByRole('textbox', { name: /rename conversation/i });
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('first chat');
  });

  it('calls onRename and commits when Enter is pressed', () => {
    const onRename = vi.fn();
    render(<Sidebar {...noopProps} onRename={onRename} />);

    const pencilButtons = screen.getAllByRole('button', { name: /rename conversation/i });
    fireEvent.click(pencilButtons[0]);

    const input = screen.getByRole('textbox', { name: /rename conversation/i });
    fireEvent.change(input, { target: { value: 'updated title' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onRename).toHaveBeenCalledWith('c1', 'updated title');
    expect(screen.queryByRole('textbox', { name: /rename conversation/i })).not.toBeInTheDocument();
  });

  it('cancels without calling onRename when Escape is pressed', () => {
    const onRename = vi.fn();
    render(<Sidebar {...noopProps} onRename={onRename} />);

    const pencilButtons = screen.getAllByRole('button', { name: /rename conversation/i });
    fireEvent.click(pencilButtons[0]);

    const input = screen.getByRole('textbox', { name: /rename conversation/i });
    fireEvent.change(input, { target: { value: 'changed but cancelled' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox', { name: /rename conversation/i })).not.toBeInTheDocument();
  });
});
