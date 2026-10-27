from typing import Dict, List

HINTS_DB: Dict[str, List[str]] = {
    "01_floating_point": [
        "What happens when you subtract the two supposedly equal numbers in a fresh cell (`=A2 - B2`) and set the cell format to 15 decimal places?",
        "Excel has a built-in rounding function. What function forces numbers to round strictly to 2 decimal places before comparing?",
        "Try using `=IF(ROUND(cell1, 2) = ROUND(cell2, 2), ...)`. This snaps the underlying binary representations to identical financial precision.",
    ],
    "02_merged_headers": [
        "If you unmerge cells B1:D1, which cell actually contains the title text, and what is inside the other two cells?",
        "Look into the alignment options under Format Cells (Ctrl + 1). Is there an alignment option that centers text across multiple columns without merging them?",
        "Unmerge the cells and use 'Center Across Selection', or repeat the column titles explicitly (e.g. Q1_Jan, Q1_Feb) so automated tools see every header.",
    ],
    "03_multi_row_headers": [
        "When pandas or Power Query reads a table, how many header rows does it expect by default? What happens to the secondary header row?",
        "Could you combine the parent category in row 1 with the subcategory in row 2 using concatenation (`&`) into a single descriptive name?",
        "Use a formula like `=A1 & '_' & A2` across the columns, paste special as values into row 1, and delete row 2.",
    ],
    "04_stale_formulas": [
        "When you manually press the F9 key on your keyboard, do the calculation numbers immediately change?",
        "Check your workbook Calculation Options under the Formulas tab in the ribbon. Is it set to Automatic or Manual?",
        "If it's set to Manual, switch it to Automatic. For PivotTables, right-click and click Refresh (Alt+F5).",
    ],
    "05_format_break_2016": [
        "Do the numbers have tiny green triangles in their top-left corner, or align to the left side of the cells? What does left-alignment usually mean in Excel?",
        "What happens mathematically if you multiply a text-formatted number by 1, or use the VALUE() function?",
        "Select the entire column, navigate to Data > Text to Columns, and click Finish without changing options to instantly coerce them to numeric.",
    ],
    "06_blank_vs_zero": [
        "Does AVERAGE() in Excel count empty blank cells in its denominator, or only cells containing numeric values?",
        "If an absent student is marked with a 0 rather than left blank, how does that affect the class mean?",
        "Use `AVERAGEIF(range, '<>0')` if zero represents missing data, or deliberately leave cells blank so the average reflects only real respondents.",
    ],
    "07_naming_inconsistency": [
        "If you run `=LEN(A2)` vs `=LEN('Johannesburg')`, why is the length from the messy cell longer than expected?",
        "Standard TRIM removes normal spaces, but web copy-pastes often contain non-breaking spaces (ASCII 160). How can SUBSTITUTE help?",
        "Use `=TRIM(CLEAN(SUBSTITUTE(A2, CHAR(160), ' ')))` combined with `=PROPER(...)` to cleanse invisible whitespace and casing.",
    ],
}

def get_hint(battle_id: str, level: int) -> str:
    hints = HINTS_DB.get(battle_id, [
        "What is the first unexpected symptom you see in your worksheet?",
        "Check the data types and cell formatting of the affected columns.",
        "Inspect the raw values and formula options to ensure consistency.",
    ])
    clamped_level = max(1, min(level, len(hints)))
    return hints[clamped_level - 1]
