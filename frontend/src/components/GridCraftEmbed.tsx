import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Upload,
  Download,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  Eye,
  EyeOff,
  ChevronRight,
  Target,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { GridCraftBridge, GridCraftFilePayload } from './GridCraftBridge';
import { OriginalSnapshot } from './OriginalSnapshot';
import { CoachSpotlightOverlay } from './CoachSpotlightOverlay';
import { SheetProfile } from '../utils/sheetProfiler';

interface GridCraftEmbedProps {
  onSwitchToClassic?: () => void;
  onAskMentor?: (contextPrompt: string) => void;
  externalWorkbook?: { fileName: string; buffer: ArrayBuffer } | null;
  /** Read-only original snapshot of the loaded file (trap rows highlighted) */
  originalProfile?: SheetProfile | null;
  originalVisible?: boolean;
  onToggleOriginal?: () => void;
  /** Multi-file queue: label like "3/26" + jump to next */
  nextFileLabel?: string;
  onNextFile?: () => void;
  onWorkbookSaved?: (fileName: string, buffer: ArrayBuffer) => void;
  showSpotlight?: boolean;
  onToggleSpotlight?: (val: boolean) => void;
  customHighlightRange?: { start: number; end: number } | null;
}

export const GridCraftEmbed: React.FC<GridCraftEmbedProps> = ({
  onSwitchToClassic,
  onAskMentor,
  externalWorkbook,
  originalProfile,
  originalVisible = false,
  onToggleOriginal,
  nextFileLabel,
  onNextFile,
  onWorkbookSaved,
  showSpotlight,
  onToggleSpotlight,
  customHighlightRange,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgeRef = useRef<GridCraftBridge | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEngineReady, setIsEngineReady] = useState(false);
  const [engineVersion, setEngineVersion] = useState<string>('');
  const [isDirty, setIsDirty] = useState(false);
  const [currentFileName, setCurrentFileName] = useState<string>('Practice_Workbook.xlsx');
  const [statusMessage, setStatusMessage] = useState<string>('Initializing Excel Studio...');
  const [savedCount, setSavedCount] = useState<number>(0);
  const [internalSpotlight, setInternalSpotlight] = useState<boolean>(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // When profile updates, check if title rows were removed and celebrate!
  useEffect(() => {
    if (originalProfile && originalProfile.titleRows.length === 0 && (!originalProfile.dirtyTitleRowRange || originalProfile.dirtyTitleRowRange.end < 1)) {
      if (onToggleSpotlight) onToggleSpotlight(false);
      setInternalSpotlight(false);
      setSuccessBanner('Great work! Title banner rows removed. Row headers are now clean.');
      const timer = setTimeout(() => setSuccessBanner(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [originalProfile?.totalRows, originalProfile?.titleRows.length]);

  const isSpotlightActive = showSpotlight !== undefined ? showSpotlight : internalSpotlight;
  const toggleSpotlight = () => {
    const next = !isSpotlightActive;
    if (onToggleSpotlight) {
      onToggleSpotlight(next);
    } else {
      setInternalSpotlight(next);
    }
  };

  const autoSaveTimerRef = useRef<any>(null);

  // Initialize the bridge
  useEffect(() => {
    const bridge = new GridCraftBridge({
      onReady: (version) => {
        setIsEngineReady(true);
        setEngineVersion(version);
        setStatusMessage(`Excel Studio ready`);
      },
      onDirtyChange: (dirty) => {
        setIsDirty(dirty);
        // Real-time background auto-save: when user makes changes (deletes row, edits cell),
        // trigger background sync after 1.2s of inactivity so profile and guide update in real time
        if (dirty) {
          if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
          autoSaveTimerRef.current = setTimeout(() => {
            bridgeRef.current?.triggerSave();
          }, 1200);
        }
      },
      onSave: (file: GridCraftFilePayload) => {
        setSavedCount((c) => c + 1);
        setIsDirty(false);
        setStatusMessage(`Workbook synced in real-time`);

        // Notify parent so real-time profiling can re-evaluate the cleaned sheet immediately!
        onWorkbookSaved?.(file.name, file.bytes);
      },
      onError: (err) => {
        setStatusMessage(`Spreadsheet warning: ${err}`);
      },
    });

    bridgeRef.current = bridge;

    if (iframeRef.current) {
      bridge.attach(iframeRef.current);
    }

    return () => {
      bridge.detach();
    };
  }, []);

  // Open workbook file
  const handleOpenWorkbook = useCallback((name: string, data: ArrayBuffer | Uint8Array) => {
    if (!bridgeRef.current) return;
    setCurrentFileName(name);
    bridgeRef.current.openWorkbook(name, data);
    setStatusMessage(`Loaded: ${name}`);
  }, []);

  // Keep status visible when a chat upload arrives before the engine is ready
  useEffect(() => {
    if (externalWorkbook && !isEngineReady) {
      setStatusMessage(`Waiting for Excel Studio… will open ${externalWorkbook.fileName}`);
    }
  }, [externalWorkbook, isEngineReady]);

  // Sync external workbook uploaded via chat or modal.
  // Re-open whenever fileName changes OR the same file is re-attached (new buffer identity).
  const lastOpenedRef = useRef<{ name: string; buffer: ArrayBuffer } | null>(null);

  useEffect(() => {
    if (!externalWorkbook) {
      if (lastOpenedRef.current && isEngineReady) {
        // Reset GridCraft canvas back to a clean empty workbook
        try {
          const wb = XLSX.utils.book_new();
          const ws = XLSX.utils.aoa_to_sheet([[]]);
          XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
          const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
          handleOpenWorkbook('Practice_Workbook.xlsx', buf);
          setStatusMessage('Excel Studio ready');
        } catch (err) {
          console.warn('Could not reset GridCraft to empty workbook:', err);
        }
      }
      lastOpenedRef.current = null;
      setCurrentFileName('Practice_Workbook.xlsx');
      return;
    }
    if (!isEngineReady) return;
    const last = lastOpenedRef.current;
    if (last && last.name === externalWorkbook.fileName && last.buffer === externalWorkbook.buffer) {
      return;
    }
    lastOpenedRef.current = { name: externalWorkbook.fileName, buffer: externalWorkbook.buffer };
    try {
      handleOpenWorkbook(externalWorkbook.fileName, externalWorkbook.buffer);
      setStatusMessage(`Opened from chat: ${externalWorkbook.fileName}`);
    } catch (err) {
      setStatusMessage(`Could not open ${externalWorkbook.fileName}`);
      console.error('GridCraft open failed', err);
    }
  }, [externalWorkbook, isEngineReady, handleOpenWorkbook]);

  // Upload local file from user computer
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      if (buffer) {
        handleOpenWorkbook(file.name, buffer);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };


  return (
    <div className="flex flex-col w-full h-full bg-white rounded-xl border border-neutral-200/70 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.07),0_1px_3px_rgba(0,0,0,0.04)]">
      {/* ── Control Top Bar ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-neutral-50/80 border-b border-neutral-200/80 text-xs text-neutral-700">
        {/* Left: Engine & File Info */}
        <div className="flex items-center gap-3">

          {/* File name */}
          <div className="flex items-center gap-1.5 text-neutral-600">
            <FileSpreadsheet className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <span className="font-semibold text-[12px] text-neutral-800 truncate max-w-[200px]" title={currentFileName}>
              {currentFileName}
            </span>
            {isDirty && (
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500 shadow-sm" title="Unsaved changes" />
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5">


          {onToggleOriginal && originalProfile && (
            <button
              onClick={onToggleOriginal}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all text-[11px] font-semibold ${
                originalVisible
                  ? 'bg-neutral-900 border-neutral-900 text-white hover:bg-neutral-800'
                  : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 shadow-sm'
              }`}
              title="View original sheet before cleaning"
            >
              {originalVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              <span>Original</span>
            </button>
          )}

          {/* Guide spotlight toggle */}
          {(customHighlightRange || (originalProfile && (originalProfile.titleRows.length > 0 || originalProfile.subtotalRows.length > 0 || originalProfile.dirtyTitleRowRange))) && (
            <button
              onClick={toggleSpotlight}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all text-[11px] font-semibold ${
                isSpotlightActive
                  ? 'bg-rose-600 border-rose-600 text-white hover:bg-rose-700 shadow-sm'
                  : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 shadow-sm'
              }`}
              title="Highlight target rows to clean"
            >
              <Target className="w-3 h-3" />
              <span>Guide</span>
              {isSpotlightActive && (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />
              )}
            </button>
          )}

          {nextFileLabel && onNextFile && (
            <button
              onClick={onNextFile}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 transition-colors text-[11px] font-semibold shadow-sm"
              title="Open next spreadsheet in queue"
            >
              <span>Next</span>
              <span className="font-mono text-neutral-500">{nextFileLabel}</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          )}

        </div>
      </div>

      {/* Lightweight WebGL2 Frame Container */}
      <div className="relative flex-1 w-full bg-[#f3f3f3]">
        {!isEngineReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-50/90 z-10 gap-2.5">
            <div className="w-7 h-7 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-medium text-neutral-600">{statusMessage}</p>
            <p className="text-[11px] text-neutral-400">Hardware-accelerated spreadsheet engine loading</p>
          </div>
        )}

        {/* Note: &webgl forces lightweight WebGL2 instead of heavy WebGPU shader loops */}
        <iframe
          ref={iframeRef}
          src="/gridcraft/index.html?host=parent&webgl&author=Student"
          className="w-full h-full border-none"
          title="Excel Studio"
          loading="lazy"
        />

        {/* Real-time Success Notification Toast */}
        {successBanner && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-none">
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-emerald-900/95 backdrop-blur-md text-white rounded-xl shadow-2xl border border-emerald-500/40 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successBanner}</span>
            </div>
          </div>
        )}

        {/* Read-only original snapshot — solid overlay over the sheet area only */}
        {originalProfile && (
          <OriginalSnapshot
            profile={originalProfile}
            visible={originalVisible}
            onToggle={onToggleOriginal || (() => {})}
          />
        )}

        {/* Coach Spotlight Overlay — visually targets dirty rows with click guidance */}
        {isSpotlightActive && !originalVisible && (
          <CoachSpotlightOverlay
            profile={originalProfile ?? null}
            onOpenXray={onToggleOriginal}
            customRange={customHighlightRange}
            onDismiss={() => {
              if (onToggleSpotlight) onToggleSpotlight(false);
              setInternalSpotlight(false);
            }}
            onCompleteCleaned={() => {
              bridgeRef.current?.triggerSave();
              if (onToggleSpotlight) onToggleSpotlight(false);
              setInternalSpotlight(false);
              setSuccessBanner('Great work! Title banner rows removed. Row headers are now clean.');
              setTimeout(() => setSuccessBanner(null), 6000);
            }}
          />
        )}
      </div>

      {/* ── Status Ribbon ───────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-neutral-50/80 border-t border-neutral-200/80 text-[10px] text-neutral-400">
        <div className="flex items-center gap-1.5">
          {!isEngineReady && (
            <>
              <span className="w-2 h-2 rounded-full shrink-0 bg-amber-400 animate-pulse" />
              <span className="font-semibold text-amber-600">{statusMessage}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {savedCount > 0 && (
            <span className="text-emerald-700 font-semibold font-mono bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
              ✓ Saved ×{savedCount}
            </span>
          )}
          {isDirty && (
            <span className="text-amber-600 font-semibold">● Unsaved changes</span>
          )}
        </div>
      </div>
    </div>
  );
};
