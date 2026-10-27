# Battle 06: Blank vs Zero Skew

## 1. The Core Symptom
Calculating average test score or customer satisfaction across regions gives misleading conclusions. One analyst says the average score is 82%; another says 54%!

## 2. Why It Happens
- `AVERAGE(A1:A10)` automatically skips **blank cells** (denominator excludes missing exams).
- But if missing students were entered as literal `0` or coerced to `0`, `AVERAGE()` includes them in the denominator, dragging the mean down drastically.

## 3. The Socratic Solution
Distinguish **Non-response/Missing** (`NULL`/empty) from **True Zero performance**.
- Use `AVERAGEIF(range, "<>0")` if zeros represent unattempted or missing records.
- Or use `=COUNTIF()` / `=COUNTA()` explicitly so the denominator reflects the intended population.

## 4. Teach-Back Prompt
*How does an empty cell differ mathematically from a cell containing 0 when running aggregate functions in Excel, and how does this affect business decisions?*
