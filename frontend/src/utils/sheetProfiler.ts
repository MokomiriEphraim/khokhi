import * as XLSX from 'xlsx';

/**
 * Ensures a workbook buffer is standard .xlsx format.
 * If user uploads .csv, .xls, .tsv, etc., this converts it cleanly to .xlsx
 * so GridCraft WASM engine receives authentic OpenXML spreadsheet bytes.
 */
export function normalizeWorkbookBuffer(
  fileName: string,
  buffer: ArrayBuffer | Uint8Array
): { fileName: string; buffer: ArrayBuffer } {
  const isXlsx = fileName.toLowerCase().endsWith('.xlsx');
  const arrayBuffer =
    buffer instanceof ArrayBuffer
      ? buffer
      : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

  if (isXlsx) {
    return { fileName, buffer: arrayBuffer as ArrayBuffer };
  }

  try {
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const xlsxArray = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const cleanName = fileName.replace(/\.[^/.]+$/, '') + '.xlsx';
    const outBuffer = xlsxArray.buffer || xlsxArray;
    return { fileName: cleanName, buffer: outBuffer };
  } catch (err) {
    console.warn('Workbook normalization fallback:', err);
    return { fileName, buffer: arrayBuffer as ArrayBuffer };
  }
}

export interface SheetProfile {
  fileName: string;
  sheetNames: string[];
  activeSheet: string;
  totalRows: number;
  totalCols: number;
  titleRows: { rowIndex: number; text: string }[];
  detectedHeaderRowIndex: number;
  headers: string[];
  subtotalRows: { rowIndex: number; label: string }[];
  footnoteRows: { rowIndex: number; text: string }[];
  anomalies: string[];
  sampleRowsSnippet: string[][];
  /** Full original grid (capped) for the read-only Original snapshot panel. rowIndex is 1-based. */
  originalRows: string[][];
  /** 1-based row number of primary table headers (e.g. 8) */
  primaryHeaderRow: number;
  /** 1-based row range of dirty title/banner rows to delete (e.g. { start: 1, end: 7 }). Null if none. */
  dirtyTitleRowRange: { start: number; end: number } | null;
  /** Exact snippet of bottom rows with 1-based Excel row numbers for precision guidance */
  bottomRowsSnippet?: { rowIndex: number; content: string }[];
}

export interface MissionStep {
  id: string;
  title: string;
  detail: string;
  where: string;
  how: string;
  coachPrompt: string;
}

/**
 * Autonomous structural profiler for uploaded Excel sheets.
 * Detects reporting hierarchies, multi-row headers, subtotal traps, footnotes, and string formatting errors.
 */
