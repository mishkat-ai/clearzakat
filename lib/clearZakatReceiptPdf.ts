import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const FOREST_RGB: [number, number, number] = [27, 77, 62];

export type ClearZakatReceiptInput = {
  recipientName: string;
  dateLabel: string;
  netZakatableFormatted: string;
  zakatDueFormatted: string;
  currencyCode: string;
};

export function downloadClearZakatReceiptPdf(input: ClearZakatReceiptInput): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(26, 26, 26);
  doc.text("ClearZakat Record", pageW / 2, 24, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(115, 115, 115);
  doc.text("Zakat calculation receipt", pageW / 2, 32, { align: "center" });

  doc.setTextColor(26, 26, 26);
  doc.setFontSize(10);
  const safeName =
    input.recipientName.trim() || "—";
  doc.text(`Prepared for: ${safeName}`, pageW / 2, 40, { align: "center" });

  autoTable(doc, {
    startY: 48,
    head: [["Detail", "Value"]],
    body: [
      ["Date", input.dateLabel],
      ["Currency", input.currencyCode],
      ["Net Zakatable Assets", input.netZakatableFormatted],
      ["Total Zakat Due (2.5%)", input.zakatDueFormatted],
    ],
    theme: "striped",
    styles: {
      fontSize: 10,
      cellPadding: { top: 4, right: 4, bottom: 4, left: 4 },
      lineColor: [229, 229, 229],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: FOREST_RGB,
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 72 },
      1: { halign: "right" },
    },
    margin: { left: 16, right: 16 },
  });

  doc.setFontSize(8);
  doc.setTextColor(115, 115, 115);
  doc.text(
    "This is an estimate for your records. Verify rates, Nisab, and rulings with a qualified scholar.",
    pageW / 2,
    285,
    { align: "center", maxWidth: pageW - 32 },
  );

  doc.save("ClearZakat-Receipt.pdf");
}
