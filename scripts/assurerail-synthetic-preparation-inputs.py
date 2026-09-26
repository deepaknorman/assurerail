#!/usr/bin/env python3
"""Generate the bounded synthetic Book A corpus for the hosted Preparation review."""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
from datetime import date
from pathlib import Path

SYNTHETIC_MARKER = "ASSURERAIL_SYNTHETIC_DEMO_INPUT"
BOOK_REF = "SYN-EV-2W-2025"
SELECTED_LOAN_IDS = [
    "SYN-A-LN-0001", "SYN-A-LN-0002", "SYN-A-LN-0003", "SYN-A-LN-0006", "SYN-A-LN-0007",
    "SYN-A-LN-0008", "SYN-A-LN-0009", "SYN-A-LN-0012", "SYN-A-LN-0013", "SYN-A-LN-0018",
]
PLANTED_MISMATCH_LOAN_ID = "SYN-A-LN-0012"
PLANTED_MISMATCH_MINOR = 10_000  # INR 100.00 above the admitted tape.
CSV_DOCUMENTS = {
    "SECURITY_DOCUMENT": ("security-document", ["loan_id", "security_type", "vehicle_registration_number", "chassis_number", "engine_number", "hypothecation_status"]),
    "REPAYMENT_HISTORY": ("repayment-history", ["loan_id", "account_reference", "principal_outstanding_rupees", "days_past_due", "overdue_amount_rupees", "as_of_date"]),
    "KYC_AUTHORITY": ("kyc-authority", ["loan_id", "borrower_name", "identity_reference", "synthetic_address", "authority_status"]),
    "INSURANCE_COLLATERAL": ("insurance-collateral", ["loan_id", "policy_number", "insured_vehicle_registration", "insurance_expiry_date", "coverage_status"]),
}


def rupees(paise: str | int) -> str:
    value = int(paise)
    return f"{value // 100}.{value % 100:02d}"


def add_months(value: str, months: int) -> str:
    current = date.fromisoformat(value)
    month_index = current.month - 1 + months
    year, month = current.year + month_index // 12, month_index % 12 + 1
    return date(year, month, min(current.day, 28)).isoformat()


def source_loans(tape_path: Path, master_path: Path) -> list[dict[str, str]]:
    tape: dict[str, str] = {}
    with tape_path.open(newline="", encoding="utf-8") as source:
        for row in csv.DictReader(source):
            prior = tape.get(row["loan_id"])
            if prior and prior != row["principal_minor"]:
                raise ValueError(f"inconsistent tape principal for {row['loan_id']}")
            tape.setdefault(row["loan_id"], row["principal_minor"])
    with master_path.open(newline="", encoding="utf-8") as source:
        master = {row["loan_id"]: row for row in csv.DictReader(source) if row["loanbook_ref"] == BOOK_REF}
    selected = []
    for loan_id in SELECTED_LOAN_IDS:
        if loan_id not in tape or loan_id not in master:
            raise ValueError(f"selected loan missing from source data: {loan_id}")
        row = {**master[loan_id], "principal_minor": tape[loan_id]}
        if rupees(row["principal_minor"]) != row["principal_outstanding_inr"]:
            raise ValueError(f"master and tape principal differ for {loan_id}")
        selected.append(row)
    if {row["state"] for row in selected} != {"Karnataka", "Maharashtra", "Tamil Nadu"}:
        raise ValueError("selected loans must cover all three Book A states")
    repayment_states = {"ARREARS" if int(row["days_past_due"]) else "ON_TIME" for row in selected}
    if repayment_states != {"ARREARS", "ON_TIME"}:
        raise ValueError("selected loans must cover both repayment states")
    return selected


