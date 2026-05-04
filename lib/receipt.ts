import { relevantPersonLabel } from "./workflow";
import type { RepairDetail } from "./types";

export function renderReceiptHtml(repair: RepairDetail) {
  const person = relevantPersonLabel(repair);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Repair Receipt ${escapeHtml(repair.repairNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    body { background: #f8f5ee; color: #13211a; font-family: Georgia, serif; margin: 0; padding: 24px; }
    .receipt { background: white; border: 1px solid #ddd4c2; margin: 0 auto; max-width: 820px; padding: 22px; }
    .receipt-topline { color: #365847; display: flex; font-size: 13px; font-weight: 700; justify-content: space-between; letter-spacing: 0.14em; text-transform: uppercase; }
    .receipt-heading { display: flex; gap: 24px; justify-content: space-between; margin-top: 12px; }
    h1 { font-size: 48px; line-height: 0.95; margin: 0; }
    .receipt-summary { color: #66756d; font-size: 15px; margin: 10px 0 0; }
    table { border-collapse: collapse; width: 100%; margin-top: 16px; }
    td, th { border-bottom: 1px solid #e6dece; padding: 10px 0; text-align: left; vertical-align: top; }
    th { color: #1e5844; font-size: 14px; letter-spacing: 0.08em; text-transform: uppercase; width: 38%; }
    td { font-size: 17px; }
  </style>
</head>
<body>
  <main class="receipt">
    <div class="receipt-topline">
      <span>Repair Receipt</span>
      <span>${formatDate(repair.createdAt)}</span>
    </div>
    <div class="receipt-heading">
      <div>
        <h1>${escapeHtml(repair.party.name)}</h1>
        <p class="receipt-summary">${escapeHtml(repair.productDetails)}</p>
      </div>
    </div>
    <table>
      <tr><th>Date ID</th><td>${escapeHtml(repair.repairDateId)}</td></tr>
      <tr><th>Product Details</th><td>${escapeHtml(repair.productDetails)}</td></tr>
      ${repair.productColor ? `<tr><th>Color</th><td>${escapeHtml(repair.productColor)}</td></tr>` : ""}
      <tr><th>${escapeHtml(person.label)}</th><td>${escapeHtml(person.value)}</td></tr>
      <tr><th>Selling Price</th><td>${escapeHtml(formatMoney(repair.sellingPrice))}</td></tr>
      <tr><th>Created Date</th><td>${formatDate(repair.createdAt)}</td></tr>
    </table>
  </main>
</body>
</html>`;
}

export function buildReceiptLink(repairId: string, origin?: string) {
  const path = `/repairs/${repairId}/receipt`;
  return origin ? `${origin.replace(/\/$/, "")}${path}` : path;
}

export function buildPdfBytes(repair: RepairDetail) {
  const person = relevantPersonLabel(repair);
  const rows = [
    ["Date ID", repair.repairDateId],
    ["Product Details", repair.productDetails],
    ...(repair.productColor ? [["Color", repair.productColor]] : []),
    [person.label, person.value],
    ["Selling Price", formatMoney(repair.sellingPrice)],
    ["Created Date", formatDate(repair.createdAt)],
  ] as Array<[string, string]>;

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 22;
  const copyHeight = pageHeight - margin * 2;
  const copyWidth = pageWidth - margin * 2;

  const commands: string[] = [];
  drawReceiptCopy(commands, margin, margin, copyWidth, copyHeight, repair, rows);

  const stream = commands.join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj",
    `6 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
  ];
  return `%PDF-1.4\n${objects.join("\n")}\ntrailer << /Root 1 0 R >>\n%%EOF`;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function drawReceiptCopy(
  commands: string[],
  left: number,
  bottom: number,
  width: number,
  height: number,
  repair: RepairDetail,
  rows: Array<[string, string]>,
) {
  const top = bottom + height;
  const innerLeft = left + 12;
  const innerRight = left + width - 12;
  let currentY = top - 14;

  commands.push("0.85 0.82 0.76 RG");
  commands.push(`${left} ${bottom} ${width} ${height} re S`);
  commands.push("0.18 0.38 0.29 rg");
  commands.push(`BT /F2 8 Tf 1 0 0 1 ${innerLeft} ${currentY} Tm (${pdfText("REPAIR RECEIPT")}) Tj ET`);
  commands.push(`BT /F2 8 Tf 1 0 0 1 ${innerRight - 95} ${currentY} Tm (${pdfText(formatDate(repair.createdAt).toUpperCase())}) Tj ET`);

  currentY -= 20;
  commands.push("0.07 0.13 0.1 rg");
  commands.push(`BT /F2 26 Tf 1 0 0 1 ${innerLeft} ${currentY} Tm (${pdfText(repair.party.name)}) Tj ET`);

  currentY -= 16;
  commands.push("0.4 0.46 0.43 rg");
  commands.push(`BT /F1 10 Tf 1 0 0 1 ${innerLeft} ${currentY} Tm (${pdfText(repair.productDetails)}) Tj ET`);

  currentY -= 8;
  for (const [label, value] of rows) {
    commands.push("0.9 0.87 0.8 RG");
    commands.push(`${innerLeft} ${currentY} m ${innerRight} ${currentY} l S`);
    currentY -= 10;

    commands.push("0.14 0.35 0.27 rg");
    commands.push(`BT /F2 8 Tf 1 0 0 1 ${innerLeft} ${currentY} Tm (${pdfText(label.toUpperCase())}) Tj ET`);
    currentY -= 10;

    const valueLines = wrapPdfText(value, 36);
    commands.push("0.08 0.13 0.1 rg");
    for (const line of valueLines.slice(0, 2)) {
      commands.push(`BT /F1 10 Tf 1 0 0 1 ${innerLeft} ${currentY} Tm (${pdfText(line)}) Tj ET`);
      currentY -= 10;
    }
    currentY -= 2;
  }
}

function wrapPdfText(value: string, maxChars: number) {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const next = currentLine ? `${currentLine} ${word}` : word;
    if (next.length <= maxChars) {
      currentLine = next;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines;
}

function pdfText(value: string) {
  return value.replace(/[()\\]/g, "\\$&");
}
