import { Markdown } from '../../lib/markdown';
import BentoCell from '../bento/BentoCell';
import KamiCursor from '../bento/KamiCursor';
import ToolBadge from './ToolBadge';
import TxStatusCard from './TxStatusCard';
import ConnectWalletButton from '../ConnectWalletButton';
import { groupToolCalls } from './groupToolCalls';
import type { ChatMessage } from '../../types';

interface Props {
  message: ChatMessage;
  isStreaming: boolean;
}

export default function MessageBubble({ message, isStreaming }: Props) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <BentoCell
          delay={0}
          variant="compact"
          className="max-w-[85%] md:max-w-[65%] bg-kami-amberHaze border-kami-amber/25"
        >
          <p className="text-sm text-kami-cream whitespace-pre-wrap">{message.content}</p>
        </BentoCell>
      </div>
    );
  }

  const grouped = message.toolCalls ? groupToolCalls(message.toolCalls) : [];
  const showConnectCta = message.toolCalls?.some((c) => c.status === 'wallet-required') ?? false;
  const isWaitingForFirstToken =
    message.content === '' &&
    !message.toolCalls?.length &&
    !message.pendingTransaction &&
    !showConnectCta;

  return (
    <div className="flex mb-4">
      <BentoCell
        delay={0}
        variant="compact"
        className="max-w-[95%] md:max-w-[80%] bg-kami-cellBase border-kami-cellBorder"
      >
        {grouped.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {grouped.map((g, i) => (
              <ToolBadge key={`${g.name}-${i}`} name={g.name} status={g.status} count={g.count} />
            ))}
          </div>
        )}
        {isWaitingForFirstToken ? (
          <KamiCursor />
        ) : (
          <div className="text-sm text-kami-cream space-y-1">
            <Markdown text={message.content} />
            {isStreaming && message.content && <KamiCursor />}
          </div>
        )}
        {message.pendingTransaction && (
          <div className="mt-3">
            <TxStatusCard transaction={message.pendingTransaction} />
          </div>
        )}
        {showConnectCta && (
          <div className="mt-3">
            <ConnectWalletButton />
          </div>
        )}
      </BentoCell>
    </div>
  );
}
