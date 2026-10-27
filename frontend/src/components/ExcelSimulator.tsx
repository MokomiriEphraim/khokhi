import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  Download,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Database,
  FileSpreadsheet,
  MousePointer2,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  DollarSign,
  Percent,
  ChevronDown,
  Filter,
  Search,
  Sigma,
  Table,
  Layers,
  Sparkle,
  Split,
  RefreshCw,
  Maximize2,
  Minimize2,
  Save,
  Undo2,
  Redo2,
  PanelRightClose,
  PanelRightOpen,
  HelpCircle,
  FolderOpen,
} from 'lucide-react';
import { ComputerUse, ComputerStep } from './assistant-ui/elements/computer-use';

interface DiagnosticIssue {
  id: string;
  coord: string;
  type: 'merged' | 'text_number' | 'ghost_space' | 'float_drift' | 'blank_zero';
  title: string;
  mechanism: string;
  pipelineImpact: string;
  hint: string;
  fixed: boolean;
}

interface CellItem {
  val: string;
  isTextNumber?: boolean;
  hasGreenTriangle?: boolean;
  isMerged?: boolean;
  hasGhostSpace?: boolean;
  isFloatDrift?: boolean;
  isFixed?: boolean;
}

export interface ExcelSimulatorProps {
  externalWorkbook?: { fileName: string; buffer: ArrayBuffer } | null;
}

