import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SuggestionChip from './SuggestionChip';

describe('SuggestionChip', () => {
  it('renders the label', () => {
    render(<SuggestionChip label="Show me my Kamino portfolio" onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: /show me my kamino portfolio/i })).toBeInTheDocument();
  });

  it('fires onClick when clicked', () => {
    const onClick = vi.fn();
    render(<SuggestionChip label="hello" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: /hello/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
