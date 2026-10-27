from typing import Dict, Any

VISUAL_SCHEMATICS: Dict[str, Dict[str, Any]] = {
    "01_floating_point": {
        "title": "Floating-Point Precision Mismatch Visualized",
        "diagram": (
            "+-------------------------------------------------------------+\n"
            "| Cell A2 (Display: R 19.99)  --> Binary: 19.990000000000002   |\n"
            "| Cell B2 (Display: R 19.99)  --> Binary: 19.990000000000000   |\n"
            "| A2 = B2 Comparison         --> FALSE (Mismatch Error!)      |\n"
            "+-------------------------------------------------------------+\n"
            "| FIX: Wrap in ROUND(..., 2)                                  |\n"
            "| ROUND(A2, 2) = ROUND(B2, 2) --> TRUE                         |\n"
            "+-------------------------------------------------------------+"
        ),
        "steps": [
            "Observe the mismatch in formula bar.",
            "Write =A2-B2 in test column, set to General format with 15 decimals.",
            "Apply =ROUND(..., 2) to snap binary tail.",
        ],
    },
    "02_merged_headers": {
        "title": "Merged Cells Memory Allocation Map",
        "diagram": (
            "+----------------+----------------+----------------+\n"
            "| Column B       | Column C       | Column D       |\n"
            "+================+================+================+\n"
            "| [ 'Q1 Sales'   |    <NULL>      |    <NULL>    ] |\n"
            "|  Merged across B1, C1, D1 visually               |\n"
            "+----------------+----------------+----------------+\n"
            "| Data row: 450  | Data row: 520  | Data row: 610  |\n"
            "+----------------+----------------+----------------+\n"
            "| Formula =C1   --> 0 / BLANK (Data Tool Crash!)  |\n"
            "+--------------------------------------------------+"
        ),
        "steps": [
            "Select merged header row.",
            "Click 'Unmerge Cells'.",
            "Fill headers explicitly (e.g. Q1_Jan, Q1_Feb, Q1_Mar) or use 'Center Across Selection'.",
        ],
    },
}

def get_visual_walkthrough(battle_id: str) -> Dict[str, Any]:
    return VISUAL_SCHEMATICS.get(battle_id, {
        "title": "Standard Socratic Workflow",
        "diagram": (
            "+-----------------------------------------------+\n"
            "| 1. Observe symptom in sandbox                 |\n"
            "| 2. Diagnose root data structure flaw          |\n"
            "| 3. Execute non-destructive transformation     |\n"
            "| 4. Teach back the core mechanism to pass      |\n"
            "+-----------------------------------------------+"
        ),
        "steps": ["Diagnose", "Test on Sandbox", "Implement", "Teach Back"],
    })
