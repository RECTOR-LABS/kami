import { Wallet } from 'lucide-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

export default function ConnectWalletButton() {
  const { setVisible } = useWalletModal();
  return (
    <button
      type="button"
      onClick={() => setVisible(true)}
      className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-kami-amber text-kami-sepiaBg hover:opacity-95 active:opacity-90 text-sm font-mono font-bold transition-opacity"
    >
      <Wallet className="w-4 h-4" />
      Connect Wallet
    </button>
  );
}