export function profileWorkbook(
  fileName: string,
  buffer: ArrayBuffer | Uint8Array,
  userBrief?: string
): { profile: SheetProfile; socraticPrompt: string } {
  const wb = XLSX.read(buffer, { type: 'array' });

  // Pick the sheet with the most data — students often have a cover/index
  // sheet first and the real table on a later tab (e.g. Sheet2).
  let activeSheetName = wb.SheetNames[0] || 'Sheet1';
  let bestRowCount = -1;
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
    const nonEmpty = rows.filter((r) => r.some((c) => String(c).trim().length > 0)).length;
    if (nonEmpty > bestRowCount) {
      bestRowCount = nonEmpty;
      activeSheetName = name;
    }
  }
  const worksheet = wb.Sheets[activeSheetName];

  // Convert to raw 2D array of rows — range: 0 ensures index 0 maps 1:1 to Excel Row 1 (prevents off-by-one errors when !ref starts at A2)
  const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    range: 0,
    defval: '',
    blankrows: true,
    raw: false,
  });

  const totalRows = rawRows.length;
  let maxCols = 0;
  for (const row of rawRows) {
    if (row.length > maxCols) maxCols = row.length;
  }

  const titleRows: { rowIndex: number; text: string }[] = [];
  const subtotalRows: { rowIndex: number; label: string }[] = [];
  const footnoteRows: { rowIndex: number; text: string }[] = [];
  const anomalies: string[] = [];

  // 1. Scan top rows (up to 16 rows) for Title Blocks vs True Field Headers
  let headerRowIndex = 0;
  let foundHeaders = false;

  const isBlankRow = (r: number) =>
    (rawRows[r] || []).every((c: any) => String(c).trim().length === 0);

  for (let r = 0; r < Math.min(16, totalRows); r++) {
    const row = rawRows[r] || [];
    const nonEmptyCells = row.filter((c: any) => String(c).trim().length > 0);
    const firstCellText = String(row[0] || row[1] || '').trim();
    const joined = row.map((c) => String(c).trim()).join(' ');

    if (nonEmptyCells.length === 0) {
      continue;
    }

    const isTitlePattern =
      /(report|table\s*\d+|department|republic|overview|annual|summary|performance indicators|source:|compiled by|http|www\.)/i.test(firstCellText) ||
      (nonEmptyCells.length <= 2 && firstCellText.length > 25);

    const hasHeaderKeywords =
      /(institution|university|number|code|name|category|date|amount|headcount|enrolment|year|total|status|id|description|faculty|department|campus|degree|qualification)/i.test(joined);

    // If a row has multiple non-empty columns with distinct labels and isn't a lone title banner:
    if (nonEmptyCells.length >= 3 && !isTitlePattern && (hasHeaderKeywords || nonEmptyCells.length >= 4)) {
      headerRowIndex = r;
      foundHeaders = true;
      break;
    } else if (isTitlePattern || nonEmptyCells.length <= 3) {
      titleRows.push({ rowIndex: r + 1, text: firstCellText || joined.slice(0, 100) });
    }
  }

  // If no clear header was found with keywords, fallback to first non-title, non-blank row with dense cells
  if (!foundHeaders) {
    for (let r = 0; r < Math.min(16, totalRows); r++) {
      const row = rawRows[r] || [];
      const nonEmptyCells = row.filter((c: any) => String(c).trim().length > 0);
      if (nonEmptyCells.length >= 2 && !titleRows.some((t) => t.rowIndex === r + 1) && !isBlankRow(r)) {
        headerRowIndex = r;
        break;
      }
    }
  }

  const primaryHeaderRow = headerRowIndex + 1; // 1-based (e.g. 8)
  const headerRow = rawRows[headerRowIndex] || [];
  const headers = headerRow.map((c: any, i: number) => String(c).trim() || `Column_${i + 1}`);

  // The dirty title rows to delete are all rows before the primary header (1-based: 1 to headerRowIndex)
  const dirtyTitleRowRange = headerRowIndex > 0
    ? { start: 1, end: headerRowIndex }
    : null;
  const detectedHeaderRowIndex = headerRowIndex;

  // 2. Scan remaining data rows for Subtotals and Footnotes
  for (let r = detectedHeaderRowIndex + 1; r < totalRows; r++) {
    const row = rawRows[r] || [];
    const firstCol = String(row[0] || '').trim();
    const secondCol = String(row[1] || '').trim();
    const joinedRow = row.map((c) => String(c).trim()).join(' ');

    // Subtotal patterns
    if (
      /^(total|subtotal|sub-total|grand\s*total|average|summary)/i.test(firstCol) ||
      /^(total|subtotal|sub-total|grand\s*total)/i.test(secondCol)
    ) {
      subtotalRows.push({ rowIndex: r + 1, label: firstCol || secondCol });
    }

    // Footnotes / Disclaimers (usually at the bottom)
    if (
      /^(note\s*\d*|\*|source:|audited|excludes|reference)/i.test(firstCol) ||
      (r > totalRows - 6 && /^(note|\*|source|hemis)/i.test(joinedRow))
    ) {
      footnoteRows.push({ rowIndex: r + 1, text: joinedRow });
    }

    // Format anomalies: numbers stored with spaces or symbols e.g. "R 12 450", "R1,200", "$1,200", "  45.0  "
    row.forEach((cellVal: any) => {
      const strVal = String(cellVal).trim();
      // South African Rand and general currency string checks
      if (/^(?:R|ZAR)\s*\d+([, ]\d{3})*(\.\d+)?$/i.test(strVal) || /^R\s*\d+(\.\d+)?$/i.test(strVal)) {
        if (!anomalies.includes('South African Rand (R) stored as text strings (breaks SUM/AVERAGE formulas)')) {
          anomalies.push('South African Rand (R) stored as text strings (breaks SUM/AVERAGE formulas)');
        }
      } else if (/^\$?\d{1,3}(,\d{3})+(\.\d+)?$/.test(strVal)) {
        if (!anomalies.includes('Currency formatted as text strings ($ or commas)')) {
          anomalies.push('Currency formatted as text strings ($ or commas)');
        }
      }
      if (/\d+\s+\d+/.test(strVal) && !anomalies.includes('Numbers containing space thousand separators (e.g. 12 450 or R 14 350)')) {
        anomalies.push('Numbers containing space thousand separators (e.g. 12 450 or R 14 350)');
      }
      // Check for 13-digit SA ID numbers formatted as numeric
      if ((/^\d{13}$/.test(strVal) || /^\d\.\d+E\+12$/i.test(strVal)) && !anomalies.includes('13-digit South African ID numbers (risk of exponential skew or lost leading zeroes)')) {
        anomalies.push('13-digit South African ID numbers (risk of exponential skew or lost leading zeroes)');
      }
    });
  }

  // Grab sample rows for AI preview (max 5 rows)
  const sampleRowsSnippet = rawRows.slice(detectedHeaderRowIndex, detectedHeaderRowIndex + 6).map((row) =>
    row.slice(0, 8).map((c) => String(c).trim())
  );

  // Bottom rows snippet (last 8 rows with exact Excel row numbers) so the AI literally sees bottom totals/notes
  const bottomStart = Math.max(0, totalRows - 8);
  const bottomRowsSnippet: { rowIndex: number; content: string }[] = [];
  for (let r = bottomStart; r < totalRows; r++) {
    const row = rawRows[r] || [];
    const text = row.slice(0, 6).map((c) => String(c).trim()).filter(Boolean).join(' | ');
    if (text) {
      bottomRowsSnippet.push({ rowIndex: r + 1, content: text });
    }
  }

  // Snapshot for the read-only Original panel (cap so huge files don't blow memory)
  const SNAP_MAX_ROWS = 300;
  const SNAP_MAX_COLS = 40;
  const originalRows = rawRows.slice(0, SNAP_MAX_ROWS).map((row) => {
    const out: string[] = [];
    for (let i = 0; i < SNAP_MAX_COLS; i++) {
      out.push(row[i] !== undefined && row[i] !== null ? String(row[i]) : '');
    }
    return out;
  });

  const profile: SheetProfile = {
    fileName,
    sheetNames: wb.SheetNames,
    activeSheet: activeSheetName,
    totalRows,
    totalCols: maxCols,
    titleRows,
    detectedHeaderRowIndex: primaryHeaderRow,
    primaryHeaderRow,
    dirtyTitleRowRange,
    headers,
    subtotalRows,
    footnoteRows,
    anomalies,
    sampleRowsSnippet,
    bottomRowsSnippet,
    originalRows,
  };

  // 3. Construct Tailored Socratic AI Prompt
  const socraticPrompt = buildSocraticMissionPrompt(profile, userBrief);

  return { profile, socraticPrompt };
}

