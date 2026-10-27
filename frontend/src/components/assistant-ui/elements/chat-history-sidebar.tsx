import React, { useState, useEffect, useCallback } from 'react';
import {
  History,
  X,
  Trash2,
  MessageSquare,
  FileSpreadsheet,
  Clock,
  ChevronRight,
  Plus,
  Search,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { ChatSessionMeta, apiListSessions, apiDeleteSession, apiLoadSession } from '../../../utils/authClient';
import { ChatMessage } from '../../../types';

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

export interface ChatHistoryViewProps {
  onRestoreSession: (
    messages: ChatMessage[],
    title: string,
    fileName: string | null,
    sessionId: string,
    fileContext: string | null,
    assignmentBrief?: string | null
  ) => void;
  onNewChat?: () => void;
  activeSessionId?: string | null;
}

export const ChatHistoryView: React.FC<ChatHistoryViewProps> = ({
  onRestoreSession,
  onNewChat,
  activeSessionId,
}) => {
  const [sessions, setSessions] = useState<ChatSessionMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await apiListSessions();
      setSessions(list);
    } catch {
      setError('Failed to load chat history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    setSearchQuery('');
    setConfirmDeleteId(null);
  }, [reload]);

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setDeletingId(id);
    setConfirmDeleteId(null);
    await apiDeleteSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setDeletingId(null);
    if (activeSessionId === id) {
      onNewChat?.();
    }
  };

  const handleRestore = async (id: string) => {
    setLoadingSessionId(id);
    const session = await apiLoadSession(id);
    setLoadingSessionId(null);
    if (!session) {
      setError('Could not load that session. Please try again.');
      return;
    }
    onRestoreSession(
      session.messages as ChatMessage[],
      session.title,
      session.fileName,
      session.id,
      session.fileContext,
      session.assignmentBrief || null
    );
  };

  const filtered = sessions.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      !q ||
      s.title.toLowerCase().includes(q) ||
      (s.fileName || '').toLowerCase().includes(q) ||
      s.preview.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      {/* Search bar */}
      <div className="px-3.5 py-2.5 border-b border-neutral-100 bg-neutral-50/60 shrink-0">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-neutral-200/90 shadow-2xs focus-within:border-neutral-400 focus-within:ring-2 focus-within:ring-neutral-900/5 transition-all">
          <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          <input
            type="text"
            placeholder="Search past sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-xs text-neutral-800 placeholder-neutral-400 outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-neutral-400 hover:text-neutral-600 text-xs px-1 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {loading && (
          <div className="flex flex-col items-center justify-center h-48 gap-2.5 text-neutral-400 text-xs">
            <Loader2 className="w-5 h-5 animate-spin text-neutral-700" />
            <span className="font-medium">Loading chat history...</span>
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center gap-2 my-2 px-3 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={reload} className="font-semibold underline cursor-pointer">
              Retry
            </button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-56 gap-2.5 text-center px-6">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-400 shadow-inner">
              <MessageSquare className="w-6 h-6 text-neutral-400" />
            </div>
            <p className="text-sm font-semibold text-neutral-800">
              {searchQuery ? 'No matching sessions' : 'No past sessions yet'}
            </p>
            <p className="text-xs text-neutral-400 max-w-[240px] leading-relaxed">
              {searchQuery
                ? 'Try a different search keyword.'
                : 'Your saved coaching conversations will appear here so you can continue anytime.'}
            </p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="space-y-1.5">
            {filtered.map((session) => {
              const isDeleting = deletingId === session.id;
              const isLoadingThis = loadingSessionId === session.id;
              const confirmingDelete = confirmDeleteId === session.id;
              const isActive = session.id === activeSessionId;

              return (
                <div
                  key={session.id}
                  className={`group relative flex flex-col p-2.5 rounded-xl border transition-all ${
                    isDeleting
                      ? 'opacity-40 pointer-events-none'
                      : isActive
                      ? 'bg-emerald-50/70 border-emerald-300 shadow-xs'
                      : 'bg-white hover:bg-neutral-50/90 border-neutral-200/70 hover:border-neutral-300 shadow-2xs'
                  }`}
                >
                  <button
                    onClick={() => !isDeleting && !isLoadingThis && handleRestore(session.id)}
                    disabled={isDeleting || isLoadingThis}
                    className="flex items-start gap-2.5 text-left w-full cursor-pointer"
                  >
                    <div
                      className={`mt-0.5 shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                        isActive
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-neutral-100 group-hover:bg-neutral-200 text-neutral-600'
                      }`}
                    >
                      {session.fileName ? (
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <MessageSquare className="w-4 h-4" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 pr-6">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-xs font-semibold text-neutral-900 truncate leading-tight">
                            {session.title}
                          </p>
                          {isActive && (
                            <span className="shrink-0 text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full border border-emerald-300">
                              Active
                            </span>
                          )}
                          {session.hasBrief && (
                            <span className="shrink-0 text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-full border border-indigo-200">
                              📋 Rubric
                            </span>
                          )}
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-neutral-300 group-hover:text-neutral-600 shrink-0 transition-colors" />
                      </div>

                      {session.fileName && (
                        <p className="text-[10px] text-emerald-700 font-medium truncate mt-0.5 flex items-center gap-1">
                          <FileSpreadsheet className="w-3 h-3 shrink-0" />
                          <span>{session.fileName}</span>
                        </p>
                      )}

                      {session.preview && (
                        <p className="text-[11px] text-neutral-500 mt-1 line-clamp-2 leading-relaxed">
                          {session.preview}
                        </p>
                      )}

                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-neutral-400">
                        <span className="inline-flex items-center gap-1 font-medium">
                          <Clock className="w-3 h-3 text-neutral-400" />
                          {timeAgo(session.updatedAt)}
                        </span>
                        <span>•</span>
                        <span>
                          {session.messageCount} msg{session.messageCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Loading / Deleting spinner overlay */}
                  {(isLoadingThis || isDeleting) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/85 rounded-xl backdrop-blur-xs z-10 gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-neutral-700" />
                      <span className="text-xs font-medium text-neutral-600">
                        {isDeleting ? 'Deleting session…' : 'Loading session…'}
                      </span>
                    </div>
                  )}

                  {/* Delete button */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                    {confirmingDelete ? (
                      <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-neutral-200 shadow-sm animate-in fade-in zoom-in-95">
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          disabled={isDeleting}
                          className="text-[10px] font-medium text-neutral-500 hover:text-neutral-700 px-1.5 py-0.5 rounded hover:bg-neutral-100 transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDelete(session.id)}
                          disabled={isDeleting}
                          className="flex items-center gap-1 text-[10px] font-semibold text-white bg-rose-600 hover:bg-rose-700 px-2 py-0.5 rounded transition-colors disabled:opacity-60 cursor-pointer"
                        >
                          {isDeleting ? (
                            <>
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                              <span>Deleting…</span>
                            </>
                          ) : (
                            'Delete'
                          )}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(session.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                        title="Delete session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3.5 py-2.5 border-t border-neutral-100 bg-neutral-50/70 shrink-0 text-center">
        <p className="text-[10px] text-neutral-400 leading-tight">
          Sessions are saved securely to your account.<br />Tap any session above to restore it.
        </p>
      </div>
    </div>
  );
};

export interface ChatHistorySidebarProps {
  open: boolean;
  onClose: () => void;
  onRestoreSession: (
    messages: ChatMessage[],
    title: string,
    fileName: string | null,
    sessionId: string,
    fileContext: string | null,
    assignmentBrief?: string | null
  ) => void;
  onNewChat?: () => void;
  activeSessionId?: string | null;
  currentMessages: ChatMessage[];
  currentFileName?: string | null;
}

export const ChatHistorySidebar: React.FC<ChatHistorySidebarProps> = ({
  open,
  onClose,
  onRestoreSession,
  onNewChat,
  activeSessionId,
}) => {
  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />
      <div className="fixed top-0 right-0 h-full w-[360px] z-50 flex flex-col bg-white border-l border-neutral-200 shadow-2xl animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 bg-neutral-50/80 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-neutral-900 text-white">
              <History className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-900 leading-none">Chat History</h2>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {onNewChat && (
              <button
                onClick={() => {
                  onNewChat();
                  onClose();
                }}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-700 text-[11px] font-medium shadow-2xs transition-colors cursor-pointer"
                title="Start a new chat"
              >
                <Plus className="w-3 h-3 text-neutral-500" />
                <span>New</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-neutral-200/70 text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <ChatHistoryView
          activeSessionId={activeSessionId}
          onRestoreSession={(messages, title, fileName, sessionId, fileContext, assignmentBrief) => {
            onRestoreSession(messages, title, fileName, sessionId, fileContext, assignmentBrief);
            onClose();
          }}
          onNewChat={() => {
            onNewChat?.();
            onClose();
          }}
        />
      </div>
    </>
  );
};