export const ExcelSimulator: React.FC<ExcelSimulatorProps> = ({ externalWorkbook }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [workbookName, setWorkbookName] = useState<string>('coursework_data_cleaning.xlsx');

  // Ribbon Tab State: Home | Data | Formulas | Insert | View
  const [activeRibbonTab, setActiveRibbonTab] = useState<'home' | 'data' | 'formulas' | 'insert' | 'view'>('home');
  const [mergeMenuOpen, setMergeMenuOpen] = useState<boolean>(false);
  const [numberFormat, setNumberFormat] = useState<string>('General');
  const [fontFamily, setFontFamily] = useState<string>('Calibri');
  const [fontSize, setFontSize] = useState<string>('11');

  // Layout & Guide Controls
  const [isMaximized, setIsMaximized] = useState<boolean>(true); // Default to expansive full-width Excel!
  const [showCoachPanel, setShowCoachPanel] = useState<boolean>(true);
  const [showCursorGuide, setShowCursorGuide] = useState<boolean>(true);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);

  // Grid Headers & Rows
  const [headers, setHeaders] = useState<string[]>(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
  const [gridData, setGridData] = useState<CellItem[][]>([
    [
      { val: 'Store_ID' },
      { val: 'Q1_Sales_Performance', isMerged: true },
      { val: '', isMerged: true },
      { val: '', isMerged: true },
      { val: 'Region' },
      { val: 'Invoice_Amount' },
      { val: 'Discount_Rate' },
      { val: 'Total_Reconciled' },
    ],
    [
      { val: 'STR-101' },
      { val: '45,000' },
      { val: '52,000' },
      { val: '61,000' },
      { val: 'Johannesburg\u00A0', hasGhostSpace: true },
      { val: "'4500.00", isTextNumber: true, hasGreenTriangle: true },
      { val: '0.05' },
      { val: '4275.00' },
    ],
    [
      { val: 'STR-102' },
      { val: '38,000' },
      { val: '41,000' },
      { val: '49,000' },
      { val: 'JHB', hasGhostSpace: true },
      { val: "'12800.50", isTextNumber: true, hasGreenTriangle: true },
      { val: '0.10' },
      { val: '11520.45' },
    ],
    [
      { val: 'STR-103' },
      { val: '89,000' },
      { val: '94,000' },
      { val: '102,000' },
      { val: 'Johannesburg' },
      { val: "'3200.00", isTextNumber: true, hasGreenTriangle: true },
      { val: '0.00' },
      { val: '3200.00' },
    ],
    [
      { val: 'STR-104' },
      { val: '62,000' },
      { val: '68,000' },
      { val: '74,000' },
      { val: 'Cape Town' },
      { val: "'8900.00", isTextNumber: true, hasGreenTriangle: true },
      { val: '0.08' },
      { val: '8188.00' },
    ],
    [
      { val: 'STR-105' },
      { val: '51,000' },
      { val: '55,000' },
      { val: '59,000' },
      { val: 'Durban' },
      { val: "'6400.00", isTextNumber: true, hasGreenTriangle: true },
      { val: '0.05' },
      { val: '6080.00' },
    ],
  ]);

  // Active selection
  const [activeCellCoord, setActiveCellCoord] = useState<string>('B1');
  const [selectedRow, setSelectedRow] = useState<number>(0);
  const [selectedCol, setSelectedCol] = useState<number>(1);
  const [formulaValue, setFormulaValue] = useState<string>('Q1_Sales_Performance');
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Issues found by X-Ray
  const [issues, setIssues] = useState<DiagnosticIssue[]>([
    {
      id: 'iss-1',
      coord: 'B1:D1',
      type: 'merged',
      title: 'Merged Headers (B1:D1) with Ghost NULLs',
      mechanism: 'Only cell B1 stores the string. Columns C1 and D1 are empty NULL cells beneath the merge.',
      pipelineImpact: 'SQL bulk insert fails with "Column header cannot be NULL", and Power Query creates Unnamed: 2.',
      hint: 'In the Home Ribbon under Alignment, click the "Merge & Center" dropdown and choose "Unmerge Cells".',
      fixed: false,
    },
    {
      id: 'iss-2',
      coord: 'F2:F6',
      type: 'text_number',
      title: 'Numbers Stored as Text Strings (Green Triangles)',
      mechanism: 'Formatted as strings with leading apostrophe. Excel SUM() and mathematical aggregators return 0.',
      pipelineImpact: 'SQL casts column as VARCHAR, and Power BI DAX measures return 0 or type errors.',
      hint: 'Go to Data Tab ──► Click "Text to Columns" ──► Finish to instantly coerce numbers to numeric IEEE float.',
      fixed: false,
    },
    {
      id: 'iss-3',
      coord: 'E2:E3',
      type: 'ghost_space',
      title: 'Non-Breaking Spaces (CHAR 160) & Messy Casing',
      mechanism: 'Web copy-pasting injects non-breaking spaces that standard TRIM() misses.',
      pipelineImpact: 'Power BI creates 3 separate duplicate bars for Johannesburg instead of aggregating revenue.',
      hint: 'Use Data Tab ──► "Clean & Trim Whitespace" or formula =TRIM(SUBSTITUTE(cell, CHAR(160), " ")).',
      fixed: false,
    },
  ]);

  const [activeIssueId, setActiveIssueId] = useState<string>('iss-1');
  const [xrayActive, setXrayActive] = useState<boolean>(true);

  // Computer Use Steps pointing to REAL Excel Ribbon locations
  const computerSteps: ComputerStep[] = [
    {
      action: '1. Inspect Merged Cells',
      target: 'Cell B1:D1 (Ghost NULLs C1 & D1)',
      x: 28,
      y: 50,
    },
    {
      action: '2. Alignment Ribbon Group',
      target: 'Home Ribbon > Alignment > Merge & Center',
      x: 35,
      y: 19,
    },
    {
      action: '3. Click Unmerge Cells',
      target: 'Tool: Unmerge Cells (Separates B1, C1, D1)',
      x: 37,
      y: 22,
    },
    {
      action: '4. Verify Flat 1D Schema',
      target: 'Columns Q1_Jan, Q1_Feb, Q1_Mar Ready for SQL',
      x: 44,
      y: 50,
    },
  ];

  // Robust file processor for .xlsx / .xls / .csv with automatic diagnostic detection
  const processBuffer = (fileName: string, buffer: ArrayBuffer) => {
    try {
      setWorkbookName(fileName);
      const wb = XLSX.read(buffer, { type: 'array' });
        if (!wb.SheetNames || wb.SheetNames.length === 0) {
          throw new Error('Spreadsheet has no readable sheets.');
        }

        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rawJson: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (rawJson && rawJson.length > 0) {
          // Compute max columns safely
          const maxCols = Math.max(
            ...rawJson.map((r) => (Array.isArray(r) ? r.length : 0)),
            6
          );

          // Build Excel column letters: A..Z, AA..ZZ
          const colLetters: string[] = [];
          for (let i = 0; i < maxCols; i++) {
            let label = '';
            let num = i;
            while (num >= 0) {
              label = String.fromCharCode((num % 26) + 65) + label;
              num = Math.floor(num / 26) - 1;
            }
            colLetters.push(label);
          }
          setHeaders(colLetters);

          const detectedIssues: DiagnosticIssue[] = [];

          const converted: CellItem[][] = rawJson.map((row, rIdx) => {
            return colLetters.map((_, cIdx) => {
              const rawVal = row && row[cIdx] !== undefined ? String(row[cIdx]) : '';
              const isHeader = rIdx === 0;

              // 1. Text number check
              const isTextNum =
                !isHeader &&
                /^\d+(\.\d+)?$/.test(rawVal.trim()) &&
                (typeof (row && row[cIdx]) === 'string' || rawVal.startsWith("'"));

              // 2. Non-breaking space / ghost space check
              const hasSpace =
                /\u00A0|\s{2,}/.test(rawVal) ||
                (rawVal.length > 0 && (rawVal.startsWith(' ') || rawVal.endsWith(' ')));

              // 3. Merged / empty secondary header check
              const isMergedHeader = isHeader && rawVal.trim() === '' && cIdx > 0;

              if (isMergedHeader && !detectedIssues.some((iss) => iss.type === 'merged')) {
                detectedIssues.push({
                  id: `iss-merged-${cIdx}`,
                  coord: `${colLetters[cIdx]}1`,
                  type: 'merged',
                  title: `Empty / Merged Header Cell (${colLetters[cIdx]}1)`,
                  mechanism:
                    'Excel header row contains blank cells caused by merged header banners. SQL bulk insert fails with "Column header cannot be empty".',
                  pipelineImpact:
                    'Power Query creates Unnamed: ' + cIdx + ' and relational databases reject bulk insert.',
                  hint:
                    'Unmerge the header block and assign an explicit column name (e.g. ' +
                    (colLetters[cIdx - 1] || 'Col') +
                    '_Detail).',
                  fixed: false,
                });
              }

              if (isTextNum && !detectedIssues.some((iss) => iss.type === 'text_number')) {
                detectedIssues.push({
                  id: `iss-num-${rIdx}-${cIdx}`,
                  coord: `${colLetters[cIdx]}${rIdx + 1}`,
                  type: 'text_number',
                  title: `Number Stored as Text in ${colLetters[cIdx]}${rIdx + 1}`,
                  mechanism:
                    'Leading single quotes or string formats cause Excel to store digits as text instead of numeric values.',
                  pipelineImpact:
                    'SQL DECIMAL/FLOAT conversion fails on import, and DAX SUM() measures evaluate to zero.',
                  hint: 'Select the column, click Data -> Text to Columns, or apply =VALUE().',
                  fixed: false,
                });
              }

              if (hasSpace && !detectedIssues.some((iss) => iss.type === 'ghost_space')) {
                detectedIssues.push({
                  id: `iss-space-${rIdx}-${cIdx}`,
                  coord: `${colLetters[cIdx]}${rIdx + 1}`,
                  type: 'ghost_space',
                  title: `Non-Breaking Whitespace in ${colLetters[cIdx]}${rIdx + 1}`,
                  mechanism:
                    'Copy-pasted web data contains non-breaking spaces (ASCII/CHAR 160) that normal =TRIM() leaves behind.',
                  pipelineImpact:
                    'SQL WHERE clauses and Power BI dimension joins fail because "Item " != "Item".',
                  hint:
                    'Click Clean & Trim Whitespace or enter =TRIM(SUBSTITUTE(cell, CHAR(160), " ")).',
                  fixed: false,
                });
              }

              return {
                val: rawVal,
                isTextNumber: isTextNum,
                hasGreenTriangle: isTextNum,
                hasGhostSpace: hasSpace,
                isMerged: isMergedHeader,
              };
            });
          });

          setGridData(converted);
          if (detectedIssues.length > 0) {
            setIssues(detectedIssues);
            setActiveIssueId(detectedIssues[0].id);
          }

          setUploadSuccessMessage(
            `Loaded "${fileName}" successfully (${converted.length} rows, ${colLetters.length} columns)`
          );
          setTimeout(() => setUploadSuccessMessage(null), 6000);
        }
      } catch (err: any) {
        console.warn('Could not parse spreadsheet:', err.message);
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
  };

  // Sync external workbook from chat or file upload
  useEffect(() => {
    if (externalWorkbook?.buffer) {
      processBuffer(externalWorkbook.fileName, externalWorkbook.buffer);
    }
  }, [externalWorkbook]);

  const processFile = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const buffer = evt.target?.result as ArrayBuffer;
      if (buffer) {
        processBuffer(file.name, buffer);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Upload handler via file input
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // Cell Click Handler
  const handleCellClick = (r: number, c: number) => {
    setSelectedRow(r);
    setSelectedCol(c);
    const coord = `${headers[c]}${r + 1}`;
    setActiveCellCoord(coord);
    const currentVal = gridData[r]?.[c]?.val || '';
    setFormulaValue(currentVal);
    setIsEditing(false);
  };

  // Update Cell Value (Student Manual Edit)
  const handleApplyCellEdit = (newVal: string) => {
    const updated = [...gridData];
    if (updated[selectedRow] && updated[selectedRow][selectedCol]) {
      updated[selectedRow][selectedCol] = {
        ...updated[selectedRow][selectedCol],
        val: newVal,
        isFixed: true,
        hasGreenTriangle: false,
        isTextNumber: false,
        hasGhostSpace: false,
      };
      setGridData(updated);
      setFormulaValue(newVal);

      setIssues((prev) =>
        prev.map((iss) => (iss.coord.includes(activeCellCoord) ? { ...iss, fixed: true } : iss))
      );
    }
  };

  // Real Excel Ribbon Actions
  const handleUnmergeCells = () => {
    const updated = [...gridData];
    if (updated[0]) {
      updated[0][1] = { val: 'Q1_Jan', isFixed: true };
      updated[0][2] = { val: 'Q1_Feb', isFixed: true };
      updated[0][3] = { val: 'Q1_Mar', isFixed: true };
      setGridData(updated);
      setIssues((prev) =>
        prev.map((iss) => (iss.type === 'merged' ? { ...iss, fixed: true } : iss))
      );
      setMergeMenuOpen(false);
    }
  };

  const handleCenterAcrossSelection = () => {
    handleUnmergeCells();
  };

  const handleTextToColumns = () => {
    const updated = gridData.map((row, rIdx) => {
      if (rIdx === 0) return row;
      return row.map((cell) => {
        if (cell.isTextNumber || cell.hasGreenTriangle) {
          // Clean quotes, currency symbols (R, ZAR, $), and thousands spaces
          const cleaned = cell.val
            .replace(/^['"]|['"]$/g, '')
            .replace(/^(?:R|ZAR|\$)\s*/i, '')
            .replace(/\s+/g, '')
            .trim();
          return { val: cleaned, isFixed: true };
        }
        return cell;
      });
    });
    setGridData(updated);
    setIssues((prev) =>
      prev.map((iss) => (iss.type === 'text_number' ? { ...iss, fixed: true } : iss))
    );
  };

  const handleTrimCleanWhitespace = () => {
    const updated = gridData.map((row, rIdx) => {
      if (rIdx === 0) return row;
      return row.map((cell) => {
        if (cell.hasGhostSpace) {
          const cleaned = cell.val.replace(/[\u00A0\s]+/g, ' ').trim();
          return { val: cleaned === 'JHB' ? 'Johannesburg' : cleaned, isFixed: true };
        }
        return cell;
      });
    });
    setGridData(updated);
    setIssues((prev) =>
      prev.map((iss) => (iss.type === 'ghost_space' ? { ...iss, fixed: true } : iss))
    );
  };

  // Export Student Cleaned File
  const handleExportCleanedCsv = () => {
    const csvRows = gridData.map((row) =>
      row.map((cell) => `"${cell.val.replace(/"/g, '""')}"`).join(',')
    );
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'cleaned_' + workbookName.replace(/\.[^/.]+$/, '') + '.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const activeIssue = issues.find((i) => i.id === activeIssueId) || issues[0];
  const fixedCount = issues.filter((i) => i.fixed).length;

  return (
    <div className="w-full flex flex-col gap-4 animate-in fade-in duration-200">
      {/* Upload Success Toast Banner */}
      {uploadSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-medium">{uploadSuccessMessage}</span>
          </div>
          <button
            onClick={() => setUploadSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold ml-2 text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Bar: Title, File Upload, Export Cleaned CSV */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-3">
        <div>
          <h2 className="text-xl font-medium text-neutral-900 flex items-center gap-2">
            <span>Microsoft Excel Studio</span>
            <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Interactive Ribbon Tools Active
            </span>
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Full-width authentic Excel ribbon. The AI cursor shows where to click. You type and edit with real tools.
          </p>
        </div>

        {/* Upload, Guide & Layout Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs transition-all active:scale-[0.98] cursor-pointer"
            title="Upload and load your real coursework dataset (.xlsx or .csv)"
          >
            <Upload className="w-4 h-4 text-emerald-100" />
            <span>Upload Spreadsheet (.xlsx / .csv)</span>
          </button>

          <button
            onClick={() => setShowCursorGuide(!showCursorGuide)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-xl border transition-all ${
              showCursorGuide
                ? 'bg-blue-50 text-blue-800 border-blue-200 shadow-2xs font-medium'
                : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            <MousePointer2 className="w-3.5 h-3.5 text-blue-600" />
            <span>{showCursorGuide ? 'AI Cursor Active' : 'Cursor Guide Paused'}</span>
          </button>

          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-xl border transition-all ${
              isMaximized
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold'
                : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            {isMaximized ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Standard Split View</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-neutral-600" />
                <span>Enlarge Full Canvas (100% Width)</span>
              </>
            )}
          </button>

          <button
            onClick={() => setShowCoachPanel(!showCoachPanel)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-xl border transition-all ${
              showCoachPanel
                ? 'bg-neutral-100 text-neutral-800 border-neutral-300'
                : 'bg-white text-neutral-500 border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Socratic Coach ({fixedCount}/{issues.length})</span>
          </button>

          <button
            onClick={handleExportCleanedCsv}
            className="flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-neutral-500" />
            <span>Export Cleaned CSV</span>
          </button>
        </div>
      </div>

      {/* Main Studio: Wrapped in ComputerUse Frame (Big & Full-Width) */}
      <div className={`grid grid-cols-1 ${isMaximized || !showCoachPanel ? 'grid-cols-1' : 'lg:grid-cols-12'} gap-5 items-start w-full`}>
        {/* Authentic Full Microsoft Excel Window */}
        <div className={`${isMaximized || !showCoachPanel ? 'w-full' : 'lg:col-span-8 xl:col-span-9'} w-full transition-all`}>
          <ComputerUse
            title={`Microsoft Excel — ${workbookName}`}
            steps={showCursorGuide ? computerSteps : []}
            autoPlay={showCursorGuide}
            loop={true}
          >
            {/* The Real Excel App with Drag-and-Drop */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  processFile(file);
                }
              }}
              className="flex flex-col bg-white w-full select-none"
            >
              {/* 1. Official Excel Title Bar */}
              <div className="bg-[#107c41] text-white px-4 py-2 flex items-center justify-between text-xs font-medium">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4" />
                    <span className="font-bold tracking-wider">Excel</span>
                  </div>
                  <span className="opacity-90 font-mono text-[11px] truncate max-w-[200px] sm:max-w-xs">
                    — {workbookName} — Saved
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    title="Open or Upload your coursework spreadsheet (.xlsx / .csv)"
                    className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded text-xs font-semibold shadow-xs transition-all cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Open / Upload Data</span>
                  </button>
                  <span className="opacity-90 text-[11px] hidden sm:inline">AutoSave: ON</span>
                </div>
              </div>

              {/* 2. Ribbon Tabs Navigation */}
              <div className="bg-[#f3f2f1] border-b border-neutral-300 px-3 flex items-center gap-4 text-xs text-neutral-700 font-medium">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Open or Upload your coursework spreadsheet (.xlsx / .csv)"
                  className="bg-[#107c41] text-white font-semibold px-3 py-1.5 rounded-t text-xs flex items-center gap-1.5 hover:bg-[#0d6535] cursor-pointer"
                >
                  <FolderOpen className="w-3 h-3" />
                  <span>File (Open)</span>
                </button>
                <button
                  onClick={() => setActiveRibbonTab('home')}
                  className={`py-2 px-1 border-b-2 transition-colors ${
                    activeRibbonTab === 'home'
                      ? 'border-[#107c41] text-[#107c41] font-semibold'
                      : 'border-transparent hover:text-black'
                  }`}
                >
                  Home
                </button>
                <button
                  onClick={() => setActiveRibbonTab('data')}
                  className={`py-2 px-1 border-b-2 transition-colors ${
                    activeRibbonTab === 'data'
                      ? 'border-[#107c41] text-[#107c41] font-semibold'
                      : 'border-transparent hover:text-black'
                  }`}
                >
                  Data
                </button>
                <button
                  onClick={() => setActiveRibbonTab('formulas')}
                  className={`py-2 px-1 border-b-2 transition-colors ${
                    activeRibbonTab === 'formulas'
                      ? 'border-[#107c41] text-[#107c41] font-semibold'
                      : 'border-transparent hover:text-black'
                  }`}
                >
                  Formulas
                </button>
                <button
                  onClick={() => setActiveRibbonTab('insert')}
                  className={`py-2 px-1 border-b-2 transition-colors ${
                    activeRibbonTab === 'insert'
                      ? 'border-[#107c41] text-[#107c41] font-semibold'
                      : 'border-transparent hover:text-black'
                  }`}
                >
                  Insert
                </button>
                <button
                  onClick={() => setActiveRibbonTab('view')}
                  className={`py-2 px-1 border-b-2 transition-colors ${
                    activeRibbonTab === 'view'
                      ? 'border-[#107c41] text-[#107c41] font-semibold'
                      : 'border-transparent hover:text-black'
                  }`}
                >
                  View
                </button>
              </div>

              {/* 3. Authentic Microsoft Excel Ribbon Toolbar (Categorized Groups) */}
              <div className="bg-[#faf9f8] border-b border-neutral-300 p-2 flex flex-wrap items-center gap-4 text-xs">
                {activeRibbonTab === 'home' && (
                  <>
                    {/* Font Group */}
                    <div className="flex items-center gap-1.5 border-r border-neutral-300 pr-3">
                      <select className="bg-white border border-neutral-300 rounded px-2 py-1 text-xs text-neutral-800 font-sans focus:outline-none">
                        <option>Calibri</option>
                        <option>Aptos</option>
                        <option>Arial</option>
                      </select>
                      <select className="bg-white border border-neutral-300 rounded px-1.5 py-1 text-xs text-neutral-800 focus:outline-none">
                        <option>11</option>
                        <option>12</option>
                        <option>14</option>
                      </select>
                      <button className="p-1 rounded hover:bg-neutral-200 text-neutral-700">
                        <Bold className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1 rounded hover:bg-neutral-200 text-neutral-700">
                        <Italic className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1 rounded hover:bg-neutral-200 text-neutral-700">
                        <Underline className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Alignment Group (Merge & Center is here!) */}
                    <div className="flex items-center gap-1.5 border-r border-neutral-300 pr-3 relative">
                      <button className="p-1 rounded hover:bg-neutral-200 text-neutral-700">
                        <AlignLeft className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1 rounded hover:bg-neutral-200 text-neutral-700">
                        <AlignCenter className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1 rounded hover:bg-neutral-200 text-neutral-700">
                        <AlignRight className="w-3.5 h-3.5" />
                      </button>

                      {/* Merge & Center Split Button */}
                      <div className="relative">
                        <div className="flex items-center bg-white border border-neutral-300 rounded shadow-2xs">
                          <button
                            onClick={() => setMergeMenuOpen(!mergeMenuOpen)}
                            className="px-2 py-1 text-neutral-800 font-medium hover:bg-neutral-100 flex items-center gap-1"
                          >
                            <span>Merge & Center</span>
                            <ChevronDown className="w-3 h-3 text-neutral-500" />
                          </button>
                        </div>

                        {/* Real Excel Merge Dropdown */}
                        {mergeMenuOpen && (
                          <div className="absolute left-0 top-full mt-1 w-52 bg-white border border-neutral-300 rounded-lg shadow-xl z-50 py-1 text-xs">
                            <button
                              onClick={() => {
                                alert('Warning: Merging cells deletes secondary columns! Use Unmerge instead.');
                                setMergeMenuOpen(false);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 text-neutral-700"
                            >
                              Merge & Center
                            </button>
                            <button
                              onClick={handleUnmergeCells}
                              className="w-full text-left px-3 py-1.5 hover:bg-emerald-50 text-emerald-800 font-semibold flex items-center justify-between"
                            >
                              <span>Unmerge Cells</span>
                              <span className="text-[10px] text-emerald-600 bg-emerald-100 px-1.5 rounded">Fix!</span>
                            </button>
                            <button
                              onClick={handleCenterAcrossSelection}
                              className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-blue-800 font-medium"
                            >
                              Center Across Selection
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Number Formatting Group */}
                    <div className="flex items-center gap-1.5 border-r border-neutral-300 pr-3">
                      <select
                        value={numberFormat}
                        onChange={(e) => setNumberFormat(e.target.value)}
                        className="bg-white border border-neutral-300 rounded px-2 py-1 text-xs text-neutral-800 focus:outline-none"
                      >
                        <option>General</option>
                        <option>Number</option>
                        <option>Currency (R - Rand)</option>
                        <option>Currency ($ - USD)</option>
                        <option>Accounting</option>
                        <option>Text</option>
                      </select>
                      <button
                        onClick={handleTextToColumns}
                        title="Coerce to Currency Number"
                        className="p-1 rounded hover:bg-neutral-200 text-neutral-700"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                      </button>
                      <button title="Percent" className="p-1 rounded hover:bg-neutral-200 text-neutral-700">
                        <Percent className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={handleTextToColumns}
                        title="Comma Style (Numeric)"
                        className="px-1.5 py-0.5 rounded hover:bg-neutral-200 text-neutral-700 font-bold"
                      >
                        ,
                      </button>
                      <span className="font-mono text-[10px] text-neutral-500">.00</span>
                    </div>

                    {/* Editing & Quick Socratic Fixes */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleUnmergeCells}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#107c41] hover:bg-[#0d6535] text-white font-medium shadow-2xs"
                      >
                        <Split className="w-3.5 h-3.5" />
                        <span>Unmerge Headers</span>
                      </button>

                      <button
                        onClick={handleTextToColumns}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-900 hover:bg-black text-white font-medium shadow-2xs"
                      >
                        <Table className="w-3.5 h-3.5" />
                        <span>Coerce Text Numbers</span>
                      </button>
                    </div>
                  </>
                )}

                {activeRibbonTab === 'data' && (
                  /* Data Tab with Real Data Tools */
                  <div className="flex items-center gap-3 w-full">
                    <button
                      onClick={handleTextToColumns}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#107c41] hover:bg-[#0d6535] text-white font-semibold shadow-xs"
                    >
                      <Table className="w-4 h-4" />
                      <span>Text to Columns (Data Ribbon)</span>
                    </button>

                    <button
                      onClick={handleTrimCleanWhitespace}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-black text-white font-medium shadow-xs"
                    >
                      <Sparkles className="w-4 h-4 text-blue-300" />
                      <span>Clean & Trim Whitespace (CHAR 160)</span>
                    </button>

                    <div className="flex items-center gap-2 border-l border-neutral-300 pl-3">
                      <button className="flex items-center gap-1 px-2 py-1 rounded border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-700">
                        <Filter className="w-3.5 h-3.5" />
                        <span>Filter</span>
                      </button>
                      <button className="flex items-center gap-1 px-2 py-1 rounded border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-700">
                        <span>Remove Duplicates</span>
                      </button>
                    </div>
                  </div>
                )}

                {activeRibbonTab === 'formulas' && (
                  /* Formulas Tab */
                  <div className="flex items-center gap-3 w-full">
                    <button
                      onClick={() => handleApplyCellEdit('=ROUND(19.99, 2)')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#107c41] hover:bg-[#0d6535] text-white font-medium shadow-xs"
                    >
                      <Sigma className="w-4 h-4" />
                      <span>Insert =ROUND(..., 2)</span>
                    </button>
                    <button className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-neutral-300 bg-white text-neutral-800">
                      <RefreshCw className="w-3.5 h-3.5 text-neutral-600" />
                      <span>Calculate Now (F9)</span>
                    </button>
                    <span className="text-[11px] text-neutral-500">Calculation Mode: Automatic</span>
                  </div>
                )}
              </div>

              {/* 4. Formula Bar (fx) */}
              <div className="bg-[#f9f9f9] border-b border-neutral-300 px-4 py-2 flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1 bg-white border border-neutral-300 px-2.5 py-1 rounded shadow-2xs font-mono font-bold text-neutral-700 w-16 justify-between">
                  <span>{activeCellCoord}</span>
                  <ChevronDown className="w-3 h-3 text-neutral-400" />
                </div>

                <div className="flex items-center gap-1 text-neutral-400 font-serif italic text-base px-1">
                  <span>✕</span>
                  <span>✓</span>
                  <span className="text-neutral-700 font-bold ml-1">fx</span>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleApplyCellEdit(formulaValue);
                  }}
                  className="flex-1 flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={formulaValue}
                    onChange={(e) => setFormulaValue(e.target.value)}
                    placeholder="Type value or formula (e.g. =VALUE(A2), =ROUND(B2, 2), =TRIM(A2))..."
                    className="flex-1 bg-white border border-neutral-300 px-3 py-1.5 rounded text-neutral-900 text-xs font-mono focus:outline-none focus:border-neutral-500 shadow-2xs"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded bg-neutral-900 hover:bg-black text-white text-[11px] font-medium transition-all"
                  >
                    Enter
                  </button>
                </form>
              </div>

              {/* 5. Spacious, High-Resolution Spreadsheet Grid */}
              <div className="overflow-auto h-[520px] bg-[#e1dfdd] p-0.5">
                <table className="w-full border-collapse bg-white text-xs text-neutral-800 font-sans">
                  <thead className="sticky top-0 z-20">
                    <tr className="bg-[#f3f2f1] text-neutral-600 font-mono text-[11px]">
                      <th className="w-12 border border-neutral-300 py-2 text-center font-normal">#</th>
                      {headers.map((col) => (
                        <th key={col} className="border border-neutral-300 px-5 py-2 text-center font-bold min-w-[140px]">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gridData.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-neutral-50/80 transition-colors">
                        <td className="border border-neutral-300 text-center font-mono text-[11px] text-neutral-400 bg-[#f3f2f1] select-none py-2.5">
                          {rIdx + 1}
                        </td>

                        {headers.map((_, cIdx) => {
                          const cell = row[cIdx] || { val: '' };
                          const colLetter = headers[cIdx];
                          const coord = `${colLetter}${rIdx + 1}`;
                          const isSelected = activeCellCoord === coord;

                          const isTargeted =
                            xrayActive &&
                            !cell.isFixed &&
                            (cell.isMerged || cell.hasGreenTriangle || cell.isTextNumber || cell.hasGhostSpace);

                          return (
                            <td
                              key={cIdx}
                              onClick={() => handleCellClick(rIdx, cIdx)}
                              onDoubleClick={() => setIsEditing(true)}
                              className={`relative border border-neutral-300 px-4 py-2.5 text-xs select-none transition-all cursor-pointer ${
                                cell.isFixed
                                  ? 'bg-emerald-50 text-emerald-950 font-medium'
                                  : isTargeted
                                  ? 'bg-amber-50/90 text-amber-950 ring-2 ring-amber-400 ring-inset z-10'
                                  : isSelected
                                  ? 'bg-blue-50/70 ring-2 ring-blue-500 ring-inset z-10'
                                  : 'text-neutral-900'
                              } ${cell.isTextNumber && !cell.isFixed ? 'text-left font-mono' : ''}`}
                            >
                              {/* Signature Excel Green Triangle on stored-as-text numbers */}
                              {cell.hasGreenTriangle && !cell.isFixed && (
                                <span
                                  title="Number Stored as Text"
                                  className="absolute top-0 left-0 w-0 h-0 border-t-[9px] border-t-emerald-600 border-r-[9px] border-r-transparent"
                                />
                              )}

                              {isEditing && isSelected ? (
                                <input
                                  type="text"
                                  value={formulaValue}
                                  onChange={(e) => setFormulaValue(e.target.value)}
                                  onBlur={() => {
                                    handleApplyCellEdit(formulaValue);
                                    setIsEditing(false);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleApplyCellEdit(formulaValue);
                                      setIsEditing(false);
                                    }
                                  }}
                                  autoFocus
                                  className="w-full bg-white border border-blue-500 px-1 py-0.5 text-xs text-neutral-900 focus:outline-none"
                                />
                              ) : (
                                <span className="truncate block font-normal">
                                  {cell.val || (cell.isMerged && !cell.isFixed ? '<NULL>' : '')}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 6. Official Bottom Status Bar & Sheet Tabs */}
              <div className="bg-[#f3f2f1] border-t border-neutral-300 px-4 py-2 text-[11px] text-neutral-600 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 bg-white border border-neutral-300 px-3 py-0.5 rounded font-semibold text-neutral-800 shadow-2xs">
                    <span>Sheet1</span>
                  </div>
                  <span className="cursor-pointer text-neutral-400 hover:text-black font-bold text-sm">+</span>
                  <span>•</span>
                  <span>Ready</span>
                </div>

                <div className="flex items-center gap-4 text-neutral-500">
                  <span>Count: {gridData.length * headers.length}</span>
                  <span>•</span>
                  <span>100% Zoom</span>
                </div>
              </div>
            </div>
          </ComputerUse>
        </div>

        {/* Socratic X-Ray Coach Sidecar: Adaptive Layout (Right column or Wide Bottom Dashboard) */}
        {showCoachPanel && (
          <div
            className={`${
              isMaximized
                ? 'w-full bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-5'
                : 'lg:col-span-4 xl:col-span-3 bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs space-y-4 flex flex-col'
            }`}
          >
            {/* Column 1: Header & Flagged Traps */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs font-semibold">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-900">Socratic X-Ray Coach</h3>
                    <p className="text-[11px] text-neutral-500">Read-Only Observer • Zero Cheating</p>
                  </div>
                </div>

                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
                  {fixedCount} / {issues.length} Fixed
                </span>
              </div>

              <div className="space-y-2">
                <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold block">
                  Flagged Traps ({issues.length}):
                </span>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {issues.map((iss) => (
                    <button
                      key={iss.id}
                      onClick={() => {
                        setActiveIssueId(iss.id);
                        setActiveCellCoord(iss.coord.split(':')[0]);
                      }}
                      className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all flex items-start gap-2.5 ${
                        iss.id === activeIssueId
                          ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                          : iss.fixed
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                          : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-800 border-neutral-200'
                      }`}
                    >
                      {iss.fixed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle
                          className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                            iss.id === activeIssueId ? 'text-amber-400' : 'text-amber-600'
                          }`}
                        />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{iss.title}</div>
                        <div className={`text-[11px] ${iss.id === activeIssueId ? 'text-neutral-400' : 'text-neutral-500'}`}>
                          Cell {iss.coord}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Column 2: Why Excel Breaks */}
            {activeIssue && (
              <div className="space-y-3">
                <div className="space-y-1 text-xs">
                  <span className="font-semibold text-neutral-900">Why Excel Breaks:</span>
                  <p className="text-neutral-600 leading-relaxed bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                    {activeIssue.mechanism}
                  </p>
                </div>

                <div className="space-y-1 text-xs">
                  <span className="font-semibold text-neutral-900 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-neutral-500" />
                    <span>SQL & Power BI Impact:</span>
                  </span>
                  <p className="text-neutral-600 leading-relaxed bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                    {activeIssue.pipelineImpact}
                  </p>
                </div>
              </div>
            )}

            {/* Column 3: Socratic Hint */}
            {activeIssue && (
              <div className="space-y-3 flex flex-col justify-between">
                <div className="p-4 rounded-xl bg-neutral-900 text-white text-xs space-y-1.5">
                  <span className="text-neutral-400 text-[11px] font-mono uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-blue-400" /> What to do:
                  </span>
                  <p className="leading-relaxed">
                    {activeIssue.hint}
                  </p>
                </div>

                <div className="pt-2 text-[11px] text-neutral-400 leading-relaxed">
                  💡 The animated cursor shows where to click. You do the physical clicks and make the changes yourself!
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
