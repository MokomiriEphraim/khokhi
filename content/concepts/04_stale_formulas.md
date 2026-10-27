# Battle 04: Stale Formulas & Frozen Calculations

## 1. The Core Symptom
You clean up source numbers or change tax rates, but totals and KPI calculations don't update! You re-enter formulas, but the old number remains fixed.

## 2. Why It Happens
Large workbooks or legacy template exports often toggle Excel calculation mode to **Manual** (`Formulas > Calculation Options > Manual`) to avoid lagging.

## 3. The Socratic Solution
1. Press `F9` or `Ctrl+Alt+F9` to force a full recalculation.
2. Check `Formulas > Calculation Options` and change it back to **Automatic**.
3. For PivotTables, right-click and click **Refresh** (`Alt+F5`), or check Data Source range.

## 4. Teach-Back Prompt
*What causes an Excel sheet to display outdated numbers even when cell references are correct, and how do you verify calculation mode?*
