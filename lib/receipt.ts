import { jsPDF } from "jspdf";
import { formatCurrency } from "@/lib/utils";
import type { Sale, ShopSettings } from "@/types";

export interface ReceiptData {
  settings: ShopSettings;
  sale: Sale;
}

export function buildReceiptHtml(data: ReceiptData): string {
  const { settings, sale } = data;
  const date =
    sale.createdAt instanceof Date
      ? sale.createdAt
      : sale.createdAt.toDate?.() ?? new Date();

  const rows = sale.items
    .map(
      (item) => `
      <tr>
        <td>${item.productName}</td>
        <td align="center">${item.quantity}</td>
        <td align="right">${formatCurrency(item.unitPrice)}</td>
        <td align="right">${formatCurrency(item.lineTotal)}</td>
      </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt ${sale.invoiceNumber}</title>
  <style>
    body { font-family: 'Courier New', monospace; max-width: 320px; margin: 0 auto; padding: 16px; font-size: 12px; }
    h1 { font-size: 16px; text-align: center; margin: 0 0 4px; }
    .center { text-align: center; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { padding: 4px 2px; }
    th { border-bottom: 1px dashed #000; }
    .totals td { padding: 2px 0; }
    .divider { border-top: 1px dashed #000; margin: 8px 0; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  ${settings.logoUrl ? `<div class="center"><img src="${settings.logoUrl}" alt="Logo" style="max-height:48px;margin-bottom:8px"/></div>` : ""}
  <h1>${sale.type === "return" ? "Return Invoice" : settings.shopName}</h1>
  <p class="center">${settings.address}<br>${settings.contactNumber}</p>
  <div class="divider"></div>
  <p>Invoice: <strong>${sale.invoiceNumber}</strong><br>
  Date: ${date.toLocaleString()}</p>
  <table>
    <thead>
      <tr>
        <th align="left">Item</th>
        <th>Qty</th>
        <th align="right">Price</th>
        <th align="right">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <table class="totals">
    <tr><td>Subtotal</td><td align="right">${formatCurrency(sale.subtotal)}</td></tr>
    ${sale.discountAmount > 0 ? `<tr><td>Discount</td><td align="right">-${formatCurrency(sale.discountAmount)}</td></tr>` : ""}
    <tr><td><strong>Grand Total</strong></td><td align="right"><strong>${formatCurrency(sale.grandTotal)}</strong></td></tr>
    <tr><td>Cash Received</td><td align="right">${formatCurrency(sale.amountReceived)}</td></tr>
    <tr><td>Balance</td><td align="right">${formatCurrency(sale.balance)}</td></tr>
  </table>
  <div class="divider"></div>
  <p class="center">${settings.receiptFooter}</p>
</body>
</html>`;
}

export function printReceipt(data: ReceiptData): void {
  const html = buildReceiptHtml(data);
  const win = window.open("", "_blank", "width=400,height=600");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 300);
}

export function downloadReceiptPdf(data: ReceiptData): void {
  const { settings, sale } = data;
  const doc = new jsPDF({ unit: "mm", format: [80, 200] });
  let y = 8;
  const line = (text: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(8);
    doc.text(text, 40, y, { align: "center" });
    y += 4;
  };

  line(settings.shopName, true);
  line(settings.address);
  line(settings.contactNumber);
  y += 2;
  line(`Invoice: ${sale.invoiceNumber}`);
  const date =
    sale.createdAt instanceof Date
      ? sale.createdAt
      : sale.createdAt.toDate?.() ?? new Date();
  line(date.toLocaleString());
  y += 2;

  doc.setFontSize(7);
  sale.items.forEach((item) => {
    doc.text(item.productName.slice(0, 20), 4, y);
    doc.text(`${item.quantity}x`, 50, y);
    doc.text(formatCurrency(item.lineTotal), 72, y, { align: "right" });
    y += 4;
  });

  y += 2;
  doc.text(`Subtotal: ${formatCurrency(sale.subtotal)}`, 4, y);
  y += 4;
  if (sale.discountAmount > 0) {
    doc.text(`Discount: -${formatCurrency(sale.discountAmount)}`, 4, y);
    y += 4;
  }
  doc.setFont("helvetica", "bold");
  doc.text(`TOTAL: ${formatCurrency(sale.grandTotal)}`, 4, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.text(`Received: ${formatCurrency(sale.amountReceived)}`, 4, y);
  y += 4;
  doc.text(`Balance: ${formatCurrency(sale.balance)}`, 4, y);
  y += 6;
  doc.text(settings.receiptFooter, 40, y, { align: "center" });

  doc.save(`${sale.invoiceNumber}.pdf`);
}
