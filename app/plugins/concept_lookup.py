import os
from pathlib import Path
from typing import Dict, List, Optional

CONCEPTS_DIR = Path(__file__).resolve().parent.parent.parent / "content" / "concepts"

BATTLES = [
    {
        "id": "01_floating_point",
        "title": "Floating-Point Drift",
        "subtitle": "When 0.1 + 0.2 fails VLOOKUP and exact match",
        "difficulty": "Medium",
        "tag": "Numeric Integrity",
        "icon": "Calculator",
    },
    {
        "id": "02_merged_headers",
        "title": "Merged Headers Trap",
        "subtitle": "Why merged cells turn columns C & D into NULL ghosts",
        "difficulty": "Easy",
        "tag": "Layout & Schema",
        "icon": "Grid",
    },
    {
        "id": "03_multi_row_headers",
        "title": "Multi-Row Headers",
        "subtitle": "Flattening multi-tier reporting rows into tabular headers",
        "difficulty": "Medium",
        "tag": "Ingestion Pipeline",
        "icon": "Layers",
    },
    {
        "id": "04_stale_formulas",
        "title": "Stale Formulas & Frozen State",
        "subtitle": "Manual calculation mode & unrefreshed PivotTable caches",
        "difficulty": "Easy",
        "tag": "Workbook Config",
        "icon": "RefreshCw",
    },
    {
        "id": "05_format_break_2016",
        "title": "Format Break (Dates & Text Numbers)",
        "subtitle": "Why SUM() returns 0 and dates sort alphabetically",
        "difficulty": "Hard",
        "tag": "Data Typing",
        "icon": "Calendar",
    },
    {
        "id": "06_blank_vs_zero",
        "title": "Blank vs. Zero Skew",
        "subtitle": "How empty cells vs. literal 0 distort business averages",
        "difficulty": "Medium",
        "tag": "Statistical Bias",
        "icon": "PieChart",
    },
    {
        "id": "07_naming_inconsistency",
        "title": "Naming Inconsistency & Whitespace",
        "subtitle": "Cleaning ghost CHAR(160) spaces, casing & regional acronyms",
        "difficulty": "Medium",
        "tag": "String Normalization",
        "icon": "Type",
    },
]

def list_battles() -> List[Dict]:
    return BATTLES

def get_concept_content(battle_id: str) -> Optional[str]:
    # Look for matching file in CONCEPTS_DIR
    target = CONCEPTS_DIR / f"{battle_id}.md"
    if target.exists():
        return target.read_text(encoding="utf-8")
    for f in CONCEPTS_DIR.glob("*.md"):
        if battle_id in f.stem:
            return f.read_text(encoding="utf-8")
    return None
