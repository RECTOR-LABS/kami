import { Wallet } from 'lucide-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

export default function ConnectWalletButton() {
  const { setVisible } = useWalletModal();
  return (
    <button
      type="button"
      onClick={() => setVisible(true)}
      className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-kami-accent hover:bg-kami-accentHover text-white text-sm font-medium transition-colors"
    >
      <Wallet className="w-4 h-4" />
      Connect Wallet
    </button>
  );
}
