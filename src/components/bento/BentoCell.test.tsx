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

  it('applies full variant defaults (rounded-3xl + p-6 lg:p-8)', () => {
    render(
      <BentoCell delay={1} variant="full">
        <span>variant-full</span>
      </BentoCell>
    );
    const cell = screen.getByText('variant-full').parentElement!;
    expect(cell.className).toMatch(/rounded-3xl/);
    expect(cell.className).toMatch(/p-6/);
    expect(cell.className).toMatch(/lg:p-8/);
    expect(cell.className).toMatch(/animate-cascade-up/);
  });

  it('applies compact variant (rounded-3xl + p-4 lg:p-5 + 600ms cascade)', () => {
    render(
      <BentoCell delay={1} variant="compact">
        <span>variant-compact</span>
      </BentoCell>
    );
    const cell = screen.getByText('variant-compact').parentElement!;
    expect(cell.className).toMatch(/rounded-3xl/);
    expect(cell.className).toMatch(/p-4/);
    expect(cell.className).toMatch(/lg:p-5/);
    expect(cell.className).toMatch(/animate-cascade-up-compact/);
  });

  it('applies mini variant (rounded-2xl + p-3, no cascade by default)', () => {
    render(
      <BentoCell delay={1} variant="mini">
        <span>variant-mini</span>
      </BentoCell>
    );
    const cell = screen.getByText('variant-mini').parentElement!;
    expect(cell.className).toMatch(/rounded-2xl/);
    expect(cell.className).toMatch(/p-3/);
    expect(cell.className).not.toMatch(/animate-cascade-up/);
  });

  it('animate=false skips cascade-up class regardless of variant', () => {
    render(
      <BentoCell delay={1} variant="full" animate={false}>
        <span>no-anim</span>
      </BentoCell>
    );
    const cell = screen.getByText('no-anim').parentElement!;
    expect(cell.className).not.toMatch(/animate-cascade-up/);
  });

  it('animate=true on mini explicitly opts into cascade animation', () => {
    render(
      <BentoCell delay={1} variant="mini" animate={true}>
        <span>opt-in-anim</span>
      </BentoCell>
    );
    const cell = screen.getByText('opt-in-anim').parentElement!;
    expect(cell.className).toMatch(/animate-cascade-up-mini/);
  });

  it('default variant is full when prop omitted (back-compat)', () => {
    render(
      <BentoCell delay={1}>
        <span>default</span>
      </BentoCell>
    );
    const cell = screen.getByText('default').parentElement!;
    expect(cell.className).toMatch(/rounded-3xl/);
    expect(cell.className).toMatch(/p-6/);
    expect(cell.className).toMatch(/animate-cascade-up/);
  });
});
