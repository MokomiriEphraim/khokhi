import React, { useState } from 'react';
import { Target, X, Eye, EyeOff, Trash2, CheckCircle2, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { SheetProfile } from '../utils/sheetProfiler';

interface CoachSpotlightOverlayProps {
  profile: SheetProfile | null;
  onOpenXray?: () => void;
  customRange?: { start: number; end: number; type?: 'row' | 'col' } | null;
  onCompleteCleaned?: () => void;
  onDismiss?: () => void;
}

// GridCraft WebGL canvas layout constants (measured)
const GRID_CANVAS_TOP_OFFSET = 206;
const ROW_HEADER_WIDTH = 48;
const ROW_HEIGHT = 22;
const COL_WIDTH = 95; // Average default column width in GridCraft

export const CoachSpotlightOverlay: React.FC<CoachSpotlightOverlayProps> = ({
  profile,
  onOpenXray,
  customRange,
  onCompleteCleaned,
  onDismiss,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [showHighlightBand, setShowHighlightBand] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Re-enable spotlight whenever Khokhi mentions a new range
  React.useEffect(() => {
    if (customRange) {
      setIsDismissed(false);
      setShowHighlightBand(true);
    }
  }, [customRange?.start, customRange?.end, (customRange as any)?.type]);

  if (!profile || isDismissed) return null;

  const isColHighlight = customRange?.type === 'col';
  const headerRowNo = profile.primaryHeaderRow ?? profile.detectedHeaderRowIndex;

  const hasDirtyTitleRows =
    (profile.titleRows && profile.titleRows.length > 0) ||
    Boolean(profile.dirtyTitleRowRange);
  const hasDirtySubtotals = Boolean(profile.subtotalRows && profile.subtotalRows.length > 0);
  const hasDirtyFootnotes = Boolean(profile.footnoteRows && profile.footnoteRows.length > 0);

  // If the sheet's title rows are already clean and there are no subtotals, footnotes, or column targets,
  // the guide must not hang over clean data!
  if (!isColHighlight && !hasDirtyTitleRows && !hasDirtySubtotals && !hasDirtyFootnotes) {
    return null;
  }

  let targetStart = customRange?.start ?? profile.dirtyTitleRowRange?.start ?? 1;
  let targetEnd =
    customRange?.end ??
    profile.dirtyTitleRowRange?.end ??
    (headerRowNo > 1 ? headerRowNo - 1 : 1);

  // If the parsed range accidentally targeted only the header row itself (e.g. start=8, end=8)
  // while the sheet has dirty title rows before it (rows 1 to 7), fallback to dirtyTitleRowRange
  if (!customRange && targetStart >= headerRowNo && profile.dirtyTitleRowRange) {
    targetStart = profile.dirtyTitleRowRange.start;
    targetEnd = profile.dirtyTitleRowRange.end;
  }

  const hasRangeToHighlight = targetEnd >= targetStart && targetEnd > 0;
  const firstTitle = profile.titleRows[0]?.text || '';
  const topHeaders = profile.headers.slice(0, 4).filter(Boolean).join(', ');

  const colLetter = (idx: number) => {
    let letter = '';
    while (idx > 0) {
      const mod = (idx - 1) % 26;
      letter = String.fromCharCode(65 + mod) + letter;
      idx = Math.floor((idx - mod) / 26);
    }
    return letter;
  };

  const subtotalMatch = !isColHighlight
    ? profile.subtotalRows.find((r) => r.rowIndex >= targetStart && r.rowIndex <= targetEnd)
    : undefined;
  const isSubtotalTarget = Boolean(subtotalMatch);
  const footnoteMatch = !isColHighlight
    ? profile.footnoteRows.find((r) => r.rowIndex >= targetStart && r.rowIndex <= targetEnd)
    : undefined;
  const isFootnoteTarget = Boolean(footnoteMatch);

  const guideTitle = isColHighlight
    ? 'Column Guide'
    : isSubtotalTarget
    ? 'Subtotal Guide'
    : isFootnoteTarget
    ? 'Footnote Guide'
    : 'Row Guide';

  const guideSubtitle = isColHighlight
    ? `Columns ${colLetter(targetStart)} to ${colLetter(targetEnd)} · Format numbers`
    : isSubtotalTarget
    ? `Row ${targetStart} · Remove summary subtotal`
    : isFootnoteTarget
    ? `Row ${targetStart} · Remove footnote/notes`
    : `Rows ${targetStart} to ${targetEnd} · Target range`;

  const whyMatters = isColHighlight
    ? 'Formatting anomalies or numbers stored as text prevent formulas and aggregations in SQL and Power BI.'
    : isSubtotalTarget
    ? 'Totals and subtotals cause double-counting in SQL and Power BI measures. Totals belong in DAX formulas, not raw data rows.'
    : isFootnoteTarget
    ? 'Footnotes and source text at the bottom corrupt data types and break automated pipeline ingestion.'
    : 'These title/banner rows break SQL imports and Python pipelines — they must be removed before your data is usable.';

  const foundSnippet = isSubtotalTarget
    ? subtotalMatch?.label || 'TOTAL'
    : isFootnoteTarget
    ? footnoteMatch?.text || ''
    : firstTitle;

  const resultText = isColHighlight
    ? 'Columns cleaned and formatted as numeric values ready for analysis!'
    : isSubtotalTarget
    ? 'Subtotal removed — prevents double-counting in SQL and Power BI calculations!'
    : isFootnoteTarget
    ? 'Footnote removed — bottom of the table is now clean data rows!'
    : `Row ${headerRowNo} shifts up to Row 1 — your clean column headers!`;

  // Row band metrics
  const bandTop = GRID_CANVAS_TOP_OFFSET + (targetStart - 1) * ROW_HEIGHT;
  const rowCount = targetEnd - targetStart + 1;
  const bandHeight = rowCount * ROW_HEIGHT;

  // Column band metrics (columns start after row header)
  const colLeft = ROW_HEADER_WIDTH + (targetStart - 1) * COL_WIDTH;
  const colCount = targetEnd - targetStart + 1;
  const colWidth = colCount * COL_WIDTH;

  return (
    <>
      {/* ── Visual highlight band over the target rows or columns ─────────────── */}
      {showHighlightBand && hasRangeToHighlight && (
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
          {isColHighlight ? (
            /* Column highlight band */
            <div
              className="absolute transition-all duration-300"
              style={{ top: `${GRID_CANVAS_TOP_OFFSET - 22}px`, left: `${colLeft}px`, width: `${colWidth}px`, bottom: '24px' }}
            >
              {/* Top column letters header badge */}
              <div className="h-[22px] bg-indigo-500/25 border-b-2 border-indigo-600 flex items-center justify-center">
                <span className="text-[9px] font-bold text-indigo-900 bg-white/95 px-1.5 py-0.5 rounded shadow-sm font-mono border border-indigo-200">
                  Cols {colLetter(targetStart)}–{colLetter(targetEnd)}
                </span>
              </div>
              {/* Column cells overlay */}
              <div className="w-full h-[calc(100%-22px)] rounded-b-lg border-2 border-dashed border-indigo-500/70 bg-indigo-500/8 relative">
                <div className="absolute top-2 left-2 bg-indigo-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-md shadow-md flex items-center gap-1.5">
                  <Target className="w-3 h-3" />
                  <span>Columns {colLetter(targetStart)}–{colLetter(targetEnd)} · Select these</span>
                </div>
              </div>
            </div>
          ) : (
            /* Row highlight band */
            <>
              {/* Left margin — row numbers highlight zone */}
              <div
                className="absolute transition-all duration-300"
                style={{ top: `${bandTop}px`, left: '0px', width: `${ROW_HEADER_WIDTH}px`, height: `${bandHeight}px` }}
              >
                <div className="w-full h-full bg-rose-500/20 border-r-2 border-rose-500 flex flex-col items-center justify-center spotlight-shimmer">
                  <span className="text-[9px] font-bold text-rose-900 bg-white/95 px-1.5 py-0.5 rounded shadow-sm font-mono border border-rose-200">
                    {targetStart}–{targetEnd}
                  </span>
                </div>

                {/* Animated instruction pointer */}
                <div className="absolute top-1/2 -translate-y-1/2 left-0 flex items-center pointer-events-none">
                  <div
                    className="ml-12 whitespace-nowrap bg-neutral-900/95 backdrop-blur-sm text-white text-[10px] font-semibold px-3 py-1.5 rounded-lg shadow-xl flex items-center gap-1.5 border border-neutral-700/50"
                    style={{ animation: 'bounce 1.8s ease-in-out infinite' }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                    <span>Click row {targetStart}, hold Shift, click row {targetEnd}</span>
                  </div>
                </div>
              </div>

              {/* Grid cells — dashed overlay over dirty rows */}
              <div
                className="absolute transition-all duration-300"
                style={{ top: `${bandTop}px`, left: `${ROW_HEADER_WIDTH}px`, right: '16px', height: `${bandHeight}px` }}
              >
                <div className="w-full h-full rounded-r-lg border-2 border-dashed border-rose-500/70 bg-rose-500/8 relative">
                  {/* Label badge top-right */}
                  <div className="absolute top-1.5 right-2 bg-rose-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-md shadow-md flex items-center gap-1.5">
                    <Trash2 className="w-3 h-3" />
                    <span>Rows {targetStart}–{targetEnd} · Target range</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Coach HUD Card (bottom-right, non-blocking) ─────────────── */}
      <div className="absolute bottom-4 right-4 z-30 w-[320px] transition-all duration-200">
        {isCollapsed ? (
          /* Minimized pill */
          <div className="flex items-center justify-between gap-2 bg-neutral-900/96 backdrop-blur-md text-white px-3.5 py-2.5 rounded-xl border border-neutral-700/60 shadow-2xl text-xs">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-rose-500/20 border border-rose-500/30">
                <Target className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <span className="font-semibold text-[12px]">
                {guideTitle}: {guideSubtitle}
              </span>
            </div>
            <button
              onClick={() => setIsCollapsed(false)}
              className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-medium border border-neutral-700"
            >
              <span>Expand</span>
              <ChevronUp className="w-3 h-3" />
            </button>
          </div>
        ) : (
          /* Expanded HUD card */
          <div className="bg-white/97 backdrop-blur-xl rounded-2xl border border-rose-200/60 shadow-[0_8px_40px_rgba(0,0,0,0.12),0_2px_8px_rgba(244,63,94,0.08)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">

            {/* Card header strip */}
            <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2.5 border-b border-neutral-100">
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-xl ${isColHighlight ? 'bg-indigo-100 border border-indigo-200' : 'bg-rose-100 border border-rose-200'}`}>
                  <Target className={`w-4 h-4 ${isColHighlight ? 'text-indigo-600' : 'text-rose-600'}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[12px] text-neutral-900 tracking-tight">
                      {guideTitle}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      isColHighlight
                        ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                        : 'bg-rose-100 text-rose-700 border border-rose-200'
                    }`}>
                      Action Required
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-500 font-medium mt-0.5">
                    {guideSubtitle}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setIsCollapsed(true)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
                  title="Minimize"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    setIsDismissed(true);
                    onDismiss?.();
                  }}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="px-4 py-3.5 space-y-3">
              {/* Problem explanation */}
              <p className="text-[11px] text-neutral-600 leading-relaxed">
                <span className="font-semibold text-neutral-800">Why this matters:</span>{' '}
                {whyMatters}
              </p>

              {foundSnippet && (
                <div className="flex items-start gap-2 bg-rose-50/80 border border-rose-200/60 rounded-lg p-2.5">
                  <span className="text-rose-500 text-[11px] font-bold shrink-0 mt-0.5">Found:</span>
                  <code className="text-[10px] text-rose-800 font-mono break-all leading-snug">
                    "{foundSnippet}"
                  </code>
                </div>
              )}

              {/* Step-by-step instructions */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">How to fix it</p>

                {/* Step 1 */}
                <div className="flex items-start gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-200/70">
                  <div className="w-5 h-5 rounded-full bg-neutral-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-neutral-900">
                      {isColHighlight ? 'Select the columns' : 'Select the rows'}
                    </p>
                    <p className="text-[11px] text-neutral-600 mt-0.5">
                      {isColHighlight ? (
                        <>
                          Click column header <span className="font-bold text-indigo-700 bg-indigo-50 px-1 rounded">{colLetter(targetStart)}</span>, hold{' '}
                          <kbd className="bg-white border border-neutral-300 px-1 py-0.5 rounded text-[10px] font-mono shadow-sm">Shift</kbd>{' '}
                          and click column <span className="font-bold text-indigo-700 bg-indigo-50 px-1 rounded">{colLetter(targetEnd)}</span>.
                        </>
                      ) : (
                        <>
                          Click row number <span className="font-bold text-rose-700 bg-rose-50 px-1 rounded">{targetStart}</span> on the far-left margin, then hold{' '}
                          <kbd className="bg-white border border-neutral-300 px-1 py-0.5 rounded text-[10px] font-mono shadow-sm">Shift</kbd>{' '}
                          and click row <span className="font-bold text-rose-700 bg-rose-50 px-1 rounded">{targetEnd}</span>.
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-200/70">
                  <div className="w-5 h-5 rounded-full bg-neutral-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-neutral-900">
                      {isColHighlight ? 'Convert / Clean formats' : 'Right-click → Delete'}
                    </p>
                    <p className="text-[11px] text-neutral-600 mt-0.5">
                      {isColHighlight ? (
                        <>Use <kbd className="bg-white border border-neutral-300 px-1 py-0.5 rounded text-[10px] font-mono shadow-sm">Ctrl+H</kbd> to strip symbols or choose <strong>Data → Text to Columns</strong>.</>
                      ) : (
                        <>Right-click the highlighted rows and choose <span className="font-bold text-neutral-900">Delete</span> from the context menu.</>
                      )}
                    </p>
                  </div>
                </div>

                {/* Result */}
                <div className="flex items-center gap-2.5 p-3 bg-emerald-50 rounded-xl border border-emerald-200/70">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <p className="text-[11px] text-emerald-900 font-medium">
                    {resultText}
                  </p>
                </div>

                {/* Completed action button */}
                <button
                  onClick={() => {
                    setIsDismissed(true);
                    onCompleteCleaned?.();
                  }}
                  className="w-full mt-2 flex items-center justify-center gap-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isColHighlight ? "I've converted these columns" : "I've removed these rows"}</span>
                </button>
              </div>

              {/* Footer controls */}
              <div className="flex items-center justify-between pt-1 border-t border-neutral-100">
                <button
                  onClick={() => setShowHighlightBand(!showHighlightBand)}
                  className="flex items-center gap-1.5 text-[11px] text-neutral-500 hover:text-neutral-800 font-medium transition-colors cursor-pointer"
                >
                  {showHighlightBand
                    ? <><EyeOff className="w-3.5 h-3.5" /><span>Hide overlay</span></>
                    : <><Eye className="w-3.5 h-3.5 text-rose-500" /><span>Show overlay</span></>
                  }
                </button>

                {onOpenXray && (
                  <button
                    onClick={onOpenXray}
                    className="flex items-center gap-1 text-[11px] font-semibold text-neutral-700 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <span>View Original</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