/**
 * Compact context block prepended (server-side, invisible in chat UI) to every
 * student message while this file is active — so the coach always "sees" the sheet.
 */
export function buildFileContext(
  profile: SheetProfile,
  userBrief?: string,
  originalProfile?: SheetProfile | null
): string {
  const lines: string[] = [];
  lines.push(
    `[ACTIVE SPREADSHEET CONTEXT — automatically attached. The student has this file open in the spreadsheet editor. Coach using this structural profile; never claim you cannot see the file.]`
  );
  lines.push(`File: "${profile.fileName}"`);
  lines.push(
    `Sheets: ${profile.sheetNames.join(', ')} | Active: "${profile.activeSheet}" | Size: ${profile.totalRows} rows × ${profile.totalCols} columns`
  );

  // Cleanup progress ledger: original upload vs the student's current sheet.
  // Explicit RESOLVED/OPEN status per issue class so the coach never repeats a
  // step the student already completed (chat history still holds the old advice).
  if (originalProfile) {
    const isNumberAnomaly = (a: string) => /text|currency|space thousand/i.test(a);
    const flaggedNumbers = (p: SheetProfile) => p.anomalies.some(isNumberAnomaly);
    const rowsStr = (rows: { rowIndex: number }[]) => rows.map((r) => `Row ${r.rowIndex}`).join(', ');

    lines.push(`[CLEANUP PROGRESS LEDGER — original upload vs current sheet]:`);

    const origHadTitles = originalProfile.titleRows.length > 0 || !!originalProfile.dirtyTitleRowRange;
    if (origHadTitles) {
      const done = profile.titleRows.length === 0 && !profile.dirtyTitleRowRange;
      lines.push(done
        ? `- ✅ RESOLVED: report title/banner rows — the student already removed them. DO NOT repeat or re-explain this step.`
        : `- ❌ STILL OPEN: report title/banner rows at ${rowsStr(profile.titleRows)}${
            profile.dirtyTitleRowRange ? ` (target range ${profile.dirtyTitleRowRange.start}–${profile.dirtyTitleRowRange.end})` : ''
          } — coach only this.`);
    }

    if (originalProfile.subtotalRows.length > 0) {
      const done = profile.subtotalRows.length === 0;
      lines.push(done
        ? `- ✅ RESOLVED: subtotal/grand-total rows — already deleted. DO NOT repeat this step.`
        : `- ❌ STILL OPEN: subtotal rows at ${rowsStr(profile.subtotalRows)} — coach only this.`);
    }

    if (originalProfile.footnoteRows.length > 0) {
      const done = profile.footnoteRows.length === 0;
      lines.push(done
        ? `- ✅ RESOLVED: footnote/source-note rows — already deleted. DO NOT repeat this step.`
        : `- ❌ STILL OPEN: footnote rows at ${rowsStr(profile.footnoteRows)} — coach only this.`);
    }

    if (flaggedNumbers(originalProfile)) {
      const done = !flaggedNumbers(profile);
      lines.push(done
        ? `- ✅ RESOLVED: numbers stored as text / currency-as-text — already converted. DO NOT repeat this step.`
        : `- ❌ STILL OPEN: ${profile.anomalies.filter(isNumberAnomaly).join('; ')} — coach only this.`);
    }

    if (originalProfile.detectedHeaderRowIndex > 1) {
      const done = profile.detectedHeaderRowIndex === 1;
      lines.push(done
        ? `- ✅ RESOLVED: field headers now sit at Row 1 — the rows above them are gone. DO NOT repeat this step.`
        : `- ❌ STILL OPEN: field headers still start at Row ${profile.detectedHeaderRowIndex} (not Row 1 yet) — coach only this.`);
    }

    if (originalProfile.totalRows !== profile.totalRows) {
      const rowDelta = profile.totalRows - originalProfile.totalRows;
      const origTitleCount = originalProfile.titleRows.length;
      const currentTitleCount = profile.titleRows.length;

      lines.push(`[STUDENT EDIT DETECTION — REAL TIME]:`);
      if (rowDelta < 0) {
        lines.push(`- The student deleted ${Math.abs(rowDelta)} row(s).`);
        if (origTitleCount > 0 && currentTitleCount === 0) {
          lines.push(`- EVALUATION: [EXCELLENT MOVE] The student successfully removed the banner/title rows! Confirm their move and guide them to the next step (stacked headers or checking bottom subtotals).`);
        } else if (origTitleCount > 0 && currentTitleCount < origTitleCount) {
          lines.push(`- EVALUATION: [PARTIAL PROGRESS] The student deleted some rows, but ${currentTitleCount} title row(s) still remain.`);
        } else if (profile.primaryHeaderRow !== originalProfile.primaryHeaderRow && profile.headers.some(h => /Column_\d+/i.test(h))) {
          lines.push(`- EVALUATION: [POSSIBLE ACCIDENT / BAD MOVE] The student may have deleted a valid header row. Remind them they can use Ctrl+Z if they made an accidental deletion.`);
        }
      } else if (rowDelta > 0) {
        lines.push(`- The student added ${rowDelta} row(s).`);
      }
    }

    lines.push(
      `Rules: chat history may still contain your earlier step-by-step instructions — this ledger is the source of truth. ` +
      `Never repeat guidance for anything marked RESOLVED; coach only items marked STILL OPEN.`
    );
  }
  if (userBrief && userBrief.trim()) {
    lines.push(`Student's assignment note: "${userBrief.trim()}"`);
  }

  // Domain / locale intelligence inferred from the sheet's own text
  const hints = detectDomainHints(profile);
  if (hints.length) {
    lines.push(`Detected context: ${hints.join(' | ')}`);
  }

  lines.push(
    `Headers (Row ${profile.detectedHeaderRowIndex}): ${profile.headers.slice(0, 30).join(' | ')}${profile.headers.length > 30 ? ' | …' : ''}`
  );
  if (profile.titleRows.length) {
    lines.push(
      `Title/banner rows detected: ${profile.titleRows.map((t) => `Row ${t.rowIndex} "${t.text.slice(0, 80)}"`).join('; ')}`
    );
  }
  if (profile.subtotalRows.length) {
    lines.push(
      `Subtotal/Total rows (double-count summary traps — must be removed before SQL/BI): ${profile.subtotalRows.map((s) => `Row ${s.rowIndex} [${s.label}]`).join(', ')}`
    );
  }
  if (profile.footnoteRows.length) {
    lines.push(
      `Footnote/source rows: ${profile.footnoteRows.map((f) => `Row ${f.rowIndex}`).join(', ')}`
    );
  }
  lines.push(`Total rows currently in active sheet: exactly ${profile.totalRows} rows (Row 1 to Row ${profile.totalRows}). NEVER cite any row number greater than Row ${profile.totalRows}!`);
  if (profile.anomalies.length) {
    lines.push(`Formatting anomalies: ${profile.anomalies.join('; ')}`);
  }
  lines.push(`Sample rows (header + first data rows):`);
  for (const row of profile.sampleRowsSnippet) {
    lines.push(`  [${row.join(' | ')}]`);
  }
  if (profile.bottomRowsSnippet && profile.bottomRowsSnippet.length) {
    lines.push(`Bottom rows in active sheet (with exact visual Excel row numbers — check before advising deletions):`);
    for (const b of profile.bottomRowsSnippet) {
      lines.push(`  Row ${b.rowIndex}: [${b.content}]`);
    }
  }
  return lines.join('\n');
}

