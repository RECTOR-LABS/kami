import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PipelineCell from './PipelineCell';

describe('PipelineCell', () => {
  it('renders all 3 step labels', () => {
    render(<PipelineCell delay={8} />);
    expect(screen.getByText('INTENT')).toBeInTheDocument();
    expect(screen.getByText('SIGNATURE')).toBeInTheDocument();
    expect(screen.getByText('EXECUTION')).toBeInTheDocument();
  });

  it('renders all 3 step indices in [N/3] form', () => {
    render(<PipelineCell delay={8} />);
    expect(screen.getByText('[1/3]')).toBeInTheDocument();
    expect(screen.getByText('[2/3]')).toBeInTheDocument();
    expect(screen.getByText('[3/3]')).toBeInTheDocument();
  });

  it('renders 3 lucide svg icons (one per step)', () => {
    const { container } = render(<PipelineCell delay={8} />);
    expect(container.querySelectorAll('svg')).toHaveLength(3);
  });
});
