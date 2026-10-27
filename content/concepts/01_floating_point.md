# Battle 01: Floating-Point Drift

## 1. The Core Symptom
You perform a lookup (`VLOOKUP` or `XLOOKUP`) or an exact comparison (`IF(A2 = B2, "Match", "Mismatch")`) on currency numbers or calculated tax amounts. Even though both cells visually display `$19.99`, Excel reports **"Mismatch"** or `#N/A`.

## 2. Why It Happens (Root Cause)
Computers represent numbers in IEEE 754 binary floating-point. Certain decimal numbers like `0.1` or `0.05` cannot be represented as finite binary fractions, producing tiny residual tails like `19.990000000000002` vs `19.99`.
When cells are formatted as currency, Excel visual rounding hides the precision difference from your eyes, but the underlying binary numbers remain unequal.

## 3. How to Diagnose
- In a blank test column, type `=A2 - B2`.
- Format the result as `General` with 15 decimal places.
- If you see `0.000000000000002` instead of `0`, you have caught floating-point drift!

## 4. The Socratic Solution
Instead of raw equality, explicitly snap numbers to financial precision using the `ROUND()` function:
```excel
=IF(ROUND(A2, 2) = ROUND(B2, 2), "Match", "Mismatch")
```
Or when doing lookups, create a helper clean column with `=ROUND(Price, 2)`.

## 5. Teach-Back Prompt
*Explain in your own words why two numbers that look identical as currency in Excel can fail an exact match test, and why `ROUND(..., 2)` cures it.*
