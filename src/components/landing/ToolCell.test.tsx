import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ToolCell from './ToolCell';
import { TOOL_CELLS } from '../../lib/landing-content';

describe('ToolCell', () => {
  it('renders name + description + hint', () => {
    const tool = TOOL_CELLS[0]; // tool/findYield
    render(<ToolCell tool={tool} delay={4} />);
    expect(screen.getByText(tool.name)).toBeInTheDocument();
    expect(screen.getByText(tool.description)).toBeInTheDocument();
    expect(screen.getByText(tool.hint)).toBeInTheDocument();
  });

  it('renders an icon (lucide svg)', () => {
    const { container } = render(<ToolCell tool={TOOL_CELLS[0]} delay={4} />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('renders all 4 TOOL_CELLS by name when mapped', () => {
    render(
      <>
        {TOOL_CELLS.map((t, i) => (
          <ToolCell key={t.name} tool={t} delay={4 + i} />
        ))}
      </>,
    );
    expect(screen.getByText('tool/findYield')).toBeInTheDocument();
    expect(screen.getByText('tool/getPortfolio')).toBeInTheDocument();
    expect(screen.getByText('tool/simulateHealth')).toBeInTheDocument();
    expect(screen.getByText('tool/buildSign')).toBeInTheDocument();
  });
});
