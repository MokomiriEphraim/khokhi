import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  X,
  Maximize2,
  Minimize2,
  Paperclip,
  FileSpreadsheet,
  CheckCircle2,
  History,
  Plus,
  ArrowLeft,
  BookOpen,
  UploadCloud,
  FileText,
  Loader2,
} from 'lucide-react';
import { ChatMessage } from '../types';
import { normalizeWorkbookBuffer } from '../utils/sheetProfiler';
import { apiParseDocument } from '../utils/authClient';
import { ThinkingIndicator, useElapsedLabel } from './assistant-ui/elements/thinking-indicator';
import { StreamingText } from './assistant-ui/elements/streaming-text';
import { GuardrailNotice } from './assistant-ui/elements/guardrail-notice';
import { ChatHistoryView } from './assistant-ui/elements/chat-history-sidebar';

interface CompactMentorPanelProps {
  messages: ChatMessage[];
  isRunning: boolean;
  onSend: (text: string, attachments?: { name: string; type: 'spreadsheet' | 'rubric' }[]) => void;
  onClear: () => void | Promise<void>;
  onClose: () => void;
  isOpen: boolean;
  refusalsCount?: number;
  onAutoFillSpreadsheet?: (fileName: string, buffer: ArrayBuffer) => void;
  contextFileName?: string | null;
  onOpenHistory?: () => void;
  showHistory?: boolean;
  onToggleHistory?: (show: boolean) => void;
  onRestoreSession?: (
    messages: ChatMessage[],
    title: string,
    fileName: string | null,
    sessionId: string,
    fileContext: string | null,
    brief?: string | null
  ) => void;
  activeSessionId?: string | null;
  onClearFileContext?: () => void | Promise<void>;
  assignmentBrief?: string | null;
  onUpdateBrief?: (brief: string) => void;
  onClearBrief?: () => void;
}

const DEFAULT_WIDTH = 390;
const ENLARGED_WIDTH = 600;
const MIN_WIDTH = 320;

function renderRichText(text: string): React.ReactNode {
  const out: React.ReactNode[] = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (i > 0) out.push(<br key={`br-${i}`} />);
    const headingMatch = line.match(/^#{1,4}\s+(.*)$/);
    if (headingMatch) {
      out.push(
        <span key={`h-${i}`} className="font-semibold text-neutral-900 block mt-2 mb-0.5 text-[13px]">
          {headingMatch[1]}
        </span>
      );
      return;
    }
    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    const body = bulletMatch ? bulletMatch[1] : line;
    if (bulletMatch) {
      out.push(
        <span key={`b-${i}`} className="flex gap-2 mt-0.5">
          <span className="text-emerald-500 mt-0.5 shrink-0">•</span>
          <span>{renderInline(body, `${i}-0`)}</span>
        </span>
      );
      return;
    }
    out.push(<span key={`t-${i}`}>{renderInline(body, `${i}-1`)}</span>);
  });
  return out;
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, j) => {
    const key = `${keyPrefix}-${j}`;
    if (p.startsWith('**') && p.endsWith('**') && p.length > 4) {
      return <strong key={key} className="font-semibold text-neutral-900">{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith('`') && p.endsWith('`') && p.length > 2) {
      return (
        <code key={key} className="bg-neutral-900/8 text-neutral-800 px-1.5 py-0.5 rounded-md text-[0.88em] font-mono border border-neutral-200/60">
          {p.slice(1, -1)}
        </code>
      );
    }
    return <span key={key}>{p}</span>;
  });
}

