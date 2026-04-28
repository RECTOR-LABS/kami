import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SponsorStrip from './SponsorStrip';
import { SPONSORS } from '../../lib/landing-content';

describe('SponsorStrip', () => {
  it('renders all 5 sponsor wordmarks', () => {
    render(<SponsorStrip />);
    SPONSORS.forEach((s) => {
      expect(screen.getByText(s)).toBeInTheDocument();
    });
  });

  it('renders sponsors in the canonical order', () => {
    const { container } = render(<SponsorStrip />);
    const text = container.textContent ?? '';
    const indices = SPONSORS.map((s) => text.indexOf(s));
    const sorted = [...indices].sort((a, b) => a - b);
    expect(indices).toEqual(sorted);
  });
});
