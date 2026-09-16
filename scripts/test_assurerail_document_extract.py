"""Synthetic extraction fixtures; no borrower data or model API calls."""
import importlib.util
import io
from pathlib import Path
import unittest
import zipfile

spec = importlib.util.spec_from_file_location("rail_extract", Path(__file__).with_name("assurerail-document-extract.py"))
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class ExtractionTest(unittest.TestCase):
    def test_csv_preserves_quoted_commas_newlines_and_leading_zero_ids(self):
        result = worker.extract(b'loan_id,amount,note\n001,100.00,"a,b\nc"\n', "text/csv")
        self.assertEqual(len(result["segments"]), 2)
        self.assertIn('"001"', result["segments"][1]["text"])
        self.assertIn('100.00', result["segments"][1]["text"])

    def test_csv_invalid_utf8_is_not_silently_replaced(self):
        with self.assertRaises(UnicodeDecodeError):
            worker.extract(b'loan\n\xff', "text/csv")

    def test_csv_column_bomb_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "COLUMN_LIMIT_EXCEEDED"):
            worker.extract((",".join(["x"] * 501)).encode(), "text/csv")

    def test_empty_and_unsupported_documents_fail_closed(self):
        with self.assertRaisesRegex(ValueError, "EMPTY_DOCUMENT"):
            worker.extract(b"", "text/csv")
        with self.assertRaisesRegex(ValueError, "UNSUPPORTED_DOCUMENT_TYPE"):
            worker.extract(b"borrower data", "text/plain")

    def workbook(self, sheet, extra=None):
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w") as z:
            z.writestr("xl/worksheets/sheet1.xml", sheet)
            if extra:
                z.writestr(*extra)
        return output.getvalue()

    def test_xlsx_retains_cell_locations_and_flags_formulas(self):
        data = self.workbook('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Loan ID</t></is></c><c r="B1"><v>100</v></c><c r="C1"><f>1+2</f><v>3</v></c></row></sheetData></worksheet>')
        result = worker.extract(data, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        self.assertEqual(result["segments"][0], {"locator": "xl/worksheets/sheet1.xml:A1", "text": "Loan ID"})
        self.assertEqual(result["exceptions"][0]["code"], "FORMULA_REQUIRES_VALUES_EXPORT")
        self.assertEqual(len(result["segments"]), 2)

    def test_rich_text_is_preserved_without_formatting_metadata(self):
        data = self.workbook('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><r><t>AB</t></r><r><t>001</t></r></is></c><c r="B1" t="s"><v>0</v></c></row></sheetData></worksheet>', ("xl/sharedStrings.xml", '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><r><rPr><rFont val="Arial"/></rPr><t>XY</t></r><r><t>002</t></r></si></sst>'))
        result = worker.extract(data, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        self.assertEqual([s["text"] for s in result["segments"]], ["AB001", "XY002"])

    def test_workbook_entity_and_external_link_rejected(self):
        mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        with self.assertRaisesRegex(ValueError, "UNSAFE_XML"):
            worker.extract(self.workbook('<!DOCTYPE sheet [<!ENTITY x "secret">]><sheet/>'), mime)
        with self.assertRaisesRegex(ValueError, "EXTERNAL"):
            worker.extract(self.workbook('<sheet/>', ("xl/externalLinks/link1.xml", "")), mime)

    def test_workbook_duplicate_archive_entry_is_rejected(self):
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w") as archive:
            archive.writestr("xl/worksheets/sheet1.xml", "<sheet/>")
            archive.writestr("xl/worksheets/sheet1.xml", "<sheet/>")
        with self.assertRaisesRegex(ValueError, "UNSAFE_WORKBOOK_ARCHIVE"):
            worker.extract(output.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

    def test_pdf_text_and_blank_page_ocr_gap(self):
        from pypdf import PdfWriter
        from pypdf.generic import NameObject, DictionaryObject, DecodedStreamObject
        writer = PdfWriter()
        page = writer.add_blank_page(width=612, height=792)
        font = DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"), NameObject("/BaseFont"): NameObject("/Helvetica")})
        page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})})
        content = DecodedStreamObject()
        content.set_data(b"BT /F1 12 Tf 72 720 Td (Loan AB123 Principal 10000) Tj ET")
        page[NameObject("/Contents")] = content
        writer.add_blank_page(width=612, height=792)
        output = io.BytesIO()
        writer.write(output)
        result = worker.extract(output.getvalue(), "application/pdf")
        self.assertIn("AB123", result["segments"][0]["text"])
        self.assertEqual(result["exceptions"], [{"locator": "page:2", "code": "OCR_REQUIRED"}])


if __name__ == "__main__":
    unittest.main()