export const CompactMentorPanel: React.FC<CompactMentorPanelProps> = ({
  messages,
  isRunning,
  onSend,
  onClear,
  onClose,
  isOpen,
  refusalsCount = 0,
  onAutoFillSpreadsheet,
  contextFileName = null,
  onOpenHistory,
  showHistory = false,
  onToggleHistory,
  onRestoreSession,
  activeSessionId,
  onClearFileContext,
  assignmentBrief = '',
  onUpdateBrief,
  onClearBrief,
}) => {
  const [view, setView] = useState<'chat' | 'history'>(showHistory ? 'history' : 'chat');

  useEffect(() => {
    setView(showHistory ? 'history' : 'chat');
  }, [showHistory]);

  const [input, setInput] = useState('');
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    size: number;
    buffer: ArrayBuffer;
  } | null>(null);
  const [appliedBrief, setAppliedBrief] = useState<{
    name: string;
    wordCount: number;
  } | null>(null);
  const [pendingBriefMention, setPendingBriefMention] = useState<string | null>(null);
  const [isParsingDoc, setIsParsingDoc] = useState(false);
  const [docParseError, setDocParseError] = useState<string | null>(null);
  const [isAutoFilled, setIsAutoFilled] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [isClearingFile, setIsClearingFile] = useState(false);

  const handleClear = async () => {
    if (isClearing) return;
    setIsClearing(true);
    try {
      await onClear();
    } finally {
      setIsClearing(false);
    }
  };

  const handleClearFile = async () => {
    if (isClearingFile || !onClearFileContext) return;
    setIsClearingFile(true);
    try {
      await onClearFileContext();
    } finally {
      setIsClearingFile(false);
    }
  };

  const elapsedThinking = useElapsedLabel(isRunning);

  const [width, setWidth] = useState<number>(() => {
    const saved = localStorage.getItem('khokhi_mentor_width');
    const parsed = saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
    return isNaN(parsed) ? DEFAULT_WIDTH : Math.max(MIN_WIDTH, parsed);
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(DEFAULT_WIDTH);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isRunning]);

  const hasActiveBrief = !!assignmentBrief && assignmentBrief !== '__skipped__';

  // Brief cleared/removed upstream (or fresh chat) → drop the applied-file chip too
  useEffect(() => {
    if (!hasActiveBrief) {
      setAppliedBrief(null);
      setPendingBriefMention(null);
    }
  }, [hasActiveBrief]);

  const handleFileSelect = async (file: File) => {
    // 1. Spreadsheet file → auto-open in Excel Studio right away
    if (/\.(xlsx|xls|xlsm|csv|ods|tsv)$/i.test(file.name)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const rawBuffer = e.target?.result as ArrayBuffer;
        if (!rawBuffer) return;
        const { fileName: normName, buffer: normBuffer } = normalizeWorkbookBuffer(file.name, rawBuffer);
        setAttachedFile({ name: normName, size: normBuffer.byteLength || file.size, buffer: normBuffer });
        setIsAutoFilled(true);
        onAutoFillSpreadsheet?.(normName, normBuffer);
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    // 2. Assignment brief / rubric document (PDF / TXT / DOCX / MD)
    //    → parse, silently apply as the session brief (rides on every chat payload)
    if (/\.(pdf|txt|md|doc|docx)$/i.test(file.name)) {
      setIsParsingDoc(true);
      setDocParseError(null);
      try {
        const res = await apiParseDocument(file);
        if (res.success && res.text) {
          const text = res.text.slice(0, 3000);
          onUpdateBrief?.(text);
          setAppliedBrief({ name: file.name, wordCount: res.wordCount });
          setPendingBriefMention(file.name);
        } else {
          setDocParseError(res.error || 'Could not parse document');
        }
      } catch (err: any) {
        setDocParseError(err.message || 'Error parsing document');
      } finally {
        setIsParsingDoc(false);
      }
      return;
    }
  };

  const handleFilesSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => handleFileSelect(file));
  };

  const handleClearBriefLocal = () => {
    onClearBrief?.();
    setAppliedBrief(null);
    setPendingBriefMention(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRunning) return;

    const hasExcel = !!attachedFile;
    const hasBriefMention = !!pendingBriefMention;
    const hasText = !!input.trim();

    // Nothing to send
    if (!hasExcel && !hasBriefMention && !hasText) return;

    // 1. Open Excel directly in Studio — only if not already auto-filled on attach
    if (hasExcel && !isAutoFilled) {
      onAutoFillSpreadsheet?.(attachedFile!.name, attachedFile!.buffer);
    }

    // 2. Build the chat message (brief itself is injected server-side on every send)
    const parts: string[] = [];
    if (hasText) {
      parts.push(input.trim());
    }
    if (hasExcel) {
      parts.push(hasText
        ? `📎 Attached: ${attachedFile!.name}`
        : `📎 Uploaded spreadsheet: ${attachedFile!.name}`);
    }
    if (hasBriefMention) {
      parts.push(hasText
        ? `📋 Rubric: ${pendingBriefMention}`
        : `📋 Loaded rubric from: ${pendingBriefMention}`);
    }

    // 3. Build attachment metadata for the message bubble
    const attachments: { name: string; type: 'spreadsheet' | 'rubric' }[] = [];
    if (hasExcel) attachments.push({ name: attachedFile!.name, type: 'spreadsheet' });
    if (hasBriefMention) attachments.push({ name: pendingBriefMention!, type: 'rubric' });

    const messageText = parts.join('\n');
    onSend(messageText, attachments.length > 0 ? attachments : undefined);

    // 4. Reset per-message state (the active rubric chip/pill persists)
    setAttachedFile(null);
    setPendingBriefMention(null);
    setIsAutoFilled(false);
    setInput('');
  };

  const handleToggleEnlarge = () => {
    setWidth((prev) => {
      const next = prev > 440 ? DEFAULT_WIDTH : Math.min(ENLARGED_WIDTH, Math.floor(window.innerWidth * 0.48));
      localStorage.setItem('khokhi_mentor_width', String(next));
      return next;
    });
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartXRef.current = e.clientX;
    startWidthRef.current = width;
  }, [width]);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = dragStartXRef.current - e.clientX;
      const maxWidth = Math.min(Math.floor(window.innerWidth * 0.65), 850);
      const newWidth = Math.min(Math.max(startWidthRef.current + deltaX, MIN_WIDTH), maxWidth);
      setWidth(newWidth);
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      localStorage.setItem('khokhi_mentor_width', String(width));
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, width]);

  if (!isOpen) return null;

  const isEnlarged = width > 440;

  return (
    <>
      {isDragging && <div className="fixed inset-0 z-50 cursor-col-resize select-none bg-transparent" />}

      <input
        type="file"
        ref={fileInputRef}
        multiple
        onChange={(e) => { handleFilesSelect(e.target.files); e.target.value = ''; }}
        accept=".xlsx,.xls,.csv,.xlsm,.ods,.pdf,.txt,.md,.doc,.docx"
        className="hidden"
      />

      <aside
        style={{ width: `${width}px` }}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragOver(false); handleFilesSelect(e.dataTransfer.files); }}
        className={`relative shrink-0 h-full flex flex-col z-10 animate-in slide-in-from-right duration-200 transition-[width] ease-out will-change-[width] overflow-hidden rounded-xl shadow-[0_4px_30px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04)] border ${
          isDragOver
            ? 'ring-2 ring-emerald-400 border-emerald-300 bg-emerald-50/30'
            : 'bg-white border-neutral-200/80'
        }`}
      >
        {/* Drag-to-resize handle */}
        <div
          onMouseDown={handleMouseDown}
          onDoubleClick={() => { setWidth(DEFAULT_WIDTH); localStorage.setItem('khokhi_mentor_width', String(DEFAULT_WIDTH)); }}
          title="Drag to resize • Double-click to reset"
          className="absolute top-0 bottom-0 -left-1.5 w-3 cursor-col-resize group z-30 flex items-center justify-center hover:bg-neutral-400/15 active:bg-neutral-500/20 transition-colors"
        >
          <div className="w-[3px] h-10 rounded-full bg-neutral-200 group-hover:bg-neutral-500 transition-colors" />
        </div>

        {/* ── Header ─────────────────────────────────────────────── */}
        {view === 'history' ? (
          <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setView('chat');
                  onToggleHistory?.(false);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer text-[12px] font-semibold"
                title="Back to chat"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Chat</span>
              </button>
              <div className="h-4 w-px bg-neutral-200" />
              <div className="flex items-center gap-1.5 font-semibold text-[13px] text-neutral-900">
                <History className="w-3.5 h-3.5 text-neutral-500" />
                <span>History</span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={async () => {
                  await handleClear();
                  setView('chat');
                  onToggleHistory?.(false);
                }}
                disabled={isClearing}
                title="Start new chat"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-700 disabled:opacity-60 text-white text-[11px] font-semibold transition-colors cursor-pointer shadow-sm"
              >
                {isClearing ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Clearing…</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3 h-3" />
                    <span>New Chat</span>
                  </>
                )}
              </button>

              <button
                onClick={handleToggleEnlarge}
                title={isEnlarged ? 'Shrink to compact' : 'Expand panel'}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isEnlarged ? 'bg-neutral-100 text-neutral-700' : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                {isEnlarged ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={onClose}
                title="Collapse panel"
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-2">
              {refusalsCount > 0 && (
                <span
                  title="Socratic guardrails active: guides instead of spoon-feeding"
                  className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full"
                >
                  {refusalsCount} blocks
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setView('history');
                  onToggleHistory?.(true);
                  onOpenHistory?.();
                }}
                title="View past chat sessions"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 transition-colors cursor-pointer text-[11px] font-medium"
              >
                <History className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">History</span>
              </button>

              <button
                onClick={handleClear}
                disabled={isClearing}
                title="Start new chat"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-700 disabled:opacity-60 text-white text-[11px] font-semibold transition-colors cursor-pointer shadow-sm"
              >
                {isClearing ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Clearing…</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3 h-3" />
                    <span>New Chat</span>
                  </>
                )}
              </button>

              <button
                onClick={handleToggleEnlarge}
                title={isEnlarged ? 'Shrink to compact' : 'Expand panel'}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isEnlarged ? 'bg-neutral-100 text-neutral-700' : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                {isEnlarged ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={onClose}
                title="Collapse panel"
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {view === 'history' ? (
          <ChatHistoryView
            activeSessionId={activeSessionId}
            onRestoreSession={(restoredMessages, title, fileName, sessionId, fileContext, brief) => {
              onRestoreSession?.(restoredMessages, title, fileName, sessionId, fileContext, brief);
              setView('chat');
              onToggleHistory?.(false);
            }}
            onNewChat={() => {
              onClear();
              setView('chat');
              onToggleHistory?.(false);
            }}
          />
        ) : (
          <>
            {/* ── Message Stream ──────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 text-[13px] leading-relaxed relative">
              {isClearing && (
                <div className="absolute inset-0 bg-white/85 backdrop-blur-[2px] z-30 flex flex-col items-center justify-center gap-2.5 animate-in fade-in duration-200">
                  <div className="w-10 h-10 rounded-full bg-neutral-900/5 flex items-center justify-center border border-neutral-200/60 shadow-xs">
                    <Loader2 className="w-5 h-5 animate-spin text-neutral-800" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-neutral-800">Clearing session…</p>
                    <p className="text-[11px] text-neutral-500">Resetting chat and workbook context</p>
                  </div>
                </div>
              )}
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8">
              <div className="w-14 h-14 rounded-2xl bg-white border border-neutral-200/80 p-2 shadow-xs mb-3 flex items-center justify-center">
                <img
                  src="/khokhi.png"
                  alt="Khokhi Logo"
                  className="w-full h-full object-contain"
                />
              </div>

              <p className="text-[12px] text-neutral-500 leading-relaxed max-w-[270px]">
                Clean messy tables, align to your assignment rubric, and build models step by step.
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const isUser = m.role === 'user';
              const isRefusal = Boolean(m.isRefusal);

              if (isRefusal && !isUser) {
                return (
                  <div key={m.id} className="flex flex-col items-start w-full animate-in fade-in duration-200">
                    <GuardrailNotice
                      title="I can't do that for you"
                      explanation={
                        m.text ||
                        "Khokhi is designed to build your problem-solving skills, so I will not provide direct deliverables or finished formulas. But I can guide you through the diagnosis and steps so you can solve it yourself in minutes."
                      }
                      policy="anti-cheat policy"
                      alternatives={[
                        'Why does this dirty data issue cause errors in SQL?',
                        'Give me a Socratic hint on which formula to use',
                        'How do I test if my revenue column contains text numbers?',
                      ]}
                      onPick={(alt) => onSend(alt)}
                      className={isEnlarged ? 'max-w-[90%]' : 'max-w-full'}
                    />
                    <span className="text-[10px] text-neutral-400 mt-1 px-1">Guardrail</span>
                  </div>
                );
              }

              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-in fade-in duration-150`}
                >
                  <div
                    className={`rounded-2xl px-4 py-3 break-words leading-relaxed ${
                      isEnlarged ? 'max-w-[85%]' : 'max-w-[92%]'
                    } ${
                      isUser
                        ? 'bg-neutral-900 text-white text-[13px] font-medium shadow-md whitespace-pre-wrap rounded-br-sm'
                        : 'bg-neutral-50 text-neutral-800 border border-neutral-200/70 shadow-sm rounded-bl-sm'
                    }`}
                  >
                    {isUser ? (
                      <>
                        {m.text}
                        {m.attachments && m.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {m.attachments.map((att, i) => (
                              <span
                                key={i}
                                className={`inline-flex items-center gap-1 text-[10.5px] px-2 py-0.5 rounded-lg font-medium ${
                                  att.type === 'spreadsheet'
                                    ? 'bg-emerald-500/20 text-emerald-200'
                                    : 'bg-indigo-500/20 text-indigo-200'
                                }`}
                              >
                                {att.type === 'spreadsheet' ? <FileSpreadsheet className="w-3 h-3" /> : <BookOpen className="w-3 h-3" />}
                                {att.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    ) : m.status === 'running' ? (
                      m.text ? (
                        <StreamingText text={m.text} streaming={true} />
                      ) : (
                        <ThinkingIndicator
                          label={m.thinkingLabel || 'Drafting a reply...'}
                          elapsed={elapsedThinking}
                        />
                      )
                    ) : (
                      renderRichText(m.text)
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Input Footer ────────────────────────────────────────── */}
        <form
          onSubmit={handleSubmit}
          className="p-3 border-t border-neutral-100 bg-white shrink-0 flex flex-col gap-2"
        >
          {/* Document parsing indicator */}
          {isParsingDoc && (
            <div className="flex items-center gap-2 text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1.5 animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 shrink-0" />
              <span>Extracting rubric from document...</span>
            </div>
          )}
          {docParseError && (
            <div className="flex items-center justify-between text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5">
              <span>⚠️ {docParseError}</span>
              <button type="button" onClick={() => setDocParseError(null)} className="text-rose-500 hover:text-rose-800 p-0.5">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Attached Spreadsheet Chip (Compact & Clean) */}
          {attachedFile && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50/90 border border-emerald-200 rounded-xl text-emerald-950 text-[12px] shadow-2xs animate-in fade-in slide-in-from-bottom-1 duration-150">
              <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <FileSpreadsheet className="w-3.5 h-3.5" />
              </div>
              <span className="font-semibold truncate max-w-[170px]" title={attachedFile.name}>
                {attachedFile.name}
              </span>
              <span className="text-[10px] text-emerald-700 font-mono bg-emerald-100 px-1 rounded shrink-0">
                {(attachedFile.size / 1024).toFixed(0)} KB
              </span>
              <span className="text-[10.5px] text-emerald-700 font-medium ml-auto flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active in Studio
              </span>
              <button
                type="button"
                onClick={() => {
                  setAttachedFile(null);
                  setIsAutoFilled(false);
                  onClearFileContext?.();
                }}
                className="text-neutral-400 hover:text-neutral-700 p-1 hover:bg-neutral-200/50 rounded-md transition-colors cursor-pointer shrink-0 ml-1"
                title="Remove attached file"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Applied Rubric Document Chip (shows right after a rubric file is auto-grasped) */}
          {appliedBrief && hasActiveBrief && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50/90 border border-indigo-200 rounded-xl text-indigo-950 text-[12px] shadow-2xs animate-in fade-in slide-in-from-bottom-1 duration-150">
              <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <BookOpen className="w-3.5 h-3.5" />
              </div>
              <span className="font-semibold truncate max-w-[170px]" title={appliedBrief.name}>
                {appliedBrief.name}
              </span>
              <span className="text-[10px] text-indigo-700 font-mono bg-indigo-100 px-1 rounded shrink-0">
                {appliedBrief.wordCount} words
              </span>
              <span className="text-[10.5px] text-indigo-700 font-medium ml-auto flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                Rubric active
              </span>
              <button
                type="button"
                onClick={handleClearBriefLocal}
                className="text-neutral-400 hover:text-neutral-700 p-1 hover:bg-neutral-200/50 rounded-md transition-colors cursor-pointer shrink-0 ml-0.5"
                title="Remove rubric"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Active Context / Rubric Bar (Micro-pills, only when no pending file attached) */}
          {(!attachedFile && !appliedBrief) && (contextFileName || hasActiveBrief) && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {contextFileName && (
                <div className="flex items-center gap-1.5 text-[10px] text-neutral-600 bg-neutral-100/90 border border-neutral-200/80 rounded-lg px-2 py-1">
                  <FileSpreadsheet className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span className="truncate max-w-[130px] font-medium" title={contextFileName}>
                    {contextFileName}
                  </span>
                  {onClearFileContext && (
                    <button
                      type="button"
                      onClick={handleClearFile}
                      disabled={isClearingFile}
                      title="Clear active sheet"
                      className="text-neutral-400 hover:text-rose-600 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isClearingFile ? (
                        <Loader2 className="w-2.5 h-2.5 animate-spin text-neutral-500" />
                      ) : (
                        <X className="w-2.5 h-2.5" />
                      )}
                    </button>
                  )}
                </div>
              )}
              {hasActiveBrief && (
                <div className="flex items-center gap-1.5 text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200/70 rounded-lg px-2 py-1">
                  <BookOpen className="w-3 h-3 text-indigo-600 shrink-0" />
                  <span className="truncate max-w-[130px] font-medium" title={assignmentBrief}>
                    Instructions active
                  </span>
                  {onClearBrief && (
                    <button
                      type="button"
                      onClick={handleClearBriefLocal}
                      title="Clear assignment instructions"
                      className="text-neutral-400 hover:text-rose-600 transition-colors cursor-pointer"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Prompt Input Bar */}
          <div className="flex items-center gap-1.5 bg-neutral-50 hover:bg-white focus-within:bg-white border border-neutral-200 focus-within:border-neutral-400/80 focus-within:ring-2 focus-within:ring-neutral-900/5 rounded-2xl px-2.5 py-1.5 transition-all shadow-2xs">
            {/* Attachment Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach Excel spreadsheet or Assignment PDF"
              className="text-neutral-400 hover:text-neutral-800 p-1.5 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer shrink-0"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                isRunning
                  ? 'Khokhi is thinking...'
                  : (attachedFile && pendingBriefMention)
                  ? 'Both attached — press Enter to start coaching...'
                  : pendingBriefMention
                  ? 'Rubric applied — ask anything or press Enter...'
                  : attachedFile
                  ? 'Ask Khokhi about this sheet (or press Enter)...'
                  : 'Ask Khokhi or attach a file...'
              }
              disabled={isRunning || isParsingDoc}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
              className="flex-1 bg-transparent text-[13px] text-neutral-900 placeholder:text-neutral-400 outline-none px-1"
            />

            <button
              type="submit"
              disabled={(!input.trim() && !attachedFile && !pendingBriefMention) || isRunning || isParsingDoc}
              title="Send (Enter)"
              className="w-8 h-8 rounded-xl bg-neutral-900 hover:bg-neutral-800 active:scale-95 disabled:bg-neutral-200 text-white disabled:text-neutral-400 flex items-center justify-center transition-all cursor-pointer disabled:cursor-not-allowed shadow-2xs shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-between px-1 text-[10px] text-neutral-400">
            <span>
              {(attachedFile && pendingBriefMention)
                ? '📎📋 Spreadsheet + Rubric attached'
                : pendingBriefMention
                ? '📋 Rubric document attached'
                : attachedFile
                ? '📎 Spreadsheet attached'
                : hasActiveBrief
                ? '📋 Rubric active — sent with every message'
                : 'Supports .xlsx, .csv, .pdf, .txt'}
            </span>
            <span className="font-medium">↵ to send</span>
          </div>
        </form>
          </>
        )}
      </aside>
    </>
  );
};
