import type { PendingTransaction } from '../../types';

interface Props {
  transaction: PendingTransaction;
}

// STUB — Task 6 replaces this with the full state machine.
// We need a placeholder so MessageBubble can import it without type error.
export default function TxStatusCard({ transaction }: Props) {
  return (
    <div className="text-xs text-kami-creamMuted">tx pending: {transaction.summary}</div>
  );
}
