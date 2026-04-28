import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SysMetricsCell from './SysMetricsCell';
import { LANDING_STATS } from '../../lib/landing-content';

describe('SysMetricsCell', () => {
  it('renders the sys.metrics header', () => {
    render(<SysMetricsCell delay={2} />);
    expect(screen.getByText('sys.metrics')).toBeInTheDocument();
  });

  it('renders all 4 metric keys + values from LANDING_STATS', () => {
    render(<SysMetricsCell delay={2} />);
    LANDING_STATS.forEach((stat) => {
      expect(screen.getByText(stat.key)).toBeInTheDocument();
      expect(screen.getByText(stat.value)).toBeInTheDocument();
    });
  });

  it('renders the highlighted value (sys.tools_loaded) in amber', () => {
    render(<SysMetricsCell delay={2} />);
    const highlighted = LANDING_STATS.find((s) => s.highlight)!;
    expect(screen.getByText(highlighted.value)).toHaveClass('text-kami-amber');
  });

  it('renders non-highlighted values in cream', () => {
    render(<SysMetricsCell delay={2} />);
    const nonHighlighted = LANDING_STATS.find((s) => !s.highlight)!;
    expect(screen.getByText(nonHighlighted.value)).toHaveClass('text-kami-cream');
  });
});
