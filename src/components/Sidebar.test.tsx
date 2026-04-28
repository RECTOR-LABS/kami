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
