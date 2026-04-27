import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ToolCallBadges from './ToolCallBadges';
import type { ToolCallRecord } from '../types';

const baseCall = (overrides: Partial<ToolCallRecord>): ToolCallRecord => ({
  id: 'tc-1',
  name: 'getPortfolio',
  status: 'calling',
  ...overrides,
});

describe('ToolCallBadges', () => {
  it('renders nothing when calls is empty', () => {
    const { container } = render(<ToolCallBadges calls={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders calling state with the friendly label', () => {
    render(<ToolCallBadges calls={[baseCall({ status: 'calling' })]} />);
    expect(screen.getByText('Fetching Kamino portfolio')).toBeInTheDocument();
  });

  it('renders done state with the friendly label', () => {
    render(<ToolCallBadges calls={[baseCall({ status: 'done' })]} />);
    expect(screen.getByText('Fetching Kamino portfolio')).toBeInTheDocument();
  });

  it('renders error state with "failed" suffix', () => {
    render(<ToolCallBadges calls={[baseCall({ status: 'error', error: 'boom' })]} />);
    expect(screen.getByText('Fetching Kamino portfolio failed')).toBeInTheDocument();
  });

  it('renders wallet-required state as a neutral "Wallet required" pill', () => {
    render(<ToolCallBadges calls={[baseCall({ status: 'wallet-required' })]} />);
    expect(screen.getByText('Wallet required')).toBeInTheDocument();
    // Friendly label suppressed for wallet-required — pill speaks for itself
    expect(screen.queryByText('Fetching Kamino portfolio')).not.toBeInTheDocument();
    expect(screen.queryByText(/failed/i)).not.toBeInTheDocument();
  });

  it('merges two consecutive same-name + same-status calls into one pill with ×2 suffix', () => {
    render(
      <ToolCallBadges
        calls={[
          baseCall({ id: 'tc-1', status: 'done' }),
          baseCall({ id: 'tc-2', status: 'done' }),
        ]}
      />,
    );
    expect(screen.getByText('Fetching Kamino portfolio ×2')).toBeInTheDocument();
    // single rendered pill — verify only one matches
    expect(screen.getAllByText(/Fetching Kamino portfolio/)).toHaveLength(1);
  });

  it('does NOT merge consecutive same-name calls with different statuses', () => {
    render(
      <ToolCallBadges
        calls={[
          baseCall({ id: 'tc-1', status: 'calling' }),
          baseCall({ id: 'tc-2', status: 'done' }),
        ]}
      />,
    );
    // both pills present, neither has ×N suffix
    expect(screen.getAllByText('Fetching Kamino portfolio')).toHaveLength(2);
    expect(screen.queryByText(/×/)).not.toBeInTheDocument();
  });

  it('does NOT merge non-consecutive same-name+status calls (A, B, A renders as 3 pills)', () => {
    render(
      <ToolCallBadges
        calls={[
          baseCall({ id: 'tc-1', name: 'getPortfolio', status: 'done' }),
          baseCall({ id: 'tc-2', name: 'findYield', status: 'done' }),
          baseCall({ id: 'tc-3', name: 'getPortfolio', status: 'done' }),
        ]}
      />,
    );
    expect(screen.getAllByText('Fetching Kamino portfolio')).toHaveLength(2);
    expect(screen.getByText('Scanning yield opportunities')).toBeInTheDocument();
    expect(screen.queryByText(/×/)).not.toBeInTheDocument();
  });
});
