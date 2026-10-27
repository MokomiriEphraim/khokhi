# Battle 07: Naming Inconsistency & Ghost Whitespace

## 1. The Core Symptom
You generate a PivotTable by Region or City, and instead of 3 neat rows, you get:
- `Johannesburg`
- `Johannesburg ` (with invisible trailing space)
- `JHB`
- `jhb`
- ` GP - Johannesburg`

## 2. Why It Happens
Freeform human entry introduces non-breaking spaces (`CHAR(160)` from web copy-paste), casing discrepancies, and varying regional acronyms. Excel groups exact byte matches.

## 3. The Socratic Solution
Apply a cleaning pipeline before pivoting:
1. Strip leading and trailing whitespace:
   ```excel
   =TRIM(CLEAN(SUBSTITUTE(A2, CHAR(160), " ")))
   ```
2. Standardize casing:
   ```excel
   =PROPER(B2)
   ```
3. Use a standardized 2-column Lookup Dictionary (`Lookup_Acronyms`) to map shorthand aliases (`JHB` -> `Johannesburg`).

## 4. Teach-Back Prompt
*Why does regular TRIM sometimes fail to remove spaces copied from web tables, and what 3-step pipeline normalizes messy categorical names?*
