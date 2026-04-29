import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import KeyValueRows from './KeyValueRows';

describe('KeyValueRows', () => {
  it('renders each row with key and value', () => {
    render(
      <KeyValueRows
        rows={[
          { key: 'supply.apy', value: '8.4%' },
          { key: 'borrow.apr', value: '9.1%' },
        ]}
      />
    );
    expect(screen.getByText('supply.apy')).toBeInTheDocument();
    expect(screen.getByText('8.4%')).toBeInTheDocument();
    expect(screen.getByText('borrow.apr')).toBeInTheDocument();
    expect(screen.getByText('9.1%')).toBeInTheDocument();
  });

  it('applies amber accent class when accent="amber"', () => {
    render(<KeyValueRows rows={[{ key: 'k', value: 'v', accent: 'amber' }]} />);
    expect(screen.getByText('v').className).toMatch(/text-kami-amber/);
  });

  it('renders empty state when rows is empty array', () => {
    const { container } = render(<KeyValueRows rows={[]} />);
    expect(container.firstChild).toBeTruthy();
    expect(container.querySelectorAll('div[class*="font-mono"]').length).toBe(0);
  });
});
