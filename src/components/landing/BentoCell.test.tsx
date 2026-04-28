import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BentoCell from './BentoCell';

describe('BentoCell', () => {
  it('renders children', () => {
    render(
      <BentoCell delay={1}>
        <span>inner content</span>
      </BentoCell>,
    );
    expect(screen.getByText('inner content')).toBeInTheDocument();
  });

  it('applies the className prop alongside cell base classes', () => {
    const { container } = render(
      <BentoCell delay={1} className="col-span-8 row-span-2">
        x
      </BentoCell>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('col-span-8');
    expect(root.className).toContain('row-span-2');
    expect(root.className).toContain('animate-cascade-up');
  });

  it('sets animationDelay from the delay prop (delay × 100ms)', () => {
    const { container } = render(<BentoCell delay={3}>x</BentoCell>);
    const root = container.firstChild as HTMLElement;
    expect(root.style.animationDelay).toBe('300ms');
  });

  it('renders as <div> by default and accepts a different element via the `as` prop', () => {
    const { container, rerender } = render(<BentoCell delay={1}>x</BentoCell>);
    expect((container.firstChild as HTMLElement).tagName).toBe('DIV');

    rerender(
      <BentoCell delay={1} as="section">
        x
      </BentoCell>,
    );
    expect((container.firstChild as HTMLElement).tagName).toBe('SECTION');
  });
});
