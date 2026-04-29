import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ToolBadge from './ToolBadge';

describe('ToolBadge', () => {
  it('renders the tool name', () => {
    render(<ToolBadge name="tool/findYield" status="done" />);
    expect(screen.getByText('tool/findYield')).toBeInTheDocument();
  });

  it('renders Loader2 icon for calling status', () => {
    const { container } = render(<ToolBadge name="tool/x" status="calling" />);
    expect(container.querySelector('svg')).toBeTruthy();
    // Loader2 from lucide-react v0.460 renders class `lucide-loader-circle`
    expect(container.innerHTML).toMatch(/lucide-loader/i);
  });

  it('renders CheckCircle icon for done status', () => {
    const { container } = render(<ToolBadge name="tool/x" status="done" />);
    // CheckCircle from lucide-react v0.460 renders class `lucide-circle-check-big`
    expect(container.innerHTML).toMatch(/lucide-circle-check|lucide-check-circle/i);
  });

  it('renders AlertCircle icon for error status', () => {
    const { container } = render(<ToolBadge name="tool/x" status="error" />);
    // AlertCircle from lucide-react v0.460 renders class `lucide-circle-alert`
    expect(container.innerHTML).toMatch(/lucide-circle-alert|lucide-alert-circle/i);
  });

  it('renders Wallet icon for wallet-required status', () => {
    const { container } = render(<ToolBadge name="tool/x" status="wallet-required" />);
    expect(container.innerHTML).toMatch(/lucide-wallet/i);
  });

  it('omits ×N suffix when count is 1 or undefined', () => {
    render(<ToolBadge name="tool/x" status="done" count={1} />);
    expect(screen.queryByText(/×/)).not.toBeInTheDocument();
  });

  it('renders ×N suffix when count is greater than 1', () => {
    render(<ToolBadge name="tool/x" status="done" count={3} />);
    expect(screen.getByText('×3')).toBeInTheDocument();
  });
});
