import React, { useState } from 'react';
import type { Conversation } from '../types';

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

export default function Sidebar({
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
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`
          fixed top-0 left-0 h-full w-72 bg-kami-surface border-r border-kami-border z-40
          transform transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 lg:z-0
          flex flex-col
        `}
      >
        <div className="p-4 border-b border-kami-border flex items-center gap-3 relative">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-kami-accent to-purple-400 flex items-center justify-center text-white font-bold text-sm">
            K
          </div>
          <div className="flex-1">
            <h1 className="font-semibold text-white text-sm">Kami</h1>
            <p className="text-xs text-kami-muted">DeFi Co-Pilot</p>
          </div>
          <button
            onClick={() => setIsSettingsOpen((v) => !v)}
            aria-label="Settings"
            className="p-1 text-kami-muted hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button
            onClick={onClose}
            aria-label="Close sidebar"
            className="lg:hidden p-1 text-kami-muted hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {isSettingsOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsSettingsOpen(false)}
                aria-hidden="true"
              />
              <div className="absolute right-3 top-full mt-2 z-50 w-56 bg-kami-surface border border-kami-border rounded-lg shadow-lg py-1">
                <button
                  onClick={handleClearAll}
                  className="w-full text-left px-4 py-2 text-sm text-kami-text hover:bg-kami-border/50 transition-colors"
                >
                  Clear all conversations
                </button>
              </div>
            </>
          )}
        </div>

        <div className="p-3">
          <button
            onClick={onNew}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-kami-border text-sm text-kami-text hover:bg-kami-border/50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`
                group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-colors
                ${
                  conv.id === activeId
                    ? 'bg-kami-accent/15 text-white'
                    : 'text-kami-muted hover:bg-kami-border/30 hover:text-kami-text'
                }
              `}
              onClick={() => onSelect(conv.id)}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
              {editingId === conv.id ? (
                <input
                  autoFocus
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitRename();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      cancelRename();
                    }
                  }}
                  onBlur={commitRename}
                  onClick={(e) => e.stopPropagation()}
                  maxLength={60}
                  aria-label="Rename conversation"
                  className="flex-1 min-w-0 bg-transparent border border-kami-border rounded px-1 py-0.5 text-sm text-white focus:outline-none focus:border-kami-accent"
                />
              ) : (
                <span className="flex-1 truncate">{conv.title}</span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startRename(conv);
                }}
                aria-label="Rename conversation"
                className="opacity-0 group-hover:opacity-100 p-1 text-kami-muted hover:text-white transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(conv.id);
                }}
                aria-label="Delete conversation"
                className="opacity-0 group-hover:opacity-100 p-1 text-kami-muted hover:text-kami-danger transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-kami-border">
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-kami-muted">
            <div className="w-2 h-2 rounded-full bg-kami-success" />
            Solana Mainnet
          </div>
        </div>
      </aside>
    </>
  );
}