def pdf_text(lines: list[str]) -> bytes:
    def escaped(value: str) -> str:
        return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    operations = ["BT", "/F1 10 Tf", "50 790 Td"]
    for line in lines:
        operations.extend([f"({escaped(line)}) Tj", "0 -14 Td"])
    operations.append("ET")
    stream = ("\n".join(operations) + "\n").encode("ascii")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n" + stream + b"endstream",
    ]
    payload = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for number, body in enumerate(objects, 1):
        offsets.append(len(payload)); payload.extend(f"{number} 0 obj\n".encode("ascii") + body + b"\nendobj\n")
    xref = len(payload)
    payload.extend(f"xref\n0 {len(objects)+1}\n".encode("ascii")); payload.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]: payload.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    payload.extend(f"trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode("ascii"))
    return bytes(payload)


def agreement_pdf(row: dict[str, str]) -> bytes:
    return pdf_text([
        SYNTHETIC_MARKER, "Synthetic loan agreement evidence - demonstration only",
        f"loan_id: {row['loan_id']}", f"borrower_name: {row['borrower_display_name']}",
        f"sanctioned_amount_rupees: {row['original_principal_inr']}", f"disbursed_amount_rupees: {row['original_principal_inr']}",
        f"disbursement_date: {row['origination_date']}", f"tenor_months: {row['original_term_months']}",
        "interest_type: FIXED", f"interest_rate_percent: {row['annual_interest_rate_percent']}",
        f"instalment_amount_rupees: {row['scheduled_instalment_inr']}", "repayment_frequency: MONTHLY",
        f"maturity_date: {add_months(row['origination_date'], int(row['original_term_months']))}",
    ])


def csv_values(kind: str, row: dict[str, str], ordinal: int) -> list[str]:
    loan_id, suffix = row["loan_id"], f"{ordinal:04d}"
    registration = f"SYN-EV-A-{suffix}"
    if kind == "SECURITY_DOCUMENT":
        return [loan_id, "ELECTRIC_TWO_WHEELER", registration, f"SYNCHASSISA{suffix}", f"SYNENGINEA{suffix}", "RECORDED"]
    if kind == "REPAYMENT_HISTORY":
        principal_minor = int(row["principal_minor"]) + (PLANTED_MISMATCH_MINOR if loan_id == PLANTED_MISMATCH_LOAN_ID else 0)
        overdue_minor = int(row["missed_instalments"]) * round(float(row["scheduled_instalment_inr"]) * 100)
        return [loan_id, f"SYN-ACCT-A-{suffix}", rupees(principal_minor), row["days_past_due"], rupees(overdue_minor), row["as_of_date"]]
    if kind == "KYC_AUTHORITY":
        return [loan_id, row["borrower_display_name"], f"SYN-KYC-A-{suffix}", f"Synthetic address A {suffix}", "BORROWER_AUTHORITY_RECORDED"]
    if kind == "INSURANCE_COLLATERAL":
        return [loan_id, f"SYN-POLICY-A-{suffix}", registration, "2027-09-14", "ACTIVE_SYNTHETIC"]
    raise ValueError(f"unsupported document kind {kind}")


def manifest_row(path: Path, document_type: str, loan_id: str, content_type: str) -> dict[str, object]:
    payload = path.read_bytes()
    return {"filename": path.name, "documentType": document_type, "contentType": content_type, "loanId": loan_id, "bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest()}


def write_pack(tape: Path, master: Path, output: Path) -> dict[str, object]:
    if output.exists() and any(output.iterdir()):
        raise ValueError("output directory must be absent or empty")
    output.mkdir(parents=True, exist_ok=True)
    documents: list[dict[str, object]] = []
    selected = source_loans(tape, master)
    for ordinal, row in enumerate(selected, 1):
        pdf_path = output / f"{ordinal:04d}-loan-agreement.pdf"
        pdf_path.write_bytes(agreement_pdf(row))
        documents.append(manifest_row(pdf_path, "LOAN_AGREEMENT", row["loan_id"], "application/pdf"))
        for kind, (prefix, headers) in CSV_DOCUMENTS.items():
            path = output / f"{ordinal:04d}-{prefix}.csv"
            with path.open("w", newline="", encoding="utf-8") as target:
                writer = csv.writer(target, lineterminator="\n")
                writer.writerow(["synthetic_marker", *headers])
                writer.writerow([SYNTHETIC_MARKER, *csv_values(kind, row, ordinal)])
            documents.append(manifest_row(path, kind, row["loan_id"], "text/csv"))
    mismatch = next(row for row in selected if row["loan_id"] == PLANTED_MISMATCH_LOAN_ID)
    result = {
        "schemaVersion": 1, "syntheticOnly": True, "syntheticMarker": SYNTHETIC_MARKER,
        "bookRef": BOOK_REF, "asOfDate": "2026-09-15", "loanCount": len(selected),
        "documentCount": len(documents), "coverageClaim": f"{len(selected)}/1200",
        "selection": {
            "states": sorted({row["state"] for row in selected}),
            "repaymentStates": ["ARREARS", "ON_TIME"],
            "loanIds": SELECTED_LOAN_IDS,
            "selectedLoans": [{
                "loanId": row["loan_id"], "state": row["state"],
                "repaymentState": "ARREARS" if int(row["days_past_due"]) else "ON_TIME",
            } for row in selected],
        },
        "deliberateDefects": [{"code": "PRINCIPAL_OUTSTANDING_MISMATCH", "loanId": PLANTED_MISMATCH_LOAN_ID, "documentType": "REPAYMENT_HISTORY", "tapePrincipalMinor": mismatch["principal_minor"], "documentPrincipalMinor": str(int(mismatch["principal_minor"]) + PLANTED_MISMATCH_MINOR), "differenceMinor": str(PLANTED_MISMATCH_MINOR)}],
        "documents": documents,
    }
    (output / "manifest.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tape", type=Path, required=True)
    parser.add_argument("--loan-master", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    result = write_pack(args.tape, args.loan_master, args.output_dir)
    print(json.dumps({key: result[key] for key in ["syntheticOnly", "loanCount", "documentCount", "coverageClaim", "deliberateDefects"]}))


if __name__ == "__main__":
    main()
