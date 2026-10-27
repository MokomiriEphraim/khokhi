import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  X,
  Sparkles,
  HelpCircle,
  FileText,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';
import { profileWorkbook, generateSAUniversitySample } from '../utils/sheetProfiler';

interface UploadMissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunchMission: (payload: {
    fileName: string;
    buffer: ArrayBuffer;
    socraticPrompt: string;
  }) => void;
}

export const UploadMissionModal: React.FC<UploadMissionModalProps> = ({
  isOpen,
  onClose,
  onLaunchMission,
}) => {
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    buffer: ArrayBuffer;
  } | null>(null);

  const [assignmentBrief, setAssignmentBrief] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      if (buffer) {
        setSelectedFile({ name: file.name, buffer });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleSelectSample = () => {
    const sample = generateSAUniversitySample();
    setSelectedFile({
      name: sample.fileName,
      buffer: sample.buffer,
    });
    setAssignmentBrief(
      'Clean Table 1: Remove report title rows and footer disclaimers, eliminate subtotal rows so statistics are not duplicated, verify the FTE efficiency ratio column, and prepare the dataset for SQL ingestion.'
    );
  };

  const handleSubmit = () => {
    if (!selectedFile) return;
    setIsProcessing(true);

    try {
      const { socraticPrompt } = profileWorkbook(
        selectedFile.name,
        selectedFile.buffer,
        assignmentBrief
      );

      onLaunchMission({
        fileName: selectedFile.name,
        buffer: selectedFile.buffer,
        socraticPrompt,
      });

      onClose();
    } catch (err: any) {
      alert(`Error analyzing spreadsheet: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center font-bold text-sm shadow-2xs">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">
                Upload Excel Sheet & Learning Mission
              </h2>
              <p className="text-xs text-neutral-500">
                Autonomous diagnostic coaching on real government or enterprise tables
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-neutral-700 leading-relaxed">
          {/* 1. File Upload Dropzone */}
          <div>
            <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
              1. Choose or Drag Your Excel File (.xlsx, .xls, .csv)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                selectedFile
                  ? 'border-emerald-500/80 bg-emerald-50/40 text-emerald-900'
                  : 'border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50 text-neutral-600'
              }`}
            >
              {selectedFile ? (
                <>
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-xs text-emerald-950 truncate max-w-sm">
                      {selectedFile.name}
                    </p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      Ready for Socratic analysis • Click to change file
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500">
                    <Upload className="w-5 h-5 text-neutral-700" />
                  </div>
                  <div>
                    <p className="font-medium text-xs text-neutral-800">
                      Click to browse or drop an Excel spreadsheet here
                    </p>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Supports multi-sheet workbooks, reporting hierarchies, and dirty exports
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Quick Demo Sample: SA Higher Education Dataset */}
          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <BookOpen className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-xs text-neutral-900 truncate">
                  Try Sample: SA University Data 2016
                </p>
                <p className="text-[11px] text-neutral-500 truncate">
                  Table 1: Student Headcounts and FTEs (HEMIS / DHET)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSelectSample}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-200 text-xs font-medium shadow-2xs transition-colors cursor-pointer"
            >
              Load Sample 🎓
            </button>
          </div>

          {/* 2. Optional Assignment Brief / Instructions */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-neutral-400" />
                <span>2. Assignment Instructions or Company Brief (Optional)</span>
              </label>
              <span className="text-[11px] text-neutral-400">Leave blank for autonomous audit</span>
            </div>

            <textarea
              rows={3}
              value={assignmentBrief}
              onChange={(e) => setAssignmentBrief(e.target.value)}
              placeholder='Optional: e.g. "My manager asked me to calculate the FTE-to-headcount ratio for traditional universities, clean the header rows, and export a clean CSV for our SQL database."'
              className="w-full bg-neutral-50/80 focus:bg-white border border-neutral-200 focus:border-neutral-400 focus:ring-2 focus:ring-neutral-900/5 rounded-xl p-3 text-xs text-neutral-900 placeholder:text-neutral-400 outline-none leading-relaxed transition-all"
            />
          </div>

          {/* Socratic Guarantee Card */}
          <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Socratic Learning Guarantee: </span>
              Khokhi will guide you through diagnosing the structural problems (title rows, subtotals, formatting traps) and teach you how to fix them step-by-step rather than doing the homework for you.
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-100 bg-neutral-50/80 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedFile || isProcessing}
            onClick={handleSubmit}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-200 text-white disabled:text-neutral-400 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{isProcessing ? 'Analyzing Data...' : 'Analyze & Launch Mission 🚀'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
