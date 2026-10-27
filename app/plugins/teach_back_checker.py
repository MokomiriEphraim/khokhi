import re
from typing import Dict, Any

TEACH_BACK_RUBRICS: Dict[str, Dict[str, Any]] = {
    "01_floating_point": {
        "keywords": ["round", "precision", "binary", "ieee", "float", "decimal", "representation", "tail"],
        "min_length": 30,
        "sample_good": "Computers store numbers in binary float which causes rounding drift like .0000000000002, so comparing with = fails until you wrap with ROUND to 2 decimals.",
    },
    "02_merged_headers": {
        "keywords": ["top-left", "unmerge", "null", "empty", "blank", "center across selection", "column", "c1", "lost"],
        "min_length": 30,
        "sample_good": "When cells are merged, only the top-left cell retains the value while the rest become null, breaking formulas and Power Query. We fix it by unmerging and repeating headers or using Center Across Selection.",
    },
    "03_multi_row_headers": {
        "keywords": ["flatten", "concatenate", "single", "combine", "pandas", "power query", "tier", "row"],
        "min_length": 30,
        "sample_good": "Data tools expect a single header row. Multi-tier rows get treated as data. We fix it by concatenating row 1 and row 2 into a single descriptive title.",
    },
    "04_stale_formulas": {
        "keywords": ["manual", "automatic", "calculation", "f9", "refresh", "options", "recalculate"],
        "min_length": 25,
        "sample_good": "Calculation mode was set to manual so formulas didn't trigger. Setting it to automatic or pressing F9 forces recalculation.",
    },
    "05_format_break_2016": {
        "keywords": ["text", "number", "stored as text", "value", "text to columns", "coerce", "green triangle"],
        "min_length": 30,
        "sample_good": "The numbers were stored as text so SUM treated them as 0. Coercing via Text to Columns or multiplying by 1 converts them back to real numbers.",
    },
    "06_blank_vs_zero": {
        "keywords": ["denominator", "average", "missing", "count", "null", "skew", "absent", "exclude"],
        "min_length": 30,
        "sample_good": "Average ignores blank cells in its count, but literal 0s are counted in the denominator, dragging down the average. We must use AVERAGEIF or leave missing entries blank.",
    },
    "07_naming_inconsistency": {
        "keywords": ["trim", "char(160)", "space", "whitespace", "lookup", "standardize", "casing", "proper", "clean"],
        "min_length": 30,
        "sample_good": "Non-breaking spaces and differing acronyms split rows in pivot tables. We use TRIM, CLEAN, and SUBSTITUTE for CHAR(160), along with a mapping dictionary.",
    },
}

def verify_teach_back(battle_id: str, explanation: str) -> Dict[str, Any]:
    rubric = TEACH_BACK_RUBRICS.get(battle_id, {
        "keywords": ["clean", "fix", "data", "excel"],
        "min_length": 20,
    })
    text = explanation.strip()

    if len(text) < rubric["min_length"]:
        return {
            "passed": False,
            "score": 35,
            "feedback": "Your explanation is too brief. Explain *why* the error happened in Excel and *how* your fix addresses the root cause.",
            "missing_aspects": ["Need more depth on the underlying cause."],
        }

    matched_keywords = [kw for kw in rubric["keywords"] if re.search(r"\b" + re.escape(kw), text, re.IGNORECASE)]
    match_ratio = len(matched_keywords) / max(2, len(rubric["keywords"]) // 2)

    if match_ratio >= 0.5 or len(matched_keywords) >= 2:
        return {
            "passed": True,
            "score": min(100, int(70 + (match_ratio * 30))),
            "feedback": "Excellent! You clearly identified the technical mechanism and demonstrated real comprehension.",
            "key_insights": matched_keywords,
        }
    else:
        return {
            "passed": False,
            "score": 50,
            "feedback": "You're on the right track, but you didn't mention the core technical mechanism. Review the concept card and describe what Excel is doing under the hood.",
            "missing_aspects": ["Identify the technical root cause (e.g. data types, cell states, or formula behavior)."],
        }
