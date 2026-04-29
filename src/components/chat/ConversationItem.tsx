import { Pencil, Trash2 } from 'lucide-react';
import BentoCell from '../bento/BentoCell';
import type { Conversation } from '../../types';

interface Props {
  conversation: Conversation;
  isActive: boolean;
  isEditing: boolean;
  editingTitle: string;
  onSelect: () => void;
  onStartRename: () => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onChangeRenameTitle: (v: string) => void;
  onDelete: () => void;
}

export default function ConversationItem({
  conversation,
  isActive,
  isEditing,
  editingTitle,
  onSelect,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onChangeRenameTitle,
  onDelete,
}: Props) {
  const activeClass = isActive
    ? 'bg-kami-amberHaze border-kami-amber/25 text-kami-amber'
    : 'text-kami-creamMuted hover:text-kami-cream';

  return (
    <BentoCell
      delay={0}
      variant="mini"
      animate={false}
      className={`group cursor-pointer ${activeClass}`}
    >
      <div
        onClick={isEditing ? undefined : onSelect}
        className="flex items-center gap-2 text-sm"
      >
        {isEditing ? (
          <input
            autoFocus
            value={editingTitle}
            onChange={(e) => onChangeRenameTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onCommitRename();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                onCancelRename();
              }
            }}
            onBlur={onCommitRename}
            onClick={(e) => e.stopPropagation()}
            maxLength={60}
            aria-label="Rename conversation"
            className="flex-1 min-w-0 bg-transparent border border-kami-cellBorder rounded px-1 py-0.5 text-sm text-kami-cream focus:outline-none focus:border-kami-amber/40"
          />
        ) : (
          <span className="flex-1 truncate" title={conversation.title}>
            {conversation.title}
          </span>
        )}
        {!isEditing && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStartRename();
              }}
              aria-label="Rename conversation"
              className="opacity-0 group-hover:opacity-100 p-1 text-kami-creamMuted hover:text-kami-cream transition-all"
            >
              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              aria-label="Delete conversation"
              className="opacity-0 group-hover:opacity-100 p-1 text-kami-creamMuted hover:text-kami-amber transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </BentoCell>
  );
}
