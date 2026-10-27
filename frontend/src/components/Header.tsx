import React from 'react';
import { ShieldCheck, Sparkles, Brain, Lock } from 'lucide-react';
import { AuditStats } from '../types';

interface HeaderProps {
  auditStats: AuditStats;
  activeBattleTitle: string;
  onOpenAudit: () => void;
  onOpenBrief: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  auditStats,
  activeBattleTitle,
  onOpenAudit,
  onOpenBrief,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#080c14]/90 backdrop-blur-xl px-4 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
      {/* Brand & Socratic Badge */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-500 shadow-lg shadow-blue-500/20 ring-1 ring-blue-400/30">
          <Brain className="w-5 h-5 text-white" />
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-400"></span>
          </span>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
              Socratic DA Tutor
              <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-blue-950/80 text-blue-400 border border-blue-500/30">
                Phase 1 Beta
              </span>
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Speed of ChatGPT. Discipline of a mentor. <span className="text-blue-400 font-medium">Zero cheating.</span>
          </p>
        </div>
      </div>

      {/* Active Battle Indicator Pill */}
      <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs">
        <span className="text-slate-400">Active Challenge:</span>
        <span className="font-semibold text-blue-300">{activeBattleTitle}</span>
      </div>

      {/* Audit & Brief Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={onOpenBrief}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/70 text-slate-200 transition-all shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span>Parse Brief</span>
        </button>

        <button
          onClick={onOpenAudit}
          className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-950/50 hover:bg-blue-900/60 border border-blue-500/30 text-blue-300 transition-all shadow-sm"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Receipts & Audit</span>
          {auditStats.refusals_intercepted > 0 && (
            <span className="font-mono text-[10px] bg-red-950/80 text-red-300 border border-red-500/30 px-1.5 rounded-full">
              {auditStats.refusals_intercepted} Refusals
            </span>
          )}
        </button>

        <div className="hidden lg:flex items-center gap-1 text-[11px] text-slate-500 font-medium border-l border-slate-800 pl-3">
          <Lock className="w-3 h-3 text-slate-400" />
          <span>POPIA Safe</span>
        </div>
      </div>
    </header>
  );
};
