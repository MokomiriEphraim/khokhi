import React, { useMemo } from 'react';
import { FileText, EyeOff } from 'lucide-react';
import { SheetProfile } from '../utils/sheetProfiler';

interface OriginalSnapshotProps {
  profile: SheetProfile | null;
  visible: boolean;
  onToggle: () => void;
}

function colLabel(i: number): string {
  let label = '';
  let n = i;
  while (n >= 0) {
    label = String.fromCharCode((n % 26) + 65) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

/**
 * Read-only "Original" snapshot of the uploaded sheet, with trap rows highlighted.
 * Pure HTML — no GPU, potato-PC safe. Student peeks here to remember what they deleted.
 */
export const OriginalSnapshot: React.FC<OriginalSnapshotProps> = ({ profile, visible, onToggle }) => {
  const trapMap = useMemo(() => {
    const map = new Map<number, 'title' | 'subtotal' | 'footnote' | 'header'>();
    if (!profile) return map;
    profile.titleRows.forEach((t) => map.set(t.rowIndex, 'title'));
    profile.subtotalRows.forEach((s) => map.set(s.rowIndex, 'subtotal'));
    profile.footnoteRows.forEach((f) => map.set(f.rowIndex, 'footnote'));
    map.set(profile.detectedHeaderRowIndex, 'header');
    return map;
  }, [profile]);

  if (!profile) return null;

  if (!visible) return null;

  const rowCap = 150;
  const rows = profile.originalRows.slice(0, rowCap);
  const colCount = Math.min(
    profile.totalCols || rows.reduce((m, r) => Math.max(m, r.length), 0) || 0,
    40
  );

  const legend: { color: string; label: string }[] = [
    { color: 'bg-red-50 border-red-200', label: 'Title row — delete' },
    { color: 'bg-amber-50 border-amber-200', label: 'Subtotal — double-counts' },
    { color: 'bg-neutral-100 border-neutral-300', label: 'Footnote — delete' },
    { color: 'bg-emerald-50 border-emerald-300', label: 'Header row' },
  ];

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-white">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-neutral-200 bg-neutral-50 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-neutral-500 shrink-0" />
          <span className="text-xs font-semibold text-neutral-800 truncate">
            Original — {profile.fileName}
          </span>
          <span className="text-[10px] font-mono text-neutral-400 shrink-0 hidden sm:inline">
            before cleaning
          </span>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-1 text-[11px] font-medium text-neutral-600 hover:text-neutral-900 bg-white hover:bg-neutral-100 border border-neutral-200 px-2 py-1 rounded-md transition-colors cursor-pointer shrink-0"
        >
          <EyeOff className="w-3.5 h-3.5" />
          Back to my sheet
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 border-b border-neutral-100 bg-white shrink-0">
        {legend.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1.5 text-[10px] text-neutral-500">
            <span className={`w-2.5 h-2.5 rounded-sm border ${l.color}`} />
            {l.label}
          </span>
        ))}
        {profile.originalRows.length > rowCap && (
          <span className="text-[10px] text-neutral-400 ml-auto">
            showing first {rowCap} of {profile.totalRows} rows
          </span>
        )}
      </div>

      {/* Read-only table */}
      <div className="flex-1 overflow-auto">
        <table className="border-collapse text-[11px] font-mono w-max min-w-full">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="bg-neutral-100 border border-neutral-200 px-1.5 py-1 text-[10px] font-normal text-neutral-400 sticky left-0 z-20 w-8">
                #
              </th>
              {Array.from({ length: colCount }, (_, c) => (
                <th
                  key={c}
                  className="bg-neutral-100 border border-neutral-200 px-2 py-1 text-[10px] font-semibold text-neutral-500 min-w-[70px]"
                >
                  {colLabel(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIdx) => {
              const rowNo = rIdx + 1;
              const trap = trapMap.get(rowNo);
              const rowClass =
                trap === 'title'
                  ? 'bg-red-50'
                  : trap === 'subtotal'
                  ? 'bg-amber-50'
                  : trap === 'footnote'
                  ? 'bg-neutral-100'
                  : trap === 'header'
                  ? 'bg-emerald-50 font-semibold'
                  : rowIdxEven(rIdx)
                  ? 'bg-white'
                  : 'bg-neutral-50/50';
              const borderClass =
                trap === 'title'
                  ? 'border-red-200'
                  : trap === 'subtotal'
                  ? 'border-amber-200'
                  : trap === 'footnote'
                  ? 'border-neutral-300'
                  : trap === 'header'
                  ? 'border-emerald-300'
                  : 'border-neutral-200';

              return (
                <tr key={rowNo} className={rowClass} title={trapTitle(trap)}>
                  <td className={`${borderClass} px-1.5 py-0.5 text-[10px] text-neutral-400 bg-neutral-50 sticky left-0`}>
                    {rowNo}
                  </td>
                  {Array.from({ length: colCount }, (_, c) => (
                    <td key={c} className={`${borderClass} px-2 py-0.5 whitespace-nowrap max-w-[220px] overflow-hidden text-ellipsis`}>
                      {row[c] || ''}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

function rowIdxEven(i: number): boolean {
  return i % 2 === 0;
}

function trapTitle(trap: 'title' | 'subtotal' | 'footnote' | 'header' | undefined): string {
  switch (trap) {
    case 'title':
      return 'Title/banner row — not data. Delete it.';
    case 'subtotal':
      return 'Subtotal row — duplicates detail rows, double-counts in SUM.';
    case 'footnote':
      return 'Footnote/source note — junk to a database. Delete it.';
    case 'header':
      return 'Detected header row — column names live here.';
    default:
      return '';
  }
}
