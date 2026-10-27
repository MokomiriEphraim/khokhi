# Battle 02: Merged Headers Trap

## 1. The Core Symptom
A human designer created a nice-looking report where "Q1 Sales" was merged across columns `B`, `C`, and `D`.
When you try to:
- Sort by column `C`, Excel screams: *"This operation requires the merged cells to be identically sized."*
- Reference cell `C1` in a formula, it returns `0` or empty!
- Load the table into Power Query or Python pandas, columns `C` and `D` get named `Unnamed: 2` and `Unnamed: 3`.

## 2. Why It Happens (Root Cause)
In spreadsheet architecture, when cells `B1:D1` are merged, **only the top-left cell (`B1`) retains the actual string value**. Cells `C1` and `D1` become completely empty `NULL` cells beneath the display layer.

## 3. How to Diagnose
- Unmerge the header row temporarily.
- Observe how cells `C1` and `D1` immediately turn completely blank.

## 4. The Socratic Solution
**Never use merged cells in tabular data.** Instead:
1. **Unmerge** the row (`Home > Merge & Center > Unmerge Cells`).
2. Repeat or qualify the header names explicitly: `Q1_Jan`, `Q1_Feb`, `Q1_Mar`.
3. If visual centering is desired without merging cells, select the cells, press `Ctrl+1 > Alignment`, and choose **"Center Across Selection"**.

## 5. Teach-Back Prompt
*Why does merging B1:D1 make column C's header vanish to automated data tools, and what formatting feature gives the same visual look without breaking data integrity?*
