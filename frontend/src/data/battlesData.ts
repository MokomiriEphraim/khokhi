import { Battle } from '../types';

export const INITIAL_BATTLES: Battle[] = [
  {
    id: '01_floating_point',
    title: 'Floating-Point Drift',
    subtitle: 'When 0.1 + 0.2 fails VLOOKUP and exact equality checks',
    difficulty: 'Medium',
    tag: 'Numeric Integrity',
  },
  {
    id: '02_merged_headers',
    title: 'Merged Headers Trap',
    subtitle: 'Why merged cells turn columns C & D into NULL ghosts',
    difficulty: 'Easy',
    tag: 'Layout & Schema',
  },
  {
    id: '03_multi_row_headers',
    title: 'Multi-Row Headers',
    subtitle: 'Flattening multi-tier reporting rows into tabular headers',
    difficulty: 'Medium',
    tag: 'Ingestion Pipeline',
  },
  {
    id: '04_stale_formulas',
    title: 'Stale Formulas & Frozen State',
    subtitle: 'Manual calculation mode & unrefreshed PivotTable caches',
    difficulty: 'Easy',
    tag: 'Workbook Config',
  },
  {
    id: '05_format_break_2016',
    title: 'Format Break (Dates & Text Numbers)',
    subtitle: 'Why SUM() returns 0 and dates sort alphabetically',
    difficulty: 'Hard',
    tag: 'Data Typing',
  },
  {
    id: '06_blank_vs_zero',
    title: 'Blank vs. Zero Skew',
    subtitle: 'How empty cells vs. literal 0 distort business averages',
    difficulty: 'Medium',
    tag: 'Statistical Bias',
  },
  {
    id: '07_naming_inconsistency',
    title: 'Naming Inconsistency & Whitespace',
    subtitle: 'Cleaning ghost CHAR(160) spaces, casing & regional acronyms',
    difficulty: 'Medium',
    tag: 'String Normalization',
  },
];

