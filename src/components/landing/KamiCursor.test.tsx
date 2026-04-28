import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import KamiCursor from './KamiCursor';

describe('KamiCursor', () => {
  it('renders the ▌ glyph', () => {
    render(<KamiCursor />);
    expect(screen.getByText('▌')).toBeInTheDocument();
  });

  it('applies the blink animation class', () => {
    render(<KamiCursor />);
    expect(screen.getByText('▌')).toHaveClass('animate-blink');
  });

  it('uses amber color', () => {
    render(<KamiCursor />);
    expect(screen.getByText('▌')).toHaveClass('text-kami-amber');
  });
});
