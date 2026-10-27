import React, { useState } from 'react';
import { X, Sparkles, ArrowRight, ShieldCheck, Check } from 'lucide-react';
import { INITIAL_BATTLES } from '../data/battlesData';

interface BriefParserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBattle: (battleId: string) => void;
}

export const BriefParserModal: React.FC<BriefParserModalProps> = ({
  isOpen,
  onClose,
  onSelectBattle,
}) => {
  const [briefText, setBriefText] = useState('');
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [analyzed, setAnalyzed] = useState(false);

  if (!isOpen) return null;

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    if (!briefText.trim()) return;

    const lower = briefText.toLowerCase();
    const matches: string[] = [];

    if (lower.includes('float') || lower.includes('round') || lower.includes('cents') || lower.includes('mismatch')) {
      matches.push('01_floating_point');
    }
    if (lower.includes('merge') || lower.includes('unmerge') || lower.includes('header')) {
      matches.push('02_merged_headers');
    }
    if (lower.includes('two header') || lower.includes('multi-level') || lower.includes('flatten')) {
      matches.push('03_multi_row_headers');
    }
    if (lower.includes('stale') || lower.includes('f9') || lower.includes('manual') || lower.includes('calculate')) {
      matches.push('04_stale_formulas');
    }
    if (lower.includes('text') || lower.includes('green triangle') || lower.includes('sum') || lower.includes('date')) {
      matches.push('05_format_break_2016');
    }
    if (lower.includes('blank') || lower.includes('zero') || lower.includes('average') || lower.includes('null')) {
      matches.push('06_blank_vs_zero');
    }
    if (lower.includes('city') || lower.includes('space') || lower.includes('trim') || lower.includes('jhb')) {
      matches.push('07_naming_inconsistency');
    }

    if (matches.length === 0) {
      matches.push('01_floating_point', '02_merged_headers', '05_format_break_2016');
    }

    setMatchedIds(matches);
    setAnalyzed(true);
  };

  const handlePick = (id: string) => {
    onSelectBattle(id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0d1322] border border-slate-700/80 rounded-2xl p-6 shadow-2xl text-slate-100 space-y-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Assignment Brief Parser</h2>
            <p className="text-xs text-slate-400">Extracts learning tasks from text prompts only</p>
          </div>
        </div>

        <form onSubmit={handleAnalyze} className="space-y-3">
          <textarea
            rows={4}
            value={briefText}
            onChange={(e) => setBriefText(e.target.value)}
            placeholder="Paste your assignment brief questions or rubric requirements here (e.g. 'Ensure all currency fields match before reconciling VLOOKUP, check that store sales columns are properly unmerged and formatted...')"
            className="w-full text-xs bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
            required
          />

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Zero file access • Safe to paste instructions</span>
            </span>

            <button
              type="submit"
              className="text-xs font-semibold px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              Analyze Brief
            </button>
          </div>
        </form>

        {analyzed && (
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <h4 className="text-xs font-semibold text-slate-300">
              Matched Cleaning Battles ({matchedIds.length}):
            </h4>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {matchedIds.map((id) => {
                const item = INITIAL_BATTLES.find((b) => b.id === id);
                if (!item) return null;

                return (
                  <button
                    key={id}
                    onClick={() => handlePick(id)}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg bg-slate-900 hover:bg-blue-950/40 border border-slate-800 hover:border-blue-500/40 text-left transition-colors group"
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-200 group-hover:text-blue-300">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-slate-400">{item.subtitle}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
