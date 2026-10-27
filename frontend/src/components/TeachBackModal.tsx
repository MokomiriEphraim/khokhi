import React, { useState } from 'react';
import { X, Award, CheckCircle2, AlertTriangle, Send } from 'lucide-react';
import { gradeTeachBack } from '../utils/tutorEngine';
import { TeachBackResult } from '../types';

interface TeachBackModalProps {
  battleId: string;
  battleTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onPass: (battleId: string) => void;
  onRecordAudit: (passed: boolean) => void;
}

export const TeachBackModal: React.FC<TeachBackModalProps> = ({
  battleId,
  battleTitle,
  isOpen,
  onClose,
  onPass,
  onRecordAudit,
}) => {
  const [explanation, setExplanation] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState<TeachBackResult | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!explanation.trim()) return;

    setEvaluating(true);
    setTimeout(() => {
      const evalResult = gradeTeachBack(battleId, explanation);
      setResult(evalResult);
      setEvaluating(false);
      onRecordAudit(evalResult.passed);

      if (evalResult.passed) {
        onPass(battleId);
      }
    }, 800);
  };

  const handleReset = () => {
    setResult(null);
    setExplanation('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0e1424] border border-slate-700/80 rounded-2xl p-6 shadow-2xl text-slate-100">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Prove Your Mastery (Teach-Back)</h2>
            <p className="text-xs text-slate-400">{battleTitle}</p>
          </div>
        </div>

        {/* Prompt */}
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 mb-4 text-xs text-slate-300 leading-relaxed">
          <p className="font-semibold text-blue-300 mb-1">Your Challenge:</p>
          Explain in your own words: <br />
          1. <strong>Why</strong> does this issue happen in Excel under the hood? <br />
          2. <strong>How</strong> does your specific formula or transformation solve it?
        </div>

        {/* Result view */}
        {result ? (
          <div className="space-y-4 animate-in zoom-in-95 duration-200">
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 ${
                result.passed
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                  : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
              }`}
            >
              {result.passed ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0" />
              )}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm">
                    {result.passed ? 'Teach-Back Verified! Battle Passed' : 'Needs More Technical Precision'}
                  </h4>
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-black/40">
                    Score: {result.score}%
                  </span>
                </div>
                <p className="text-xs leading-relaxed">{result.feedback}</p>
                {result.key_insights && result.key_insights.length > 0 && (
                  <p className="text-[11px] opacity-80 pt-1">
                    Detected core concepts: {result.key_insights.join(', ')}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={handleReset}
                className="text-xs font-medium px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                Refine Explanation
              </button>
              {result.passed && (
                <button
                  onClick={onClose}
                  className="text-xs font-semibold px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                >
                  Continue to Next Battle
                </button>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <textarea
              rows={4}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="e.g. Computers store decimal numbers in binary floating point which creates tiny precision tails like .000000002. Formatting hides it visually, but exact comparisons fail. We fix it by applying ROUND(..., 2)..."
              className="w-full text-xs bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
              required
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-500">
                Minimum ~30 characters with technical reasoning
              </span>
              <button
                type="submit"
                disabled={evaluating || explanation.trim().length < 15}
                className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-950/50 transition-all active:scale-[0.98]"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{evaluating ? 'Grading...' : 'Submit Teach-Back'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
