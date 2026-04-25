import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function Boom({ msg = 'boom' }: { msg?: string }): JSX.Element {
  throw new Error(msg);
}

describe('ErrorBoundary', () => {
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // React always re-throws to console.error before catching; suppress to
    // keep test output readable.
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errSpy.mockRestore();
  });

  it('renders children when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">healthy</div>
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('child')).toHaveTextContent('healthy');
  });

  it('renders the fallback UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Kami hit a render error/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload kami/i })).toBeInTheDocument();
  });

  it('logs the error to console.error', () => {
    render(
      <ErrorBoundary>
        <Boom msg="unique-test-error" />
      </ErrorBoundary>,
    );
    const calls = errSpy.mock.calls.flat().join(' ');
    expect(calls).toContain('[Kami] uncaught render error');
    expect(calls).toContain('unique-test-error');
  });
});
