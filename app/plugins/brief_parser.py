import re
from typing import Dict, List, Any

def parse_brief_text(text: str) -> Dict[str, Any]:
    """
    Parses assignment prompt text to identify which of the 7 data cleaning battles
    are relevant, extracting tasks without ever viewing raw data rows.
    """
    detected_battles = []
    text_lower = text.lower()

    signals = {
        "01_floating_point": ["float", "rounding", "0.01", "cents", "vlookup mismatch", "precision", "decimal mismatch"],
        "02_merged_headers": ["merged", "merge and center", "unmerge", "empty header", "unnamed: 2"],
        "03_multi_row_headers": ["two header rows", "sub-header", "multi-level", "flatten header", "hierarchy"],
        "04_stale_formulas": ["not updating", "stale", "f9", "manual calculation", "refresh pivot"],
        "05_format_break_2016": ["text format", "green triangle", "sum is 0", "sum equals zero", "date format", "dd/mm/yyyy"],
        "06_blank_vs_zero": ["average skew", "blank vs 0", "empty cells", "missing values", "null vs zero"],
        "07_naming_inconsistency": ["inconsistent names", "city spelling", "trailing space", "jhb", "trim", "char(160)"],
    }

    for battle_id, keywords in signals.items():
        if any(kw in text_lower for kw in keywords):
            detected_battles.append(battle_id)

    # If no specific keyword matched, recommend the core foundation battles
    if not detected_battles:
        detected_battles = ["01_floating_point", "02_merged_headers", "05_format_break_2016"]

    return {
        "detected_battles": detected_battles,
        "summary": f"Detected {len(detected_battles)} relevant data cleaning challenges from your brief.",
        "zero_data_guarantee": "No actual student data was ingested.",
    }
