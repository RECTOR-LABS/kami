import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import LatestTxCell from './LatestTxCell';
import { LATEST_TX } from '../../lib/landing-content';

describe('LatestTxCell', () => {
  it('renders the log.latest_tx header + Confirmed pill', () => {
    render(<LatestTxCell delay={3} />);
    expect(screen.getByText('log.latest_tx')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });

  it('renders the truncated signature', () => {
    render(<LatestTxCell delay={3} />);
    expect(screen.getByText(LATEST_TX.shortSignature)).toBeInTheDocument();
  });

  it('renders the action description', () => {
    render(<LatestTxCell delay={3} />);
    expect(screen.getByText(LATEST_TX.action)).toBeInTheDocument();
  });

  it('Solscan link points to the full signature with safe target/rel', () => {
    render(<LatestTxCell delay={3} />);
    const link = screen.getByRole('link', { name: /view solscan transaction/i });
    expect(link).toHaveAttribute('href', LATEST_TX.solscanUrl);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
