import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SidebarShell from './SidebarShell';
import type { Conversation } from '../../types';

const conversations: Conversation[] = [
  { id: 'c1', title: 'first chat', messages: [], createdAt: 1, updatedAt: 1 },
  { id: 'c2', title: 'second chat', messages: [], createdAt: 2, updatedAt: 2 },
];

const baseProps = {
  conversations,
  activeId: 'c1',
  isOpen: true,
  onSelect: vi.fn(),
  onNew: vi.fn(),
  onDelete: vi.fn(),
  onClose: vi.fn(),
  onClearAll: vi.fn(),
  onRename: vi.fn(),
};

describe('SidebarShell', () => {
  let originalConfirm: typeof window.confirm;
  beforeEach(() => {
    originalConfirm = window.confirm;
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.confirm = originalConfirm;
  });

  it('renders the Kami brand header with amber K avatar', () => {
    const { container } = render(<SidebarShell {...baseProps} />);
    expect(screen.getByText('Kami')).toBeInTheDocument();
    expect(screen.getByText(/v1.0/i)).toBeInTheDocument();
    expect(container.querySelector('[class*="bg-kami-amber"]')).toBeInTheDocument();
  });

  it('renders conversation list', () => {
    render(<SidebarShell {...baseProps} />);
    expect(screen.getByText('first chat')).toBeInTheDocument();
    expect(screen.getByText('second chat')).toBeInTheDocument();
  });

  it('fires onNew when New Chat is clicked', () => {
    const onNew = vi.fn();
    render(<SidebarShell {...baseProps} onNew={onNew} />);
    fireEvent.click(screen.getByRole('button', { name: /new chat/i }));
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it('opens settings menu and shows Clear all option', () => {
    render(<SidebarShell {...baseProps} />);
    fireEvent.click(screen.getByLabelText(/settings/i));
    expect(screen.getByRole('button', { name: /clear all conversations/i })).toBeInTheDocument();
  });

  it('fires onClearAll after window.confirm accepts', () => {
    const onClearAll = vi.fn();
    window.confirm = vi.fn(() => true);
    render(<SidebarShell {...baseProps} onClearAll={onClearAll} />);
    fireEvent.click(screen.getByLabelText(/settings/i));
    fireEvent.click(screen.getByRole('button', { name: /clear all conversations/i }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it('does not fire onClearAll when window.confirm declines', () => {
    const onClearAll = vi.fn();
    window.confirm = vi.fn(() => false);
    render(<SidebarShell {...baseProps} onClearAll={onClearAll} />);
    fireEvent.click(screen.getByLabelText(/settings/i));
    fireEvent.click(screen.getByRole('button', { name: /clear all conversations/i }));
    expect(onClearAll).not.toHaveBeenCalled();
  });
});
