import React from 'react';
import { X, ShieldCheck, AlertOctagon, CheckCircle2, Lock, FileCode } from 'lucide-react';
import { AuditStats } from '../types';

interface AuditModalProps {
  stats: AuditStats;
  isOpen: boolean;
  onClose: () => void;
}

export const AuditModal: React.FC<AuditModalProps> = ({ stats, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[#0d1322] border border-slate-700/80 rounded-2xl p-6 shadow-2xl text-slate-100 space-y-5">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">System Audit & Receipts</h2>
            <p className="text-xs text-slate-400">Verifiable Non-Cheating Architecture</p>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3">
            <AlertOctagon className="w-6 h-6 text-red-400 flex-shrink-0" />
            <div>
              <div className="font-mono text-lg font-bold text-white">
                {stats.refusals_intercepted}
              </div>
              <div className="text-[11px] text-slate-400">Cheating Attempts Refused</div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
            <div>
              <div className="font-mono text-lg font-bold text-white">
                {stats.teach_backs_passed} / {stats.teach_backs_attempted}
              </div>
              <div className="text-[11px] text-slate-400">Teach-Backs Verified</div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3">
            <Lock className="w-6 h-6 text-blue-400 flex-shrink-0" />
            <div>
              <div className="font-mono text-lg font-bold text-blue-300">
                0 Files Read
              </div>
              <div className="text-[11px] text-slate-400">Zero Student Ingestion</div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3">
            <FileCode className="w-6 h-6 text-purple-400 flex-shrink-0" />
            <div>
              <div className="font-mono text-lg font-bold text-purple-300">
                0 Deliverables
              </div>
              <div className="text-[11px] text-slate-400">Zero Code Deliverables</div>
            </div>
          </div>
        </div>

        {/* Audit Statement for Mentors */}
        <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/20 text-xs text-slate-300 space-y-2">
          <h4 className="font-semibold text-blue-300 flex items-center gap-1.5">
            <span>The Mentor & Leadership Proof:</span>
          </h4>
          <p className="leading-relaxed">
            "This tool has never touched a student's file, and it never will — because the plugin simply does not exist. The absence of file readers and code executors is our defensive product design."
          </p>
        </div>

        <div className="flex justify-end pt-1">
          <button
            onClick={onClose}
            className="text-xs font-medium px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
};
