# Battle 05: Format Break (Dates & Stored-as-Text Numbers)

## 1. The Core Symptom
When you sort dates, they sort alphabetically (e.g. `01/10/2024` comes before `02/01/2024`, but `10/01/2024` jumps to the bottom).
Or `SUM(Sales)` returns `0` despite having numbers in every cell.

## 2. Why It Happens
The numbers or dates are stored as **Text Strings** (often indicated by a green triangle in the upper-left corner of the cell, or left-alignment). Excel does not convert text numbers in mathematical aggregator formulas.

## 3. The Socratic Solution
- For stored-as-text numbers: Multiply by 1 (`=A2 * 1`), use `=VALUE(A2)`, or select the column > **Data > Text to Columns > Finish**.
- For mixed date formats: Use `DATEVALUE()` or Power Query's **Using Locale** transformation to explicitly declare whether source is `DD/MM/YYYY` or `MM/DD/YYYY`.

## 4. Teach-Back Prompt
*Why does SUM() return 0 on text numbers when manual addition (+ cell) works, and what is the fastest way to coerce a whole column back to numeric?*
