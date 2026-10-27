import io
import csv
from typing import Tuple, Dict

def generate_sandbox_csv(battle_id: str) -> Tuple[str, str]:
    """
    Generates synthetic practice dataset containing the exact bug for the requested battle.
    Returns (csv_text_content, filename).
    Uses 100% fake names and dummy mock transactions.
    """
    output = io.StringIO()
    writer = csv.writer(output)

    if battle_id == "01_floating_point":
        writer.writerow(["transaction_id", "item_name", "subtotal", "tax_calc", "customer_paid", "match_flag"])
        writer.writerow(["TX-1001", "Acme Widget A", "19.99", "2.9985", "22.9885", "=IF(C2+D2=E2, \"MATCH\", \"MISMATCH_FLOAT\")"])
        writer.writerow(["TX-1002", "Cyber Gadget B", "49.95", "7.4925", "57.4425", "=IF(C3+D3=E3, \"MATCH\", \"MISMATCH_FLOAT\")"])
        writer.writerow(["TX-1003", "Solar Pack C", "10.10", "1.5150", "11.6150", "=IF(C4+D4=E4, \"MATCH\", \"MISMATCH_FLOAT\")"])
        writer.writerow(["TX-1004", "Quantum Mouse", "33.30", "4.9950", "38.2950", "=IF(C5+D5=E5, \"MATCH\", \"MISMATCH_FLOAT\")"])
        filename = "sandbox_practice_floating_point_fake_data.csv"

    elif battle_id == "02_merged_headers":
        # Simulate merged header artifact where row 1 has a category across cols B, C, D
        writer.writerow(["Store_ID", "Q1_Sales_Performance", "", "", "Manager"])
        writer.writerow(["", "January", "February", "March", ""])
        writer.writerow(["STR-01", "45000", "52000", "61000", "Thabo Molefe"])
        writer.writerow(["STR-02", "38000", "41000", "49000", "Naledi Sithole"])
        writer.writerow(["STR-03", "89000", "94000", "102000", "Liam Van Der Merwe"])
        filename = "sandbox_practice_merged_headers_fake_data.csv"

    elif battle_id == "03_multi_row_headers":
        writer.writerow(["Division", "Revenue_Target", "Revenue_Actual", "Cost_Budget", "Cost_Actual"])
        writer.writerow(["[Header Tier 2]", "ZAR", "ZAR", "ZAR", "ZAR"])
        writer.writerow(["Logistics North", "1200000", "1150000", "800000", "820000"])
        writer.writerow(["Logistics South", "950000", "990000", "600000", "580000"])
        writer.writerow(["Enterprise Cloud", "2400000", "2650000", "1100000", "1050000"])
        filename = "sandbox_practice_multi_row_headers_fake_data.csv"

    elif battle_id == "04_stale_formulas":
        writer.writerow(["rep_name", "units_sold", "unit_price", "commission_rate", "total_commission"])
        writer.writerow(["Kagiso", "140", "150", "0.08", "1680"])
        writer.writerow(["Aisha", "210", "150", "0.08", "2520"])
        writer.writerow(["Zack", "85", "150", "0.08", "1020"])
        filename = "sandbox_practice_stale_formulas_fake_data.csv"

    elif battle_id == "05_format_break_2016":
        writer.writerow(["invoice_no", "date_issued_messy", "sales_amount_stored_as_text", "status"])
        writer.writerow(["INV-801", "2024/01/15", "'4500.00", "PAID"])
        writer.writerow(["INV-802", "15/02/2024", "'12800.50", "PAID"])
        writer.writerow(["INV-803", "03-01-2024", "'3200.00", "PENDING"])
        writer.writerow(["INV-804", "2024.04.12", "'8950.00", "PAID"])
        filename = "sandbox_practice_format_break_fake_data.csv"

    elif battle_id == "06_blank_vs_zero":
        writer.writerow(["candidate_id", "module_1_score", "module_2_score", "final_exam_score", "notes"])
        writer.writerow(["STU-101", "88", "92", "85", "Passed"])
        writer.writerow(["STU-102", "75", "", "", "Absent due to illness"])
        writer.writerow(["STU-103", "64", "70", "0", "Failed on attendance / exam forfeit"])
        writer.writerow(["STU-104", "95", "90", "94", "Distinction"])
        filename = "sandbox_practice_blank_vs_zero_fake_data.csv"

    else:
        # Naming inconsistency
        writer.writerow(["client_id", "city_raw", "order_volume"])
        writer.writerow(["CL-001", "Johannesburg", "420"])
        writer.writerow(["CL-002", "JHB", "310"])
        writer.writerow(["CL-003", "Johannesburg ", "180"])
        writer.writerow(["CL-004", "jhb", "540"])
        writer.writerow(["CL-005", "Cape Town", "620"])
        writer.writerow(["CL-006", "CPT ", "290"])
        filename = "sandbox_practice_naming_inconsistency_fake_data.csv"

    return output.getvalue(), filename
