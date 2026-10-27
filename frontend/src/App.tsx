import React, { useState, useEffect, useRef } from 'react';
import {
  LogOut,
  ChevronDown,
  Database,
  Zap,
  PanelRightClose,
  PanelRightOpen,
  History,
  BookOpen,
} from 'lucide-react';
import { ProjectBriefModal } from './components/ProjectBriefModal';
import { ExcelSimulator } from './components/ExcelSimulator';
import { GridCraftEmbed } from './components/GridCraftEmbed';
import { CompactMentorPanel } from './components/CompactMentorPanel';
import { AuthPage } from './components/AuthPage';
import { ChatMessage, AuditStats } from './types';
import { streamBackendChat } from './utils/apiClient';
import {
  profileWorkbook,
  buildMissionSteps,
  buildFileContext,
  normalizeWorkbookBuffer,
  extractRowRangeFromText,
  extractColumnRangeFromText,
  MissionStep,
  SheetProfile,
} from './utils/sheetProfiler';
import {
  User,
  DBStatus,
  getStoredUser,
  apiGetMe,
  clearStoredAuth,
  fetchDBStatus,
  apiGetChatHistory,
  apiSaveChatHistory,
  apiClearChatHistory,
  apiListSessions,
  apiSaveSession,
  apiUpdateSession,
  apiLoadSession,
  apiDeleteSession,
  ChatSessionMeta,
} from './utils/authClient';
import {
  saveActiveWorkbookToLocal,
  getActiveWorkbookFromLocal,
  clearActiveWorkbookFromLocal,
} from './utils/workbookStorage';

// ── Guide lifecycle: what the current Row/Column Guide is FOR, and when it's done ──
type GuideKind = 'titles' | 'subtotals' | 'footnotes' | 'cols' | 'range';
interface GuideGoal {
  kind: GuideKind;
  range: { start: number; end: number };
  type: 'row' | 'col';
  totalRowsAtArm: number;
}

const NUMBER_ANOMALY_RE = /text|currency|space thousand/i;

/** What issue is this guide actually pointing at? (drives completion detection) */
function deriveGuideGoal(
  profile: SheetProfile,
  range: { start: number; end: number },
  type: 'row' | 'col'
): GuideKind {
  if (type === 'col') return 'cols';
  const overlaps = (rows: { rowIndex: number }[]) =>
    rows.some((r) => r.rowIndex >= range.start && r.rowIndex <= range.end);
  const dt = profile.dirtyTitleRowRange;
  if ((dt && dt.start <= range.end && dt.end >= range.start) || overlaps(profile.titleRows)) return 'titles';
  if (overlaps(profile.subtotalRows)) return 'subtotals';
  if (overlaps(profile.footnoteRows)) return 'footnotes';
  return 'range';
}

/** Has the student already fixed what this guide targets? */
function isGuideGoalResolved(
  profile: SheetProfile,
  goal: GuideGoal,
  initialProfile?: SheetProfile | null
): boolean {
  switch (goal.kind) {
    case 'titles':
      return profile.titleRows.length === 0 && !profile.dirtyTitleRowRange;
    case 'subtotals':
      return profile.subtotalRows.length === 0;
    case 'footnotes':
      return profile.footnoteRows.length === 0;
    case 'cols':
      return !profile.anomalies.some((a) => NUMBER_ANOMALY_RE.test(a)) || goal.range.end > profile.totalCols;
    case 'range':
      // If the initial file had title rows and current sheet has none, and this range was at the top
      if (initialProfile && (initialProfile.titleRows.length > 0 || initialProfile.dirtyTitleRowRange)) {
        if (profile.titleRows.length === 0 && !profile.dirtyTitleRowRange) {
          return true;
        }
      }
      // Target rows deleted (they no longer exist / rows were removed since arming)
      return goal.range.start > profile.totalRows || profile.totalRows < goal.totalRowsAtArm;
  }
}

