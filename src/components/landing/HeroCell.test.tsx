import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import HeroCell from './HeroCell';

const noop = () => {};

describe('HeroCell', () => {
  it('renders the env chip + headline + cursor', () => {
    render(<HeroCell connecting={false} onConnectSolflare={noop} onUseAnotherWallet={noop} />);
    expect(screen.getByText(/env \/ mainnet-beta/i)).toBeInTheDocument();
    expect(screen.getByText('Type. Sign.')).toBeInTheDocument();
    // Second headline span is "Done" + KamiCursor — its textContent is "Done▌".
    // Use a regex anchored to the start to disambiguate from the parent h1
    // whose textContent collapses both spans.
    expect(screen.getByText(/^Done/)).toBeInTheDocument();
    expect(screen.getByText('▌')).toBeInTheDocument();
  });

  it('renders the subhead with klend-sdk highlighted in mono amber', () => {
    render(<HeroCell connecting={false} onConnectSolflare={noop} onUseAnotherWallet={noop} />);
    const klend = screen.getByText('klend-sdk');
    expect(klend).toBeInTheDocument();
    expect(klend.tagName).toBe('CODE');
    expect(klend).toHaveClass('text-kami-amber');
  });

  it('renders the mock agent input prompt', () => {
    render(<HeroCell connecting={false} onConnectSolflare={noop} onUseAnotherWallet={noop} />);
    expect(screen.getByText(/find best USDC yield/i)).toBeInTheDocument();
  });

  it('fires onConnectSolflare when the CTA is clicked', () => {
    const onConnectSolflare = vi.fn();
    render(
      <HeroCell connecting={false} onConnectSolflare={onConnectSolflare} onUseAnotherWallet={noop} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /connect with solflare/i }));
    expect(onConnectSolflare).toHaveBeenCalledTimes(1);
  });

  it('fires onUseAnotherWallet when the secondary link is clicked', () => {
    const onUseAnotherWallet = vi.fn();
    render(
      <HeroCell connecting={false} onConnectSolflare={noop} onUseAnotherWallet={onUseAnotherWallet} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /use another solana wallet/i }));
    expect(onUseAnotherWallet).toHaveBeenCalledTimes(1);
  });

  it('shows "Opening Solflare…" + disables the CTA when connecting=true', () => {
    render(<HeroCell connecting={true} onConnectSolflare={noop} onUseAnotherWallet={noop} />);
    const cta = screen.getByRole('button', { name: /opening solflare/i });
    expect(cta).toBeDisabled();
  });
});
