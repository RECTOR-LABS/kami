import { useState } from 'react';
import { Settings, Plus, X } from 'lucide-react';
import ConversationItem from './ConversationItem';
import type { Conversation } from '../../types';

interface Props {
  conversations: Conversation[];
  activeId: string;
  isOpen: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onClearAll: () => void;
  onRename: (id: string, title: string) => void;
}

export default function SidebarShell({
  conversations,
  activeId,
  isOpen,
  onSelect,
  onNew,
  onDelete,
  onClose,
  onClearAll,
  onRename,
}: Props) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const handleClearAll = () => {
    setIsSettingsOpen(false);
    if (window.confirm('Clear all conversations? This cannot be undone.')) {
      onClearAll();
    }
  };

  const startRename = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditingTitle(conv.title);
  };

  const commitRename = () => {
    if (!editingId) return;
    const trimmed = editingTitle.trim();
    if (trimmed) onRename(editingId, trimmed);
    setEditingId(null);
    setEditingTitle('');
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`
          fixed top-0 left-0 h-full w-72 bg-kami-sepiaBg border-r border-kami-cellBorder z-40
          transform transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 lg:z-0
          flex flex-col
        `}
      >
        <div className="p-4 border-b border-kami-cellBorder flex items-center gap-3 relative">
          <div className="w-8 h-8 rounded-lg bg-kami-amber flex items-center justify-center text-kami-sepiaBg font-display font-bold text-sm">
            K
          </div>
          <div className="flex-1">
            <h1 className="font-display font-bold text-kami-cream text-sm leading-none">Kami</h1>
            <p className="font-mono text-[9px] uppercase tracking-widest text-kami-creamMuted mt-1">
              v1.0 · mainnet
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsSettingsOpen((v) => !v)}
            aria-label="Settings"
            aria-haspopup="menu"
            aria-expanded={isSettingsOpen}
            className="p-1 text-kami-creamMuted hover:text-kami-cream transition-colors"
          >
            <Settings className="w-5 h-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            className="lg:hidden p-1 text-kami-creamMuted hover:text-kami-cream transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
          {isSettingsOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsSettingsOpen(false)}
                aria-hidden="true"
              />
              <div role="menu" className="absolute right-3 top-full mt-2 z-50 w-56 bg-kami-cellBase border border-kami-cellBorder rounded-2xl shadow-lg py-1">
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleClearAll}
                  className="w-full text-left px-4 py-2 font-mono text-xs text-kami-cream hover:bg-kami-amberHaze hover:text-kami-amber transition-colors"
                >
                  Clear all conversations
                </button>
              </div>
            </>
          )}
        </div>

        <div className="p-3">
          <button
            type="button"
            onClick={onNew}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-2xl border border-kami-cellBorder text-sm text-kami-cream hover:bg-kami-amberHaze hover:border-kami-amber/40 hover:text-kami-amber transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
          {conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === activeId}
              isEditing={editingId === conv.id}
              editingTitle={editingTitle}
              onSelect={() => onSelect(conv.id)}
              onStartRename={() => startRename(conv)}
              onCommitRename={commitRename}
              onCancelRename={cancelRename}
              onChangeRenameTitle={setEditingTitle}
              onDelete={() => onDelete(conv.id)}
            />
          ))}
        </div>

        <div className="p-3 border-t border-kami-cellBorder">
          <div className="flex items-center gap-2 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-kami-creamMuted">
            <div className="w-2 h-2 rounded-full bg-kami-amber animate-pulse-dot" />
            Solana Mainnet
          </div>
        </div>
      </aside>
    </>
  );
}
