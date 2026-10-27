import React from 'react';
import { X, BookOpen, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { BATTLES_CONTENT } from '../data/battlesData';

interface ConceptModalProps {
  battleId: string;
  battleTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ConceptModal: React.FC<ConceptModalProps> = ({
  battleId,
  battleTitle,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const content = BATTLES_CONTENT[battleId] || BATTLES_CONTENT['01_floating_point'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-[#0d1322] border border-slate-700/80 rounded-2xl p-6 shadow-2xl text-slate-100 space-y-5">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">{battleTitle}</h2>
            <p className="text-xs text-blue-400">Concept Deep Dive & Diagnostic Card</p>
          </div>
        </div>

        {/* Symptom */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold">
            <AlertCircle className="w-4 h-4" />
            <span>The Symptom in Excel</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{content.symptom}</p>
        </div>

        {/* Root Cause */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
            <Sparkles className="w-4 h-4" />
            <span>The Technical Root Cause</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{content.rootCause}</p>
        </div>

        {/* Socratic Question */}
        <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-500/20 space-y-1">
          <div className="text-xs font-semibold text-blue-300">Socratic Thinking Angle</div>
          <p className="text-xs text-blue-100 italic">"{content.socraticQuestion}"</p>
        </div>

        {/* The Non-Destructive Fix */}
        <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/20 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Standard Remediation Pattern</span>
          </div>
          <div className="font-mono text-xs bg-black/60 p-2.5 rounded-lg text-emerald-300 border border-emerald-500/30 overflow-x-auto">
            {content.fixExample}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="text-xs font-medium px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Close Card
          </button>
        </div>
      </div>
    </div>
  );
};