export const App: React.FC = () => {
  // Side-by-side mentor panel open/collapse state
  const [isMentorOpen, setIsMentorOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem('khokhi_mentor_open');
    return saved !== null ? saved === 'true' : true;
  });

  // External workbook loaded via in-chat attachment or modal
  const [externalWorkbook, setExternalWorkbook] = useState<{
    fileName: string;
    buffer: ArrayBuffer;
  } | null>(null);

  // Multi-file queue: student can attach several tables; we work one at a time
  type QueuedFile = { fileName: string; buffer: ArrayBuffer; instructions: string };
  const [fileQueue, setFileQueue] = useState<QueuedFile[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);

  // Mission checklist state (built from sheetProfiler of the active file)
  const [missionProfile, setMissionProfile] = useState<SheetProfile | null>(null);
  const [missionSteps, setMissionSteps] = useState<MissionStep[]>([]);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  // Original read-only snapshot panel visibility
  const [showOriginal, setShowOriginal] = useState(false);
  // Coach Spotlight overlay & dynamic row range highlight in Excel Studio
  const [showSpotlight, setShowSpotlight] = useState<boolean>(false);
  const [customHighlightRange, setCustomHighlightRange] = useState<{ start: number; end: number } | null>(null);
  // What the active guide is for — cleared automatically once the student completes it
  const [guideGoal, setGuideGoal] = useState<GuideGoal | null>(null);

  /** Point the guide at a range — but only if the issue is still open in the sheet. */
  const armGuide = (
    range: { start: number; end: number },
    type: 'row' | 'col',
    profile: SheetProfile
  ): boolean => {
    const initialProfile = initialProfileRef.current;

    // Safety guard: If the sheet's title rows are already clean, do NOT arm any row guide for top rows
    if (type === 'row' && profile.titleRows.length === 0 && !profile.dirtyTitleRowRange) {
      if (initialProfile && (initialProfile.titleRows.length > 0 || initialProfile.dirtyTitleRowRange)) {
        retireGuide();
        return false;
      }
    }

    const goal: GuideGoal = {
      kind: deriveGuideGoal(profile, range, type),
      range: { start: range.start, end: range.end },
      type,
      totalRowsAtArm: profile.totalRows,
    };
    if (isGuideGoalResolved(profile, goal, initialProfile)) {
      // Student already fixed this — never (re-)arm a solved guide
      retireGuide();
      return false;
    }
    setCustomHighlightRange((prev) => {
      if (prev && prev.start === range.start && prev.end === range.end && (prev as any).type === type) return prev;
      return { ...range, type };
    });
    setGuideGoal((prev) =>
      prev &&
      prev.kind === goal.kind &&
      prev.range.start === goal.range.start &&
      prev.range.end === goal.range.end &&
      prev.type === goal.type &&
      prev.totalRowsAtArm === goal.totalRowsAtArm
        ? prev
        : goal
    );
    setShowSpotlight(true);
    return true;
  };

  /** Remove the guide entirely (completion, dismiss, new file, cleared context). */
  const retireGuide = () => {
    setShowSpotlight(false);
    setCustomHighlightRange(null);
    setGuideGoal(null);
  };

  // Ref keeps the latest missionProfile available inside streaming callbacks (avoids stale closures)
  const missionProfileRef = useRef<SheetProfile | null>(null);
  missionProfileRef.current = missionProfile;
  // Ref keeps the original profile when file was first opened (for edit diff comparison)
  const initialProfileRef = useRef<SheetProfile | null>(null);
  // Assignment brief: student's project instructions kept in plan memory for the whole session
  const [assignmentBrief, setAssignmentBrief] = useState<string>(() => {
    return localStorage.getItem('khokhi_assignment_brief') || '';
  });
  const [showBriefModal, setShowBriefModal] = useState(false);

  // Structural profile of the active file — attached to every outbound student message
  // (server strips it back out of history; students never see auto-generated chat spam)
  const [activeFileContext, setActiveFileContext] = useState<string | null>(null);
  const [activeContextFileName, setActiveContextFileName] = useState<string | null>(null);

  const toggleMentor = (open?: boolean) => {
    setIsMentorOpen((prev) => {
      const next = typeof open === 'boolean' ? open : !prev;
      localStorage.setItem('khokhi_mentor_open', String(next));
      return next;
    });
  };

  // Remember potato pc mode preference
  const [labMode, setLabMode] = useState<'gridcraft' | 'classic'>(() => {
    return (localStorage.getItem('khokhi_lab_mode') as 'gridcraft' | 'classic') || 'gridcraft';
  });

  const handleSetLabMode = (mode: 'gridcraft' | 'classic') => {
    setLabMode(mode);
    localStorage.setItem('khokhi_lab_mode', mode);
  };

  const [isStreaming, setIsStreaming] = useState(false);

  // Chat history sidebar visibility & active session ID
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Auth & Database state
  const [currentUser, setCurrentUser] = useState<User | null>(getStoredUser());
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState<DBStatus | null>(null);

  // Verify auth session and database status on mount
  useEffect(() => {
    fetchDBStatus().then(setDbStatus);
    apiGetMe().then((user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
      }
    });
  }, []);

  // Audit state
  const [auditStats, setAuditStats] = useState<AuditStats>({
    total_events: 0,
    refusals_intercepted: 0,
    teach_backs_attempted: 0,
    teach_backs_passed: 0,
    student_files_accessed: 0,
    code_deliverables_generated: 0,
    active_students: 1,
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Load user chat history from MongoDB on login / mount + restore active spreadsheet from IndexedDB
  useEffect(() => {
    if (currentUser?.id) {
      apiGetChatHistory().then((history) => {
        if (history && Array.isArray(history.messages) && history.messages.length > 0) {
          setMessages(history.messages);
          if (history.auditStats) {
            setAuditStats(history.auditStats);
          }
          // Restore the coach's knowledge of the student's sheet across sessions
          if (history.fileContext) {
            setActiveFileContext(history.fileContext);
            setActiveContextFileName(history.contextFileName || null);
          }
          // Restore assignment brief if one was active
          if (history.assignmentBrief) {
            setAssignmentBrief(history.assignmentBrief);
            localStorage.setItem('khokhi_assignment_brief', history.assignmentBrief);
          }
          // Restore latest session ID if one exists
          apiListSessions().then((list) => {
            if (list.length > 0) {
              setCurrentSessionId(list[0].id);
            }
          }).catch(() => {});
        }
      });

      // Restore active spreadsheet workbook in GridCraft across browser refresh
      getActiveWorkbookFromLocal(currentUser.id).then((savedWb) => {
        if (savedWb && savedWb.buffer) {
          setExternalWorkbook({
            fileName: savedWb.fileName,
            buffer: savedWb.buffer.slice(0),
          });
          applyMission(savedWb.fileName, savedWb.buffer, savedWb.instructions, true);
        }
      }).catch((e) => console.warn('Could not restore saved workbook:', e));
    } else {
      setMessages([]);
      setCurrentSessionId(null);
      setExternalWorkbook(null);
    }
  }, [currentUser?.id]);

  // Ref to track which assistant message was already processed for spotlight arming
  const lastArmMessageIdRef = useRef<string | null>(null);

  // ── Reactive spotlight: detect row or column mentions in the latest assistant message ──
  // Runs when messages update, but only processes a finished message once
  // so that sheet profile changes or dismisses never resurrect old guides.
  useEffect(() => {
    if (!missionProfile) return;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant' || !lastMsg.text) return;

    if (lastMsg.id === lastArmMessageIdRef.current && lastMsg.status !== 'running') {
      return;
    }

    const text = lastMsg.text;
    const mentionsRows = /(row|rows|title row|banner row|unnecessary row|delete.*row|remove.*row|unmerge)/i.test(text);
    const mentionsCols = /(column|columns|col|cols)\s+([A-Z]|\d+)/i.test(text);
    if (!mentionsRows && !mentionsCols) return;

    if (lastMsg.status !== 'running') {
      lastArmMessageIdRef.current = lastMsg.id;
    }

    // Check columns first if coach is talking about columns (e.g. "columns D to S" or "columns 4 to 18")
    if (mentionsCols) {
      const colParsed = extractColumnRangeFromText(text);
      if (colParsed) {
        armGuide(colParsed, 'col', missionProfile);
        return;
      }
    }

    const parsed = extractRowRangeFromText(text);

    // If the coach suggested specific rows (e.g. rows 2 and 3)
    if (parsed) {
      armGuide(parsed, 'row', missionProfile);
      return;
    }

    // Fallback: point at the dirty title band — armGuide declines if it's already clean
    if (missionProfile.dirtyTitleRowRange) {
      armGuide(missionProfile.dirtyTitleRowRange, 'row', missionProfile);
      return;
    }

    // No targetable range: retire the guide only if what it pointed at is fixed
    if (showSpotlight && (!guideGoal || isGuideGoalResolved(missionProfile, guideGoal, initialProfileRef.current))) {
      retireGuide();
    }
  }, [messages]);

  // ── Auto-retire: as soon as re-profiling shows the guided issue is fixed,
  //    remove the guide (card + highlight band) without waiting for the student ──
  useEffect(() => {
    if (!missionProfile || !showSpotlight) return;
    if (guideGoal && isGuideGoalResolved(missionProfile, guideGoal, initialProfileRef.current)) {
      retireGuide();
    } else if (
      missionProfile.titleRows.length === 0 &&
      !missionProfile.dirtyTitleRowRange &&
      (!guideGoal || guideGoal.kind === 'titles' || guideGoal.kind === 'range')
    ) {
      retireGuide();
    }
  }, [missionProfile, showSpotlight, guideGoal]);

  const handleSendMessage = async (
    text: string,
    overrideFileContext?: string | null,
    overrideBrief?: string | null,
    attachments?: { name: string; type: 'spreadsheet' | 'rubric' }[]
  ) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      text,
      status: 'complete',
      attachments,
    };

    const assistantMsgId = `asst-${Date.now()}`;
    const initialAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      text: '',
      status: 'running',
    };

    const updatedWithUser = [...messages, userMsg];
    setMessages([...updatedWithUser, initialAssistantMsg]);
    setIsStreaming(true);

    const effFileContext = overrideFileContext !== undefined ? overrideFileContext : activeFileContext;
    const effBrief = overrideBrief !== undefined ? overrideBrief : ((assignmentBrief && assignmentBrief !== '__skipped__') ? assignmentBrief : null);

    let latestFullText = '';
    let updatedStats = { ...auditStats };
    let isRefusalMessage = false;

    try {
      await streamBackendChat({
        prompt: text,
        battleId: '01_floating_point',
        messages: updatedWithUser,
        fileContext: effFileContext,
        assignmentBrief: effBrief,
        onThinking: (label) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, thinkingLabel: label } : m
            )
          );
        },
        onRefusal: () => {
          isRefusalMessage = true;
          updatedStats = {
            ...updatedStats,
            refusals_intercepted: updatedStats.refusals_intercepted + 1,
            total_events: updatedStats.total_events + 1,
          };
          setAuditStats(updatedStats);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, isRefusal: true } : m
            )
          );
        },
        onToken: (_delta, fullText) => {
          latestFullText = fullText;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, text: fullText, status: 'running', isRefusal: isRefusalMessage, thinkingLabel: undefined }
                : m
            )
          );

          // Real-time dynamic spotlight detection: if the coach discusses rows to clean, highlight them
          // (armGuide skips issues the student has already resolved)
          const currentProfile = missionProfileRef.current;
          if (currentProfile) {
            const mentionsRows = /(row|rows|title row|banner row|unnecessary row|delete.*row|remove.*row|unmerge)/i.test(fullText);
            if (mentionsRows) {
              const parsed = extractRowRangeFromText(fullText);
              if (parsed) {
                armGuide(parsed, 'row', currentProfile);
              } else if (currentProfile.dirtyTitleRowRange) {
                armGuide(currentProfile.dirtyTitleRowRange, 'row', currentProfile);
              }
            }
          }
        },
      });

      const finalMessages: ChatMessage[] = [
        ...updatedWithUser,
        {
          id: assistantMsgId,
          role: 'assistant',
          text: latestFullText,
          status: 'complete',
          isRefusal: isRefusalMessage,
          thinkingLabel: undefined,
        },
      ];

      setMessages(finalMessages);

      // Final pass spotlight detection upon stream completion (use ref for latest profile)
      const endProfile = missionProfileRef.current;
      if (latestFullText && endProfile) {
        const mentionsRows = /(row|rows|title row|banner row|unnecessary row|delete.*row|remove.*row|unmerge)/i.test(latestFullText);
        if (mentionsRows) {
          const parsed = extractRowRangeFromText(latestFullText);
          if (parsed) {
            armGuide(parsed, 'row', endProfile);
          } else if (endProfile.dirtyTitleRowRange) {
            armGuide(endProfile.dirtyTitleRowRange, 'row', endProfile);
          }
        }
      }

      // Persist conversation to MongoDB Atlas tied to student account
      if (currentUser?.id) {
        const firstUserMsg = finalMessages.find((m) => m.role === 'user');
        const sessionTitle = firstUserMsg?.text?.slice(0, 80) || 'Untitled session';
        const currentBrief = (assignmentBrief && assignmentBrief !== '__skipped__') ? assignmentBrief : null;

        if (!currentSessionId) {
          // Create new session in MongoDB Atlas chat_sessions
          apiSaveSession({
            title: sessionTitle,
            fileName: activeContextFileName,
            messages: finalMessages,
            fileContext: activeFileContext,
            assignmentBrief: currentBrief,
          })
            .then((newId) => {
              if (newId) setCurrentSessionId(newId);
            })
            .catch((e) => console.warn('Could not save session to MongoDB:', e));
        } else {
          // Update existing session in MongoDB Atlas chat_sessions
          apiUpdateSession(currentSessionId, {
            title: sessionTitle,
            fileName: activeContextFileName,
            messages: finalMessages,
            fileContext: activeFileContext,
            assignmentBrief: currentBrief,
          }).catch((e) => console.warn('Could not update session in MongoDB:', e));
        }

        // Also sync to active user_chats for instant restore on refresh
        apiSaveChatHistory({
          messages: finalMessages,
          battleId: '01_floating_point',
          auditStats: updatedStats,
          fileContext: activeFileContext,
          contextFileName: activeContextFileName,
          assignmentBrief: currentBrief,
        }).catch((e) => console.warn('Could not sync chat to MongoDB:', e));
      }
    } catch (err: any) {
      const errorMessages: ChatMessage[] = [
        ...updatedWithUser,
        {
          id: assistantMsgId,
          role: 'assistant',
          text: `[Error communicating with backend: ${err.message}]`,
          status: 'complete',
        },
      ];
      setMessages(errorMessages);

      if (currentUser?.id) {
        apiSaveChatHistory({
          messages: errorMessages,
          battleId: '01_floating_point',
          auditStats: updatedStats,
          fileContext: activeFileContext,
          contextFileName: activeContextFileName,
        }).catch(() => {});
      }
    } finally {
      setIsStreaming(false);
    }
  };

  const handleClearChat = async () => {
    setMessages([]);
    setCurrentSessionId(null);
    // Deep wipe of loaded workbook, context, queues, and profiling so a new chat starts with a clean slate
    handleClearFileContext();
    // Reset brief for the fresh new chat so past assignment goals don't pollute this project
    setAssignmentBrief('');
    localStorage.removeItem('khokhi_assignment_brief');
    if (currentUser?.id) {
      await apiClearChatHistory();
    }
  };

  /** Restore a past session from the history sidebar */
  const handleRestoreSession = (
    restoredMessages: ChatMessage[],
    title: string,
    fileName: string | null,
    sessionId: string,
    fileContext: string | null,
    brief?: string | null
  ) => {
    setMessages(restoredMessages);
    setCurrentSessionId(sessionId);
    setActiveContextFileName(fileName || null);
    setActiveFileContext(fileContext || null);
    const restoredBrief = brief || '';
    setAssignmentBrief(restoredBrief);
    if (restoredBrief && restoredBrief !== '__skipped__') {
      localStorage.setItem('khokhi_assignment_brief', restoredBrief);
    } else {
      localStorage.removeItem('khokhi_assignment_brief');
    }
    setIsMentorOpen(true);
    setShowHistorySidebar(false);

    // Sync restored session as the active user chat
    if (currentUser?.id) {
      apiSaveChatHistory({
        messages: restoredMessages,
        battleId: '01_floating_point',
        auditStats,
        fileContext,
        contextFileName: fileName,
        assignmentBrief: (restoredBrief && restoredBrief !== '__skipped__') ? restoredBrief : null,
      }).catch(() => {});
    }
  };

  // Chat attach: spreadsheets open directly in Excel Studio (no blocking modal);
  // the panel auto-fills on attach and the profile rides along as silent context.
  const applyMission = (fileName: string, buffer: ArrayBuffer, instructions?: string, isInitialUpload = false) => {
    try {
      const { profile } = profileWorkbook(fileName, buffer, instructions);
      if (isInitialUpload || !initialProfileRef.current) {
        initialProfileRef.current = profile;
      }
      setMissionProfile(profile);
      setMissionSteps(buildMissionSteps(profile));
      setCompletedSteps([]);
      setShowOriginal(false);
      // If the student cleaned title rows or sheet has no title rows, retire the guide
      if (profile.titleRows.length === 0 && !profile.dirtyTitleRowRange) {
        retireGuide();
      } else {
        setShowSpotlight(false);
        setCustomHighlightRange(null);
      }
      // Context rides silently with the student's own messages — compares against initialProfileRef
      setActiveFileContext(buildFileContext(profile, instructions, initialProfileRef.current));
      setActiveContextFileName(fileName);
    } catch {
      setMissionProfile(null);
      setMissionSteps([]);
      setCompletedSteps([]);
      setShowOriginal(false);
      setShowSpotlight(false);
      setCustomHighlightRange(null);
      setActiveFileContext(null);
      setActiveContextFileName(null);
    }
  };

  const handleClearFileContext = () => {
    if (currentUser?.id) {
      clearActiveWorkbookFromLocal(currentUser.id).catch(() => {});
    }
    initialProfileRef.current = null;
    setActiveFileContext(null);
    setActiveContextFileName(null);
    setMissionProfile(null);
    setMissionSteps([]);
    setCompletedSteps([]);
    setShowOriginal(false);
    setShowSpotlight(false);
    setCustomHighlightRange(null);
    setExternalWorkbook(null);
    setFileQueue([]);
    setQueueIndex(0);
    retireGuide();
  };

  const openWorkbookInStudio = (fileName: string, buffer: ArrayBuffer, instructions: string, rest: QueuedFile[] = []) => {
    // New workbook → the previous sheet's guide no longer applies
    retireGuide();
    const { fileName: normName, buffer: normBuffer } = normalizeWorkbookBuffer(fileName, buffer);
    const queue: QueuedFile[] = [{ fileName: normName, buffer: normBuffer, instructions }, ...rest];
    setFileQueue(queue);
    setQueueIndex(0);

    handleSetLabMode('gridcraft');
    toggleMentor(true);
    setExternalWorkbook({ fileName: normName, buffer: normBuffer.slice(0) });

    // Persist to IndexedDB so student never loses their workbook upon browser refresh
    if (currentUser?.id) {
      saveActiveWorkbookToLocal(currentUser.id, normName, normBuffer, instructions).catch(() => {});
    }

    // Load file + attach context — student sends their own message when ready
    initialProfileRef.current = null;
    applyMission(normName, normBuffer, instructions, true);
  };

  const goToNextFile = () => {
    if (queueIndex + 1 >= fileQueue.length) return;
    const next = queueIndex + 1;
    setQueueIndex(next);
    const f = fileQueue[next];
    setExternalWorkbook({ fileName: f.fileName, buffer: f.buffer.slice(0) });
    applyMission(f.fileName, f.buffer, f.instructions);
  };

  const toggleMissionStep = (stepId: string) => {
    setCompletedSteps((prev) =>
      prev.includes(stepId) ? prev.filter((id) => id !== stepId) : [...prev, stepId]
    );
  };

  const askCoachAboutStep = (step: MissionStep) => {
    toggleMentor(true);
    handleSendMessage(step.coachPrompt);
  };

  const handleLogout = () => {
    clearStoredAuth(); // clears auth token + ALL khokhi_ keys (brief, prefs, etc.)
    setCurrentUser(null);
    setMessages([]);
    setIsUserMenuOpen(false);
    setAssignmentBrief('');
  };

  // Silent setter: applies the brief without sending a chat message
  // (the brief rides along on every /api/chat/stream payload instead).
  const handleSetBrief = (brief: string) => {
    setAssignmentBrief(brief);
    localStorage.setItem('khokhi_assignment_brief', brief);
  };

  // Modal save: silent set + close + one acknowledgement message
  const handleSaveBrief = (brief: string) => {
    handleSetBrief(brief);
    setShowBriefModal(false);
    handleSendMessage(
      `I have a new assignment. Here are my instructions: ${brief.slice(0, 400)}${brief.length > 400 ? '...' : ''}`
    );
  };

  const handleSkipBrief = () => {
    setShowBriefModal(false);
    // If no brief was previously set, persist a marker so modal doesn't reappear this session
    if (!assignmentBrief) {
      localStorage.setItem('khokhi_assignment_brief', '__skipped__');
      setAssignmentBrief('__skipped__');
    }
  };

  // Gatekeeper: If user is not signed in, show AuthPage
  if (!currentUser) {
    return (
      <AuthPage
        onSuccess={(user) => setCurrentUser(user)}
        dbStatus={dbStatus}
      />
    );
  }

  const isEmpty = messages.length === 0;

  // Initials for avatar
  const userInitials = currentUser?.name
    ? currentUser.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'K';

  return (
    <div className="h-screen w-screen bg-[#f5f5f7] text-[#0d0d0d] flex flex-col font-sans antialiased overflow-hidden">
      {/* ── Top Navigation Bar ─────────────────────────────────────────── */}
      <header className="h-14 shrink-0 z-20 flex items-center justify-between px-4 sm:px-6 bg-white/95 backdrop-blur-md border-b border-neutral-200/70 shadow-[0_1px_12px_rgba(0,0,0,0.06)]">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white border border-neutral-200/80 p-1 shadow-2xs flex items-center justify-center shrink-0">
            <img
              src="/khokhi.png"
              alt="Khokhi Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex flex-col justify-center">
            <span className="font-bold text-[14px] tracking-tight text-neutral-900 leading-none">Khokhi</span>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => toggleMentor()}
            title={isMentorOpen ? 'Full Excel view' : 'Open Khokhi'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all text-[11px] font-semibold cursor-pointer ${
              isMentorOpen
                ? 'bg-neutral-100 border-neutral-200/80 text-neutral-700 hover:bg-neutral-200/70'
                : 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
            }`}
          >
            {isMentorOpen ? (
              <><PanelRightClose className="w-3.5 h-3.5" /><span className="hidden md:inline">Full Excel</span></>
            ) : (
              <><PanelRightOpen className="w-3.5 h-3.5" /><span className="hidden md:inline">Ask Khokhi</span></>
            )}
          </button>

          {auditStats.refusals_intercepted > 0 && (
            <span className="hidden lg:inline text-[10px] font-bold font-mono text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              {auditStats.refusals_intercepted} blocks
            </span>
          )}

          {/* User dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-full bg-neutral-100 hover:bg-neutral-200/70 border border-neutral-200/80 transition-colors cursor-pointer"
            >
              <div className="w-6 h-6 rounded-full brand-badge text-white flex items-center justify-center text-[10px] font-bold">
                {userInitials}
              </div>
              <span className="text-[12px] font-semibold text-neutral-800 max-w-[100px] truncate hidden sm:inline">
                {currentUser.name.split(' ')[0]}
              </span>
              <ChevronDown className="w-3 h-3 text-neutral-400" />
            </button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl border border-neutral-200/80 shadow-[0_8px_40px_rgba(0,0,0,0.12)] py-2 z-30 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-4 py-3 border-b border-neutral-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full brand-badge text-white flex items-center justify-center text-[12px] font-bold shrink-0">
                      {userInitials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-neutral-900 truncate">{currentUser.name}</p>
                      <p className="text-[10px] text-neutral-400 truncate">{currentUser.email}</p>
                    </div>
                  </div>
                </div>

                <div className="px-4 py-2.5 border-b border-neutral-100 text-[11px] text-neutral-600 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Database className="w-3 h-3 text-neutral-400" />
                    Database
                  </span>
                  <span className="font-bold text-emerald-700 font-mono text-[10px] bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                    {dbStatus?.database || 'MongoDB'}
                  </span>
                </div>

                <button
                  onClick={() => {
                    setShowBriefModal(true);
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-[12px] font-medium text-neutral-700 hover:bg-neutral-50 flex items-center gap-2.5 transition-colors cursor-pointer border-b border-neutral-100"
                >
                  <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{assignmentBrief ? 'Update Assignment Brief' : 'Set Assignment Brief'}</span>
                  {assignmentBrief && (
                    <span className="ml-auto text-[9px] font-bold uppercase tracking-wide text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-full">Active</span>
                  )}
                </button>

                <button
                  onClick={() => {
                    setIsMentorOpen(true);
                    setShowHistorySidebar(true);
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-[12px] font-medium text-neutral-700 hover:bg-neutral-50 flex items-center gap-2.5 transition-colors cursor-pointer border-b border-neutral-100"
                >
                  <History className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Past Chat History</span>
                </button>

                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2.5 text-left text-[12px] font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Main Excel Studio View (Side-by-side with Khokhi Mentor) */}
        <div className="flex-1 flex overflow-hidden p-2.5 sm:p-3 gap-2.5 bg-[#ebebeb] w-full">
          {/* Excel Area: expands to 100% when mentor closed, shrinks gently to ~70% when mentor open */}
          <main
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const file = e.dataTransfer.files?.[0];
              if (file && /\.(xlsx|xls|xlsm|csv|ods|tsv)$/i.test(file.name)) {
                const reader = new FileReader();
                reader.onload = (evt) => {
                  const raw = evt.target?.result as ArrayBuffer;
                  if (!raw) return;
                  openWorkbookInStudio(file.name, raw, '');
                };
                reader.readAsArrayBuffer(file);
              }
            }}
            className="flex-1 min-w-0 h-full overflow-hidden flex flex-col"
          >
            {labMode === 'gridcraft' ? (
              <div className="flex-1 min-h-0">
                <GridCraftEmbed
                  externalWorkbook={externalWorkbook}
                  onSwitchToClassic={() => handleSetLabMode('classic')}
                  onAskMentor={(prompt) => {
                    toggleMentor(true);
                    handleSendMessage(prompt);
                  }}
                  originalProfile={missionProfile}
                  originalVisible={showOriginal}
                  onToggleOriginal={() => setShowOriginal((v) => !v)}
                  showSpotlight={showSpotlight}
                  onToggleSpotlight={(val) => {
                    if (!val) {
                      retireGuide();
                    } else {
                      setShowSpotlight(true);
                    }
                  }}
                  customHighlightRange={customHighlightRange}
                  nextFileLabel={
                    fileQueue.length > 1 && queueIndex < fileQueue.length - 1
                      ? `${queueIndex + 1}/${fileQueue.length}`
                      : undefined
                  }
                  onNextFile={fileQueue.length > 1 && queueIndex < fileQueue.length - 1 ? goToNextFile : undefined}
                  onWorkbookSaved={(fileName, buffer) => {
                    if (currentUser?.id) {
                      saveActiveWorkbookToLocal(currentUser.id, fileName, buffer).catch(() => {});
                    }
                    applyMission(fileName, buffer);
                  }}
                />
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
                <div className="flex items-center justify-between bg-white px-4 py-2 rounded-lg border border-neutral-200 shadow-2xs shrink-0">
                  <span className="text-xs text-neutral-600 flex items-center gap-1.5 font-medium">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>Potato PC Mode Active (Ultra-lightweight, 0% GPU load)</span>
                  </span>
                  <button
                    onClick={() => handleSetLabMode('gridcraft')}
                    className="text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-md font-medium transition-colors shadow-2xs cursor-pointer"
                  >
                    Switch to Pro Studio 🚀
                  </button>
                </div>
                <div className="flex-1 min-h-0 bg-white rounded-xl border border-neutral-200/90 overflow-hidden shadow-2xs">
                  <ExcelSimulator externalWorkbook={externalWorkbook} />
                </div>
              </div>
            )}
          </main>

          {/* Side-by-Side Compact Mentor Panel with In-Chat File Upload */}
          <CompactMentorPanel
            isOpen={isMentorOpen}
            onClose={() => toggleMentor(false)}
            messages={messages}
            isRunning={isStreaming}
            onSend={(text, attachments) => handleSendMessage(text, undefined, undefined, attachments)}
            onClear={handleClearChat}
            refusalsCount={auditStats.refusals_intercepted}
            onAutoFillSpreadsheet={(fileName, buffer) => {
              openWorkbookInStudio(fileName, buffer, '');
            }}
            contextFileName={activeContextFileName}
            showHistory={showHistorySidebar}
            onToggleHistory={(show) => setShowHistorySidebar(show)}
            onRestoreSession={handleRestoreSession}
            activeSessionId={currentSessionId}
            onClearFileContext={handleClearFileContext}
            assignmentBrief={assignmentBrief}
            onUpdateBrief={handleSetBrief}
            onClearBrief={() => {
              setAssignmentBrief('');
              localStorage.removeItem('khokhi_assignment_brief');
            }}
          />

        </div>

      </div>

      {/* Assignment Brief Modal — manual entry via user menu 'Set Assignment Brief'
          (the panel's Rubric button opens an inline strip instead; no first-login auto-show) */}
      {showBriefModal && (
        <ProjectBriefModal
          onSave={handleSaveBrief}
          onSkip={handleSkipBrief}
          existingBrief={assignmentBrief === '__skipped__' ? '' : assignmentBrief}
        />
      )}
    </div>
  );
};