/**
 * Infer country/locale, currency, and dataset domain from the sheet's own
 * text (title rows, headers, samples, file name) — evidence-based only.
 */
function detectDomainHints(profile: SheetProfile): string[] {
  const haystack = [
    profile.fileName,
    ...profile.titleRows.map((t) => t.text),
    ...profile.headers,
    ...profile.sampleRowsSnippet.flat(),
    ...profile.footnoteRows.map((f) => f.text),
  ].join(' | ');
  const hints: string[] = [];

  // South Africa signals (HEMIS/DHET reports, SA universities, provinces, banks, SARS, ZAR/Rand)
  const saPattern =
    /\b(south africa|hemis|dhet|chet|sars|stats sa|republic of south africa|cape peninsula|tshwane|vaal university|mangosuthu|walter sisulu|nelson mandela university|university of kwazulu|kzn|stellenbosch|witwatersrand|rhodes university|fort hare|university of venda|zululand|north west university|university of the free state|limpopo|pretoria|unisa|gauteng|western cape|eastern cape|free state|kwazulu-?natal|mpumalanga|north west|northern cape|johannesburg|durban|cape town|pretoria|bloemfontein|gqeberha|polokwane|nelspruit|kimberley|fnb|standard bank|capitec|nedbank|absa|rand|rands|zar)\b/i;
  const saCurrencyPattern = /(?:^|[\s,])R\s?\d+(?:[\s,]\d{3})*(?:\.\d{2})?(?:[\s,]|$)/;

  if (saPattern.test(haystack) || saCurrencyPattern.test(haystack)) {
    hints.push('South African dataset (ZA locale)');
    if (saCurrencyPattern.test(haystack) || /sars|tax|vat|invoice|payroll|salary|wage|tuition|fee|budget/i.test(haystack)) {
      hints.push('Currency = South African Rand (R / ZAR, e.g. R1,500.00 or R 14 350.00)');
      hints.push('Tax & Accounting: Standard South African VAT is 15%');
    }
    hints.push('Date standard: South Africa uses DD/MM/YYYY (convert to ISO YYYY-MM-DD for SQL exports)');
    if (/\bhemis\b/i.test(haystack) || /\bdhet\b/i.test(haystack)) {
      hints.push('Domain = higher-education enrolment reporting (HEMIS/DHET-style)');
    } else if (/university|institution|headcount|enrolment|fte/i.test(haystack)) {
      hints.push('Domain = higher-education sector (student/staff headcounts)');
    } else if (/sars|tax|vat|invoice|payroll|salary|wage/i.test(haystack)) {
      hints.push('Domain = South African corporate finance & tax');
    }
  } else {
    // Generic currency sniffing when region is unclear
    if (/\bZAR\b|南非|south africa/i.test(haystack)) hints.push('currency likely ZAR (Rands R)');
    else if (/(?:^|[^a-z])\$\s?|\bUSD\b/i.test(haystack)) hints.push('currency likely USD ($)');
    else if (/€|\bEUR\b/i.test(haystack)) hints.push('currency likely EUR (€)');
    else if (/£|\bGBP\b/i.test(haystack)) hints.push('currency likely GBP (£)');
  }

  // Date-format hint (SQL exports care)
  if (/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(haystack)) {
    hints.push('dates present in D/M/Y or M/D/Y format — flag as ambiguity before SQL export');
  }

  return hints;
}

