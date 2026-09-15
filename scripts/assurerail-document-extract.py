"""Bounded, read-only extraction worker. Receives bytes on stdin; no filenames or URLs from documents.

Run in a dedicated unprivileged container with no network and 512MiB memory in deployment.
PDF text extraction is not OCR: scanned/empty pages explicitly require further work.
"""
import csv
import io
import json
import resource
import sys
import zipfile
import xml.etree.ElementTree as ET

MAX_INPUT = 20 * 1024 * 1024
MAX_TEXT = 2_000_000
MAX_SEGMENTS = 100_000


def extract(data, kind):
    segments, exceptions = [], []
    total = 0

    def add(locator, text):
        nonlocal total
        total += len(text)
        if total > MAX_TEXT or len(segments) >= MAX_SEGMENTS:
            raise ValueError("EXTRACTION_LIMIT_EXCEEDED")
        segments.append({"locator": locator, "text": text})

    if kind == "text/csv":
        csv.field_size_limit(100_000)
        for n, row in enumerate(csv.reader(io.StringIO(data.decode("utf-8-sig")), strict=True), 1):
            if len(row) > 500:
                raise ValueError("COLUMN_LIMIT_EXCEEDED")
            add(f"row:{n}", json.dumps(row, ensure_ascii=False))
    elif kind == "application/pdf":
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(data), strict=True)
        if reader.is_encrypted or len(reader.pages) > 500:
            raise ValueError("ENCRYPTED_OR_OVERSIZED_PDF")
        for n, page in enumerate(reader.pages, 1):
            text = page.extract_text() or ""
            add(f"page:{n}", text)
            if not text.strip():
                exceptions.append({"locator": f"page:{n}", "code": "OCR_REQUIRED"})
    elif kind == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        ns = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            entries = archive.infolist()
            if len(entries) > 5000 or sum(i.file_size for i in entries) > 50 * 1024 * 1024 or len({i.filename for i in entries}) != len(entries):
                raise ValueError("UNSAFE_WORKBOOK_ARCHIVE")
            if any("vbaProject" in i.filename or "externalLinks/" in i.filename for i in entries):
                raise ValueError("ACTIVE_OR_EXTERNAL_WORKBOOK_CONTENT")

            def xml(name):
                raw = archive.read(name)
                if b"<!DOCTYPE" in raw.upper() or b"<!ENTITY" in raw.upper():
                    raise ValueError("UNSAFE_XML")
                return ET.fromstring(raw)

            strings = []
            if "xl/sharedStrings.xml" in archive.namelist():
                strings = ["".join(t.text or "" for t in e.findall(".//s:t", ns)) for e in xml("xl/sharedStrings.xml").findall("s:si", ns)]
            sheets = sorted(i.filename for i in entries if i.filename.startswith("xl/worksheets/sheet") and i.filename.endswith(".xml"))
            if not sheets:
                raise ValueError("NO_WORKSHEETS")
            for sheet in sheets:
                for cell in xml(sheet).findall(".//s:sheetData/s:row/s:c", ns):
                    ref = cell.get("r", "")
                    locator = f"{sheet}:{ref}"
                    if cell.find("s:f", ns) is not None:
                        exceptions.append({"locator": locator, "code": "FORMULA_REQUIRES_VALUES_EXPORT"})
                        continue  # Never evaluate formulas or trust cached results as loan evidence.
                    value = cell.find("s:v", ns)
                    text = value.text or "" if value is not None else ""
                    if cell.get("t") == "s":
                        index = int(text)
                        if index < 0 or index >= len(strings):
                            raise ValueError("INVALID_SHARED_STRING")
                        text = strings[index]
                    elif cell.get("t") == "inlineStr":
                        text = "".join(t.text or "" for t in cell.findall("s:is//s:t", ns))
                    add(locator, text)
    else:
        raise ValueError("UNSUPPORTED_DOCUMENT_TYPE")
    if not segments:
        raise ValueError("EMPTY_DOCUMENT")
    return {"segments": segments, "exceptions": exceptions, "extractorVersion": "rail-extract-1"}


if __name__ == "__main__":
    resource.setrlimit(resource.RLIMIT_CPU, (20, 20))
    if sys.platform != "darwin":
        resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
    try:
        data = sys.stdin.buffer.read(MAX_INPUT + 1)
        if len(data) > MAX_INPUT:
            raise ValueError("INPUT_LIMIT_EXCEEDED")
        print(json.dumps(extract(data, sys.argv[1]), ensure_ascii=False))
    except Exception:
        # Do not print document text, filenames, exception details or secrets.
        print(json.dumps({"error": "EXTRACTION_FAILED_REVIEW_REQUIRED"}))
        sys.exit(1)
