import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './markdown-renderer';

describe('markdown-renderer risk chips', () => {
  it('renders red "High risk" chip for `:risk-high:`', () => {
    render(<>{renderMarkdown('Watch out: `:risk-high:` here.')}</>);
    const chip = screen.getByText('High risk');
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveClass('text-kami-danger');
  });

  it('renders amber "Medium risk" chip for `:risk-medium:`', () => {
    render(<>{renderMarkdown('Caution: `:risk-medium:` ahead.')}</>);
    const chip = screen.getByText('Medium risk');
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveClass('text-amber-400');
  });

  it('renders green "Low risk" chip for `:risk-low:`', () => {
    render(<>{renderMarkdown('Safe: `:risk-low:` to note.')}</>);
    const chip = screen.getByText('Low risk');
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveClass('text-kami-success');
  });

  it('falls through to inline-code rendering for unknown risk markers', () => {
    render(<>{renderMarkdown('Unknown: `:risk-extreme:` here.')}</>);
    const code = screen.getByText(':risk-extreme:');
    expect(code).toBeInTheDocument();
    expect(code).toHaveClass('text-kami-amber');
    expect(screen.queryByText('Extreme risk')).not.toBeInTheDocument();
  });

  it('renders regular inline code unchanged (no chip styling)', () => {
    render(<>{renderMarkdown('Call `findYield` to scan reserves.')}</>);
    const code = screen.getByText('findYield');
    expect(code).toBeInTheDocument();
    expect(code).toHaveClass('text-kami-amber');
    expect(code).not.toHaveClass('text-kami-danger');
    expect(code).not.toHaveClass('text-amber-400');
    expect(code).not.toHaveClass('text-kami-success');
  });
});