function buildSocraticMissionPrompt(profile: SheetProfile, userBrief?: string): string {
  const briefSection = userBrief && userBrief.trim()
    ? `\n[STUDENT / COMPANY ASSIGNMENT INSTRUCTIONS]:\n"${userBrief.trim()}"\n`
    : `\n[MISSION TYPE]: Autonomous Data Cleaning Mission (No assignment instructions provided. Coach the student to transform this messy reporting table into a clean, database-ready tabular dataset).\n`;

  const titleSummary = profile.titleRows.length > 0
    ? `- Title Block Rows: Found ${profile.titleRows.length} report title row(s) (Rows: ${profile.titleRows.map((t) => t.rowIndex).join(', ')}) before true field headers.`
    : `- Header: Appears to start at Row ${profile.detectedHeaderRowIndex}.`;

  const subtotalSummary = profile.subtotalRows.length > 0
    ? `- Subtotal/Total Traps: Found ${profile.subtotalRows.length} subtotal rows (Rows: ${profile.subtotalRows.map((s) => `${s.rowIndex} [${s.label}]`).join(', ')}). These duplicate metrics if aggregated.`
    : `- Subtotals: None detected.`;

  const footnoteSummary = profile.footnoteRows.length > 0
    ? `- Footnotes / Disclaimers: Found ${profile.footnoteRows.length} footnote row(s) at the bottom (Rows: ${profile.footnoteRows.map((f) => f.rowIndex).join(', ')}).`
    : `- Footnotes: None detected.`;

  const anomalySummary = profile.anomalies.length > 0
    ? `- Formatting Issues: ${profile.anomalies.join('; ')}`
    : `- Formats: Standard.`;

  return `I have loaded my Excel file: "${profile.fileName}" (${profile.totalRows} rows, ${profile.totalCols} columns).
${briefSection}
Here is the structural profile detected in the spreadsheet:
${titleSummary}
${subtotalSummary}
${footnoteSummary}
${anomalySummary}

Sample headers and rows:
${profile.sampleRowsSnippet.map((row) => `[${row.join(' | ')}]`).join('\n')}

Khokhi, inspect this data layout Socratic-style. Guide me through diagnosing the structural problems with this sheet, why databases and BI tools would reject it, and coach me step-by-step through cleaning it!`;
}

