import React from 'react';
import { CheckCircle2, Circle, MessageSquare, ListChecks, ChevronRight, Flame, Trophy } from 'lucide-react';
import { MissionStep } from '../utils/sheetProfiler';

interface MissionChecklistProps {
  fileName: string;
  steps: MissionStep[];
  completedSteps: string[];
  onToggleStep: (stepId: string) => void;
  onAskCoach: (step: MissionStep) => void;
  fileQueue?: { fileName: string }[];
  currentIndex?: number;
  onNextFile?: () => void;
}

export const MissionChecklist: React.FC<MissionChecklistProps> = ({
  fileName,
  steps,
  completedSteps,
  onToggleStep,
  onAskCoach,
  fileQueue,
  currentIndex = 0,
  onNextFile,
}) => {
  const done = steps.filter((s) => completedSteps.includes(s.id)).length;
  const total = steps.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const queueCount = fileQueue?.length ?? 0;
  const isAllDone = done === total && total > 0;

  return (
    <div className="bg-white rounded-xl border border-neutral-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col h-full">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="px-4 py-3.5 border-b border-neutral-100 bg-neutral-50/60 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-neutral-900 text-white shadow-sm">
            <ListChecks className="w-3.5 h-3.5" />
          </div>
          <span className="text-[13px] font-bold text-neutral-900 tracking-tight">Mission Checklist</span>
          {queueCount > 1 && (
            <span className="ml-auto text-[10px] font-mono bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded-full">
              File {currentIndex + 1}/{queueCount}
            </span>
          )}
        </div>

        <p className="text-[11px] text-neutral-500 truncate max-w-full font-medium mb-2.5" title={fileName}>
          📄 {fileName}
        </p>

        {/* Progress bar */}
        <div className="flex items-center gap-2.5">
          <div className="flex-1 h-2 bg-neutral-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${
                isAllDone
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                  : 'bg-gradient-to-r from-neutral-800 to-neutral-600'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className={`text-[10px] font-bold shrink-0 ${isAllDone ? 'text-emerald-700' : 'text-neutral-600'}`}>
            {done}/{total}
          </span>
        </div>

        {isAllDone && (
          <div className="mt-2.5 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <Trophy className="w-4 h-4 text-emerald-600 shrink-0" />
            <p className="text-[11px] font-semibold text-emerald-800">All steps complete! Great work 🎉</p>
          </div>
        )}
      </div>

      {/* ── Steps ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {steps.map((step, idx) => {
          const isDone = completedSteps.includes(step.id);
          return (
            <div
              key={step.id}
              className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                isDone
                  ? 'border-emerald-200/70 bg-emerald-50/40'
                  : 'border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-sm'
              }`}
            >
              <button
                type="button"
                onClick={() => onToggleStep(step.id)}
                className="flex items-start gap-3 w-full text-left cursor-pointer px-3.5 py-3"
              >
                {/* Step number badge */}
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 shadow-sm ${
                    isDone ? 'step-badge-done' : 'step-badge-active'
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className={`text-[12px] font-semibold leading-snug ${
                        isDone ? 'text-emerald-800 line-through decoration-emerald-400/60' : 'text-neutral-900'
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 leading-snug">{step.detail}</p>

                  {!isDone && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1.5 items-start">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide shrink-0 mt-0.5">Where</span>
                        <span className="text-[11px] text-neutral-700">{step.where}</span>
                      </div>
                      <div className="flex gap-1.5 items-start">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide shrink-0 mt-0.5">How</span>
                        <span className="text-[11px] text-neutral-700">{step.how}</span>
                      </div>
                    </div>
                  )}
                </div>
              </button>

              {!isDone && (
                <div className="px-3.5 pb-3 -mt-1">
                  <button
                    type="button"
                    onClick={() => onAskCoach(step)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-neutral-600 hover:text-neutral-900 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 hover:border-neutral-300 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer shadow-sm"
                  >
                    <MessageSquare className="w-3 h-3 text-emerald-600" />
                    Ask Khokhi about this step
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {steps.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center text-neutral-400">
            <Flame className="w-8 h-8 mb-2 text-neutral-300" />
            <p className="text-[12px] font-medium text-neutral-500">No mission yet</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">Upload a spreadsheet to generate your cleaning checklist</p>
          </div>
        )}
      </div>

      {/* ── Next file button ─────────────────────────────────────── */}
      {queueCount > 1 && currentIndex < queueCount - 1 && onNextFile && (
        <div className="p-3 border-t border-neutral-100 shrink-0 bg-neutral-50/60">
          <button
            type="button"
            onClick={onNextFile}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[12px] font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer shadow-md"
          >
            Next file in queue
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
