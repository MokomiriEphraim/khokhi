# Battle 03: Multi-Row Headers

## 1. The Core Symptom
Row 1 has categories (`Regional Sales`, `Expenses`), and Row 2 has subcategories (`Target`, `Actual`, `Variance`).
When you create a PivotTable or import to Power Query/Pandas:
- The first data row is treated as row 3, but row 2 gets sucked into the dataset as if it were a record.
- Or row 1 becomes column names, and row 2 values become corrupted row items with mixed data types.

## 2. Why It Happens
Tabular standards require **one unique flat header per column**. Multi-tier reporting tables look neat on paper for humans, but machines expect each column vector to have a distinct 1-dimensional name.

## 3. The Socratic Solution
Merge the header tiers into a single descriptive string per column before ingestion:
1. In a temporary helper row, concatenate row 1 and row 2:
   ```excel
   =A1 & "_" & A2
   ```
2. Copy the concatenated row and **Paste Special > Values** into Row 1.
3. Delete Row 2 so Row 1 immediately sits directly above the first data record.

## 4. Teach-Back Prompt
*Explain why multi-row headers corrupt tabular data tools like Power Query, and how flattening them protects your downstream pipeline.*