/**
 * Turn a SheetProfile into concrete, clickable cleaning steps for the Mission Checklist.
 * Steps tell the student WHERE to look and WHAT menu to use — never the finished answer.
 */
export function buildMissionSteps(profile: SheetProfile): MissionStep[] {
  const steps: MissionStep[] = [];
  const headerRow = profile.detectedHeaderRowIndex;

  if (profile.titleRows.length > 0 || (profile.dirtyTitleRowRange && profile.dirtyTitleRowRange.end >= 1)) {
    const rangeStr = profile.dirtyTitleRowRange
      ? `Rows ${profile.dirtyTitleRowRange.start} to ${profile.dirtyTitleRowRange.end}`
      : `Rows ${profile.titleRows.map((t) => t.rowIndex).join(', ')}`;
    const headerRowStr = profile.primaryHeaderRow || profile.detectedHeaderRowIndex;
    steps.push({
      id: 'remove-titles',
      title: 'Remove report title & metadata rows',
      detail: `${rangeStr} are title/metadata banners, not tabular records. Automated ETL pipelines reject files unless field headers start at Row 1.`,
      where: `Look at ${rangeStr} at the top of the sheet.`,
      how: `Select full rows (drag row numbers ${profile.dirtyTitleRowRange ? `${profile.dirtyTitleRowRange.start} through ${profile.dirtyTitleRowRange.end}` : rangeStr} on the far left), right-click → Delete. Row ${headerRowStr} will become Row 1.`,
      coachPrompt: `Why do title rows above the real headers break Power Query and SQL imports, and how should I remove them safely in Excel?`,
    });
  }

  steps.push({
    id: 'confirm-headers',
    title: 'Confirm a single clean header row',
    detail: `Profiler thinks real field names start at row ${headerRow}. If the header is split across 2+ rows, flatten it first.`,
    where: `Row ${headerRow} should contain every column name (no blanks).`,
    how: 'If two header rows exist: combine them with =A&B style text, paste as values into row 1, then delete the extra header row. Unmerge any merged header cells first.',
    coachPrompt: `My header might span multiple rows or have merged cells. Walk me through flattening it into one clean header row without losing column names.`,
  });

  if (profile.subtotalRows.length > 0) {
    const rows = profile.subtotalRows.map((s) => `${s.rowIndex} (${s.label})`).join(', ');
    steps.push({
      id: 'delete-subtotals',
      title: 'Delete subtotal / grand-total rows',
      detail: `Found subtotal rows: ${rows}. These duplicate the detail rows — SUM() will double-count.`,
      where: `Rows: ${profile.subtotalRows.map((s) => s.rowIndex).join(', ')}.`,
      how: 'Select each subtotal row by its row number → right-click → Delete. Keep only institution/detail rows.',
      coachPrompt: `Why do subtotal rows inside a dataset double-count in SUM and PivotTables, and how do I spot and remove them safely?`,
    });
  }

  if (profile.footnoteRows.length > 0) {
    const rows = profile.footnoteRows.map((f) => f.rowIndex).join(', ');
    steps.push({
      id: 'delete-footnotes',
      title: 'Delete footnotes / source notes at the bottom',
      detail: `Footnote rows found: ${rows}. They look like empty or junk data to a database.`,
      where: `Bottom rows ${rows}.`,
      how: 'Select those rows → right-click → Delete.',
      coachPrompt: `Why must footnote and source-note rows be removed before loading data into SQL or Power BI?`,
    });
  }

  if (profile.anomalies.some((a) => /text|currency|space thousand/i.test(a))) {
    steps.push({
      id: 'fix-text-numbers',
      title: 'Convert text-stored numbers to real numbers',
      detail: `Detected: ${profile.anomalies.filter((a) => /text|currency|space thousand/i.test(a)).join('; ')}.`,
      where: 'Numeric columns (headcount, FTE, ratios, money).',
      how: 'Select the column → Data tab → Text to Columns → Next → Next → Finish. Or multiply a helper column by 1 and paste-special Values.',
      coachPrompt: `Numbers in my sheet are stored as text so SUM returns 0. Guide me through Text to Columns (or VALUE) to convert them without breaking dates.`,
    });
  }

  if (steps.length === 0) {
    steps.push({
      id: 'sanity-check',
      title: 'Sanity-check the sheet shape',
      detail: 'No major layout traps auto-detected — still verify headers, types, and blanks before export.',
      where: 'Whole sheet.',
      how: 'Click A1, then Ctrl+End to see the real data range. Check headers and a few numeric cells.',
      coachPrompt: `Give me a quick pre-export checklist for making sure this sheet is database-ready.`,
    });
  }

  return steps;
}