export const BATTLES_CONTENT: Record<string, {
  symptom: string;
  rootCause: string;
  socraticQuestion: string;
  fixExample: string;
  hints: string[];
  mockCsv: string;
  filename: string;
}> = {
  '01_floating_point': {
    symptom: 'VLOOKUP / IF(A2=B2) fails on numbers that visually look identical as currency ($19.99).',
    rootCause: 'Binary IEEE 754 precision introduces minute decimal residuals (e.g. 19.990000000000002). Visual formatting masks the tail, but raw byte equality fails.',
    socraticQuestion: 'What happens when you subtract the two supposedly identical cells (=A2 - B2) in General format with 15 decimals?',
    fixExample: '=IF(ROUND(A2, 2) = ROUND(B2, 2), "Match", "Mismatch")',
    hints: [
      'Level 1: Try subtracting the two cells in a new column (=A2-B2) and look at the decimal places.',
      'Level 2: What Excel formula rounds floating numbers to an explicit number of digits before comparing?',
      'Level 3: Wrap both values in ROUND(cell, 2) to eliminate binary float drift.',
    ],
    mockCsv: `transaction_id,item_name,subtotal,tax_calc,customer_paid,match_flag
TX-1001,Acme Widget A,19.99,2.9985,22.9885,=IF(C2+D2=E2, "MATCH", "MISMATCH_FLOAT")
TX-1002,Cyber Gadget B,49.95,7.4925,57.4425,=IF(C3+D3=E3, "MATCH", "MISMATCH_FLOAT")
TX-1003,Solar Pack C,10.10,1.5150,11.6150,=IF(C4+D4=E4, "MATCH", "MISMATCH_FLOAT")
TX-1004,Quantum Mouse,33.30,4.9950,38.2950,=IF(C5+D5=E5, "MATCH", "MISMATCH_FLOAT")`,
    filename: 'sandbox_practice_floating_point.csv',
  },
  '02_merged_headers': {
    symptom: 'Sorting crashes or Power Query renames subsequent columns to Unnamed: 2.',
    rootCause: 'Only the top-left cell of a merged block stores the value. Secondary columns become completely NULL.',
    socraticQuestion: 'If you unmerge cells B1:D1, which cell actually retains the text, and what happens to columns C and D?',
    fixExample: 'Home > Alignment > Center Across Selection (no cell merging required!)',
    hints: [
      'Level 1: Unmerge the cells and observe what happens to the cells beneath the original merged span.',
      'Level 2: Is there an alignment option in Format Cells (Ctrl+1) that provides visual centering without merging?',
      'Level 3: Select the cells, press Ctrl+1 > Alignment > Horizontal: "Center Across Selection".',
    ],
    mockCsv: `Store_ID,Q1_Sales_Performance,,,Manager
,January,February,March,
STR-01,45000,52000,61000,Thabo Molefe
STR-02,38000,41000,49000,Naledi Sithole
STR-03,89000,94000,102000,Liam Van Der Merwe`,
    filename: 'sandbox_practice_merged_headers.csv',
  },
  '03_multi_row_headers': {
    symptom: 'Row 2 is parsed as a data record, polluting data types and column schemas.',
    rootCause: 'Tabular databases require a single flat 1D header vector per column.',
    socraticQuestion: 'How can you combine row 1 category and row 2 metric before passing data to Power Query?',
    fixExample: '=A1 & "_" & A2 (Paste Special as Values into Row 1, then delete Row 2)',
    hints: [
      'Level 1: Notice how automated tools assume data records immediately follow row 1.',
      'Level 2: What operator or formula in Excel joins text from two different cells together?',
      'Level 3: In an empty row, write =A1 & "_" & A2, drag across, copy and paste special as values into row 1.',
    ],
    mockCsv: `Division,Revenue_Target,Revenue_Actual,Cost_Budget,Cost_Actual
[Header Tier 2],ZAR,ZAR,ZAR,ZAR
Logistics North,1200000,1150000,800000,820000
Logistics South,950000,990000,600000,580000
Enterprise Cloud,2400000,2650000,1100000,1050000`,
    filename: 'sandbox_practice_multi_row_headers.csv',
  },
  '04_stale_formulas': {
    symptom: 'Calculations stay frozen and do not reflect updated inputs.',
    rootCause: 'Excel calculation mode is toggled to Manual or PivotTable cache is unrefreshed.',
    socraticQuestion: 'When you press F9 on your keyboard, do the totals change?',
    fixExample: 'Formulas Tab > Calculation Options > Set to Automatic',
    hints: [
      'Level 1: Try pressing F9 or Ctrl+Alt+F9 on your keyboard.',
      'Level 2: Check the Formulas tab on the Excel ribbon under Calculation Options.',
      'Level 3: Switch calculation from Manual to Automatic.',
    ],
    mockCsv: `rep_name,units_sold,unit_price,commission_rate,total_commission
Kagiso,140,150,0.08,1680
Aisha,210,150,0.08,2520
Zack,85,150,0.08,1020`,
    filename: 'sandbox_practice_stale_formulas.csv',
  },
  '05_format_break_2016': {
    symptom: 'SUM(range) returns 0 even though cells have visible numbers.',
    rootCause: 'Numbers are stored as string text; Excel aggregator functions skip non-numeric strings.',
    socraticQuestion: 'Are the numbers aligned to the left of the cell with green triangles in the corner?',
    fixExample: 'Data > Text to Columns > Finish (or =VALUE(A2))',
    hints: [
      'Level 1: In Excel, numbers align to the right by default and text aligns to the left.',
      'Level 2: What happens if you multiply a text-formatted number by 1 in a formula?',
      'Level 3: Highlight the column, open Data > Text to Columns, and click Finish immediately.',
    ],
    mockCsv: `invoice_no,date_issued_messy,sales_amount_stored_as_text,status
INV-801,2024/01/15,'4500.00,PAID
INV-802,15/02/2024,'12800.50,PAID
INV-803,03-01-2024,'3200.00,PENDING`,
    filename: 'sandbox_practice_format_break.csv',
  },
  '06_blank_vs_zero': {
    symptom: 'Average customer satisfaction or test score is dramatically distorted.',
    rootCause: 'AVERAGE() ignores blank empty cells, but includes literal 0s in the denominator.',
    socraticQuestion: 'If an absent student is recorded as 0 instead of blank, what happens to the group average?',
    fixExample: '=AVERAGEIF(B2:B50, "<>0") or preserve blanks for non-respondents',
    hints: [
      'Level 1: Check how many total records are being counted in the denominator.',
      'Level 2: AVERAGE() calculates SUM divided by COUNT of numeric cells.',
      'Level 3: Use AVERAGEIF(range, "<>0") when zeros represent missing data.',
    ],
    mockCsv: `candidate_id,module_1_score,module_2_score,final_exam_score,notes
STU-101,88,92,85,Passed
STU-102,75,,,Absent due to illness
STU-103,64,70,0,Failed on attendance / exam forfeit
STU-104,95,90,94,Distinction`,
    filename: 'sandbox_practice_blank_vs_zero.csv',
  },
  '07_naming_inconsistency': {
    symptom: 'PivotTables create separate rows for JHB, Johannesburg, and Johannesburg with a trailing space.',
    rootCause: 'Freeform text entry with non-breaking CHAR(160) spaces and acronym variations.',
    socraticQuestion: 'Why does normal TRIM sometimes fail to remove spaces copied from website tables?',
    fixExample: '=TRIM(CLEAN(SUBSTITUTE(A2, CHAR(160), " "))) + Lookup Dictionary',
    hints: [
      'Level 1: Web tables often use non-breaking spaces (ASCII 160) instead of ASCII 32.',
      'Level 2: Use SUBSTITUTE to replace CHAR(160) with standard space before trimming.',
      'Level 3: Pipeline: TRIM(CLEAN(SUBSTITUTE(A2, CHAR(160), " "))) wrapped in PROPER().',
    ],
    mockCsv: `client_id,city_raw,order_volume
CL-001,Johannesburg,420
CL-002,JHB,310
CL-003,Johannesburg ,180
CL-004,jhb,540
CL-005,Cape Town,620`,
    filename: 'sandbox_practice_naming_inconsistency.csv',
  },
};
