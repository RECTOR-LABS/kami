import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const setVisibleMock = vi.fn();

vi.mock('@solana/wallet-adapter-react-ui', () => ({
  useWalletModal: () => ({ setVisible: setVisibleMock }),
}));

import ConnectWalletButton from './ConnectWalletButton';

describe('ConnectWalletButton', () => {
  it('renders the Connect Wallet label', () => {
    render(<ConnectWalletButton />);
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
  });

  it('opens the wallet modal when clicked', () => {
    setVisibleMock.mockClear();
    render(<ConnectWalletButton />);
    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }));
    expect(setVisibleMock).toHaveBeenCalledWith(true);
    expect(setVisibleMock).toHaveBeenCalledTimes(1);
  });
});
