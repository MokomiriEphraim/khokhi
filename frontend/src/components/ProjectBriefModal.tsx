import React, { useState, useRef } from 'react';
import { BookOpen, Sparkles, ChevronRight, X, UploadCloud, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { apiParseDocument } from '../utils/authClient';

interface ProjectBriefModalProps {
  onSave: (brief: string) => void;
  onSkip: () => void;
  existingBrief?: string;
}

export const ProjectBriefModal: React.FC<ProjectBriefModalProps> = ({
  onSave,
  onSkip,
  existingBrief = '',
}) => {
  const [brief, setBrief] = useState(existingBrief);
  const [charCount, setCharCount] = useState(existingBrief.length);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedDocName, setParsedDocName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const MAX = 3000;

  const handleDocumentFile = async (file: File) => {
    if (!file) return;
    setIsParsing(true);
    setParseError(null);
    try {
      const res = await apiParseDocument(file);
      if (res.success && res.text) {
        const textToUse = res.text.slice(0, MAX);
        setBrief(textToUse);
        setCharCount(textToUse.length);
        setParsedDocName(`${file.name} (${res.wordCount} words)`);
      } else {
        setParseError(res.error || 'Could not extract text from document');
      }
    } catch (e: any) {
      setParseError(e.message || 'Error parsing document');
    } finally {
      setIsParsing(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value.slice(0, MAX);
    setBrief(val);
    setCharCount(val.length);
  };

  const handleSave = () => {
    const trimmed = brief.trim();
    if (trimmed) onSave(trimmed);
    else onSkip();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-900/60 backdrop-blur-sm px-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-neutral-200/80 shadow-[0_24px_80px_rgba(0,0,0,0.18)] w-full max-w-lg animate-in zoom-in-95 duration-200 overflow-hidden">

        <input
          type="file"
          ref={fileInputRef}
          accept=".pdf,.txt,.md,.doc,.docx"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleDocumentFile(f);
            e.target.value = '';
          }}
          className="hidden"
        />

        {/* Header */}
        <div className="relative px-6 pt-6 pb-5 border-b border-neutral-100">
          <button
            onClick={onSkip}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
            title="Skip for now"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200 shrink-0">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 tracking-tight">
                Do you have assignment instructions?
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Khokhi will keep them in mind for this project
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-indigo-50/80 border border-indigo-100 rounded-xl px-3.5 py-2.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500 mt-0.5 shrink-0" />
            <p className="text-[11.5px] text-indigo-700 leading-relaxed">
              Khokhi will align every coaching step to your assignment goals —
              cleaning the right tables, exporting with the right schema, building
              the right Power BI model.
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-3">
          {/* Functional Document Upload Area */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleDocumentFile(f);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-all ${
              isDragOver
                ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-200'
                : parsedDocName
                ? 'border-emerald-300 bg-emerald-50/40'
                : 'border-neutral-200 hover:border-indigo-300 hover:bg-neutral-50/80 bg-neutral-50/40'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                parsedDocName ? 'bg-emerald-500 text-white' : 'bg-indigo-100 text-indigo-600'
              }`}>
                {isParsing ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                ) : parsedDocName ? (
                  <CheckCircle2 className="w-4 h-4 text-white" />
                ) : (
                  <UploadCloud className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-neutral-800 truncate">
                  {isParsing
                    ? 'Extracting instructions from document...'
                    : parsedDocName
                    ? `Loaded: ${parsedDocName}`
                    : 'Upload assignment PDF or rubric'}
                </p>
                <p className="text-[10.5px] text-neutral-400">
                  {isParsing
                    ? 'Reading pages and tables...'
                    : parsedDocName
                    ? 'Extracted directly into the box below • Click to replace'
                    : 'Click to browse or drop PDF, DOCX, TXT'}
                </p>
              </div>
            </div>

            <button
              type="button"
              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-200/80 hover:bg-indigo-50 px-2.5 py-1 rounded-lg shrink-0 shadow-xs transition-colors"
            >
              {parsedDocName ? 'Replace' : 'Upload PDF'}
            </button>
          </div>

          {parseError && (
            <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5">
              ⚠️ {parseError}
            </p>
          )}

          {/* Text Area */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11.5px] font-semibold text-neutral-700">
                Or paste instructions / rubric text
              </label>
              {parsedDocName && (
                <button
                  type="button"
                  onClick={() => { setBrief(''); setCharCount(0); setParsedDocName(null); }}
                  className="text-[10px] text-neutral-400 hover:text-rose-600 transition-colors cursor-pointer"
                >
                  Clear text
                </button>
              )}
            </div>
            <textarea
              autoFocus={!parsedDocName}
              value={brief}
              onChange={handleChange}
              placeholder={`e.g. "Clean the SA University Data 2009-2016 tables. Remove banner rows, convert text numbers to numeric, export each table to SQL with a proper schema, then build a Power BI star schema showing enrolment trends by institution and year."`}
              className="w-full h-36 px-3.5 py-2.5 text-[12px] text-neutral-800 bg-neutral-50/70 border border-neutral-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-300 placeholder:text-neutral-400 leading-relaxed transition-all font-sans"
            />
            <div className="flex justify-between items-center mt-1">
              <p className="text-[10.5px] text-neutral-400">
                Applies to this chat • Update or clear anytime
              </p>
              <span className={`text-[10.5px] font-mono ${charCount > MAX * 0.9 ? 'text-amber-500' : 'text-neutral-400'}`}>
                {charCount}/{MAX}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-1 flex flex-col gap-2">
          <button
            onClick={handleSave}
            disabled={!brief.trim() || isParsing}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-5 rounded-2xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-[13px] shadow-sm transition-all cursor-pointer"
          >
            <span>{brief.trim() ? 'Save & Start Coaching' : 'Upload PDF or paste instructions above'}</span>
            {brief.trim() && <ChevronRight className="w-4 h-4" />}
          </button>
          <button
            onClick={onSkip}
            className="w-full py-2 px-5 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-neutral-600 font-medium text-[11.5px] transition-colors cursor-pointer"
          >
            Skip — I will ask questions as I go
          </button>
        </div>

      </div>
    </div>
  );
};
