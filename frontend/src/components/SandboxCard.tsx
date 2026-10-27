import React from 'react';
import { Download, FileSpreadsheet, Award, Eye, AlertCircle } from 'lucide-react';
import { BATTLES_CONTENT } from '../data/battlesData';

interface SandboxCardProps {
  battleId: string;
  isPassed?: boolean;
  onOpenTeachBack: () => void;
  onOpenConcept: () => void;
}

export const SandboxCard: React.FC<SandboxCardProps> = ({
  battleId,
  isPassed,
  onOpenTeachBack,
  onOpenConcept,
}) => {
  const battle = BATTLES_CONTENT[battleId] || BATTLES_CONTENT['01_floating_point'];

  const handleDownloadSandbox = () => {
    const blob = new Blob([battle.mockCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', battle.filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900/40 rounded-2xl border border-slate-800/80 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Practice Sandbox
          </h3>
        </div>
        <span className="text-[10px] text-emerald-400/90 font-mono bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-full">
          100% Fake Data
        </span>
      </div>

      <p className="text-xs text-slate-300 leading-relaxed">
        Download a synthetic spreadsheet exhibiting this exact bug. Experiment freely without touching your real course submission.
      </p>

      {/* Download Sandbox Button */}
      <button
        onClick={handleDownloadSandbox}
        className="w-full flex items-center justify-center gap-2 text-xs font-semibold py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-950/40 transition-all active:scale-[0.98]"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Download Practice CSV ({battle.filename.replace('.csv', '')})</span>
      </button>

      {/* Action Links: Concept Card & Teach Back */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          onClick={onOpenConcept}
          className="flex items-center justify-center gap-1.5 text-xs font-medium py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-slate-200 transition-colors"
        >
          <Eye className="w-3.5 h-3.5 text-blue-400" />
          <span>Concept Card</span>
        </button>

        <button
          onClick={onOpenTeachBack}
          className={`flex items-center justify-center gap-1.5 text-xs font-medium py-2 px-3 rounded-xl border transition-all ${
            isPassed
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
              : 'bg-blue-600/20 hover:bg-blue-600/30 border-blue-500/40 text-blue-200'
          }`}
        >
          <Award className={`w-3.5 h-3.5 ${isPassed ? 'text-emerald-400' : 'text-blue-400'}`} />
          <span>{isPassed ? 'Passed ✓' : 'Teach-Back'}</span>
        </button>
      </div>

      {/* Safety Notice */}
      <div className="flex items-start gap-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
        <AlertCircle className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
        <span>
          Strict Policy: The agent has no file reader plugin. It will never ask for your real assignment file.
        </span>
      </div>
    </div>
  );
};