/**
 * Generates an authentic South African Higher Education (HEMIS / DHET) Table 1 dataset
 * containing realistic dirty reporting layout traps (title rows, subtotals, footnotes).
 */
export function generateSAUniversitySample(): { fileName: string; buffer: ArrayBuffer } {
  const data: (string | number)[][] = [
    ['Department of Higher Education and Training - Republic of South Africa', '', '', '', '', ''],
    ['Table 1: Headcount and Full-Time Equivalent (FTE) Student Enrolments in Public Higher Education, 2016', '', '', '', '', ''],
    ['Institution Name', 'Contact Headcount', 'Distance Headcount', 'Total Headcount', 'Total FTE', 'FTE Efficiency Ratio'],
    ['Cape Peninsula University of Technology', 31540, 2180, 33720, 27650, 0.82],
    ['Central University of Technology', 14890, 1120, 16010, 13120, 0.82],
    ['Durban University of Technology', 28400, 1950, 30350, 24880, 0.82],
    ['Mangosuthu University of Technology', 11450, 0, 11450, 9390, 0.82],
    ['Tshwane University of Technology', 56200, 4800, 61000, 50020, 0.82],
    ['Vaal University of Technology', 21100, 950, 22050, 18080, 0.82],
    ['Subtotal: Universities of Technology', 163580, 11000, 174580, 143140, 0.82],
    ['University of Cape Town', 27800, 450, 28250, 23730, 0.84],
    ['University of Fort Hare', 13950, 1200, 15150, 12720, 0.84],
    ['University of KwaZulu-Natal', 44200, 2100, 46300, 38890, 0.84],
    ['University of Pretoria', 48500, 5400, 53900, 45270, 0.84],
    ['Rhodes University', 8100, 120, 8220, 6900, 0.84],
    ['University of Stellenbosch', 29800, 1100, 30900, 25950, 0.84],
    ['University of the Witwatersrand', 36500, 1800, 38300, 32170, 0.84],
    ['Subtotal: Traditional Universities', 208850, 12170, 221020, 185630, 0.84],
    ['University of Johannesburg', 48900, 2100, 51000, 41820, 0.82],
    ['Nelson Mandela University', 26400, 1950, 28350, 23250, 0.82],
    ['University of South Africa (UNISA)', 12500, 325400, 337900, 185850, 0.55],
    ['University of Venda', 14800, 300, 15100, 12380, 0.82],
    ['Walter Sisulu University', 27900, 1200, 29100, 23860, 0.82],
    ['University of Zululand', 16200, 450, 16650, 13650, 0.82],
    ['Subtotal: Comprehensive Universities', 146700, 331400, 478100, 300810, 0.63],
    ['Grand Total Public Higher Education Institutions', 519130, 354570, 873700, 629580, 0.72],
    ['', '', '', '', '', ''],
    ['Note 1: Audited data from Higher Education Management Information System (HEMIS) 2016 submission.', '', '', '', '', ''],
    ['Note 2: Headcounts include both undergraduate and postgraduate qualifications.', '', '', '', '', ''],
    ['* UNISA enrolments are predominantly distance mode education.', '', '', '', '', ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Table 1 Headcounts & FTEs');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return {
    fileName: 'Table 1 Student Headcounts and FTEs 2016.xlsx',
    buffer: out,
  };
}

/**
 * Extracts 1-based row ranges from an AI coaching response string in real time.
 * e.g. "rows 1, 2, 3, 4, and 6", "rows 1 to 7", "rows 1-6", "row 4"
 */
export function extractRowRangeFromText(text: string): { start: number; end: number } | null {
  if (!text) return null;

  // Strategy 1: Look specifically for rows associated with title/banner/delete/remove/unnecessary/clean
  // e.g., "title rows (rows 1, 2, 3, 4, and 6)", "unnecessary rows (1, 2, 3, 4, 6)", "delete rows 1 to 7"
  const dirtyContextMatch = text.match(/(?:title|banner|unnecessary|extra|delete|remove|clean)\s*(?:rows?|header rows?)?\s*(?:\()?\s*(?:rows?\s*)?((?:\d+\s*(?:to|–|-|through|:|,|and|\sor)\s*)+\d+)(?:\))?/i);
  if (dirtyContextMatch) {
    const rawSnippet = dirtyContextMatch[1];
    // Check if it's a range like "1 to 7" or "1-6"
    const rMatch = rawSnippet.match(/(\d+)\s*(?:to|–|-|through|:)\s*(\d+)/i);
    if (rMatch) {
      const s = parseInt(rMatch[1], 10);
      const e = parseInt(rMatch[2], 10);
      if (!isNaN(s) && !isNaN(e)) return { start: Math.min(s, e), end: Math.max(s, e) };
    }
    // Check if it's a list like "1, 2, 3, 4, and 6"
    const nums = rawSnippet.match(/\d+/g)?.map((n) => parseInt(n, 10)).filter((n) => !isNaN(n)) || [];
    if (nums.length > 0) {
      return { start: Math.min(...nums), end: Math.max(...nums) };
    }
  }

  // Strategy 2: Explicit range pattern: "rows 1 to 7", "rows 1–7", "rows 1-7"
  const rangeMatch = text.match(/(?:\()?\s*rows?\s+(\d+)\s*(?:to|–|-|through|:)\s*(\d+)/i);
  if (rangeMatch) {
    const s = parseInt(rangeMatch[1], 10);
    const e = parseInt(rangeMatch[2], 10);
    if (!isNaN(s) && !isNaN(e)) {
      return { start: Math.min(s, e), end: Math.max(s, e) };
    }
  }

  // Strategy 3: List pattern: "rows (1, 2, 3, 4, and 6)" or "rows 1, 2, 3, 4, and 6"
  const listMatch = text.match(/\brows?\s+(?:\()?((?:\d+\s*(?:,|and|\sor)\s*)+\d+)(?:\))?/i);
  if (listMatch) {
    const nums = listMatch[1].match(/\d+/g)?.map((n) => parseInt(n, 10)).filter((n) => !isNaN(n)) || [];
    if (nums.length > 0) {
      return { start: Math.min(...nums), end: Math.max(...nums) };
    }
  }

  // Strategy 4: Single row mention, ignoring header/destination row (e.g. "headers in row 8", "data begins at row 8")
  const headerContext = /(?:headers?|columns?|data begins?|shifts? up to)\s+(?:in|at|on)?\s*row\s+(\d+)/i.exec(text);
  const headerRowNum = headerContext ? parseInt(headerContext[1], 10) : null;

  const singleMatch = text.match(/(?:\()?\s*\brow\s+(\d+)\b/i);
  if (singleMatch) {
    const rowNum = parseInt(singleMatch[1], 10);
    if (!isNaN(rowNum) && rowNum !== headerRowNum) {
      return { start: rowNum, end: rowNum };
    }
  }

  return null;
}

/**
 * Extracts 1-based column ranges from an AI coaching response string in real time.
 * Supports letter columns like "columns D to S", "columns D through S", "column D",
 * or number columns like "columns 4 to 18", "columns 4, 6, 8, 10, 12, 14, 16, and 18".
 */
export function extractColumnRangeFromText(text: string): { start: number; end: number } | null {
  if (!text) return null;

  const letterToCol = (letter: string): number => {
    let col = 0;
    const clean = letter.toUpperCase();
    for (let i = 0; i < clean.length; i++) {
      col = col * 26 + (clean.charCodeAt(i) - 64);
    }
    return col;
  };

  // Pattern 1: Letter ranges: "columns D to S", "columns D through S", "columns D-S"
  const letterRange = text.match(/\bcolumns?\s+([A-Z]{1,2})\s*(?:to|–|-|through|:)\s*([A-Z]{1,2})\b/i);
  if (letterRange) {
    const s = letterToCol(letterRange[1]);
    const e = letterToCol(letterRange[2]);
    if (s > 0 && e > 0) return { start: Math.min(s, e), end: Math.max(s, e) };
  }

  // Pattern 2: Numeric column ranges: "columns 4 to 18", "columns 4–18"
  const numRange = text.match(/\bcolumns?\s+(\d+)\s*(?:to|–|-|through|:)\s*(\d+)\b/i);
  if (numRange) {
    const s = parseInt(numRange[1], 10);
    const e = parseInt(numRange[2], 10);
    if (!isNaN(s) && !isNaN(e) && s > 0 && e > 0) {
      return { start: Math.min(s, e), end: Math.max(s, e) };
    }
  }

  // Pattern 3: Column lists: "columns 4, 6, 8, 10, 12, 14, 16, and 18"
  const colList = text.match(/\bcolumns?\s+(?:containing\s+financial\s+data\s+)?(?:\()?((?:\d+\s*(?:,|and|\sor)\s*)+\d+)(?:\))?/i);
  if (colList) {
    const nums = colList[1].match(/\d+/g)?.map((n) => parseInt(n, 10)).filter((n) => !isNaN(n) && n > 0) || [];
    if (nums.length >= 2) {
      return { start: Math.min(...nums), end: Math.max(...nums) };
    }
  }

  // Pattern 4: Single column letter: "column D"
  const singleColLetter = text.match(/\bcolumn\s+([A-Z]{1,2})\b/i);
  if (singleColLetter) {
    const col = letterToCol(singleColLetter[1]);
    if (col > 0) return { start: col, end: col };
  }

  return null;
}
