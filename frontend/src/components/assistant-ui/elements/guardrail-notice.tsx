import React from 'react';
import { ShieldAlert, ArrowRight, Sparkles } from 'lucide-react';

export interface GuardrailNoticeProps {
  title?: string;
  explanation: string;
  policy?: string;
  alternatives?: string[];
  onPick?: (alternative: string) => void;
  className?: string;
}

/**
 * GuardrailNotice component matching assistant-ui elements specification:
 * An icon, a title, a short policy tag, an explanation, and an optional list of alternatives
 * the student can pick instead of asking for direct answers.
 */
export const GuardrailNotice: React.FC<GuardrailNoticeProps> = ({
  title = "I can't do that for you",
  explanation,
  policy = 'anti-cheat policy',
  alternatives = [
    'Why does this dirty data issue cause errors in SQL?',
    'Give me a Socratic hint on which Excel formula to use',
    'How do I test if my revenue column contains text numbers?',
  ],
  onPick,
  className = '',
}) => {
  return (
    <div
      data-slot="guardrail-notice"
      className={`flex w-full flex-col gap-3 rounded-2xl bg-amber-50/70 border border-amber-200/90 p-4 text-neutral-900 shadow-2xs transition-all duration-200 ${className}`}
    >
      {/* Header: Shield Icon, Title, Policy Badge */}
      <div className="flex items-center justify-between gap-2 border-b border-amber-200/50 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-amber-500/15 text-amber-700 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-xs text-neutral-900 tracking-tight">
            {title}
          </span>
        </div>

        {policy && (
          <span className="font-mono text-[10px] bg-amber-100 text-amber-800 border border-amber-300/60 px-2 py-0.5 rounded-full font-medium">
            {policy}
          </span>
        )}
      </div>

      {/* Explanation */}
      <p className="text-xs text-neutral-700 leading-relaxed">
        {explanation}
      </p>

      {/* "Try instead" alternatives block */}
      {alternatives && alternatives.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-1 border-t border-amber-200/50">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-800 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-600" />
            <span>Try asking instead:</span>
          </span>
          <div className="flex flex-col gap-1.5">
            {alternatives.map((alt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onPick?.(alt)}
                className="group flex items-center justify-between text-left text-xs bg-white/90 hover:bg-white text-neutral-800 border border-amber-200/80 hover:border-amber-300 rounded-xl px-3 py-2 transition-all shadow-2xs cursor-pointer active:scale-[0.99]"
              >
                <span className="font-medium text-[11px] group-hover:text-neutral-900 pr-2">
                  {alt}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-amber-600 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
