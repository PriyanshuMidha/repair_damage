import type { RepairDetail } from "./types";

export function renderReceiptHtml(repair: RepairDetail) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Repair Receipt ${repair.repairNumber}</title>
  <style>
    body { font-family: Georgia, serif; color: #111; }
    .receipt { max-width: 760px; margin: 32px auto; border: 1px solid #ddd; padding: 32px; }
    h1 { margin: 0 0 8px; }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    td, th { border-bottom: 1px solid #ddd; padding: 10px; text-align: left; }
    .muted { color: #666; }
  </style>
</head>
<body>
  <main class="receipt">
    <p class="muted">Damaged Goods Repair Receipt</p>
    <h1>${escapeHtml(repair.repairNumber)}</h1>
    <p>Received on ${formatDate(repair.receivedAt)} by ${escapeHtml(repair.receiverStaffName)}.</p>
    <table>
      <tr><th>Party</th><td>${escapeHtml(repair.party.name)} (${escapeHtml(repair.party.phone)})</td></tr>
      <tr><th>Product</th><td>${escapeHtml(repair.product.code)} - ${escapeHtml(repair.product.name)}</td></tr>
      <tr><th>Quantity</th><td>${repair.quantity}</td></tr>
      <tr><th>Billed</th><td>${repair.isBilled ? `Yes - ${escapeHtml(repair.billOrGrReference ?? "")}` : "No"}</td></tr>
      <tr><th>Condition</th><td>${escapeHtml(repair.productCondition)}</td></tr>
      <tr><th>Damage</th><td>${escapeHtml(repair.damageCategory)}<br/>${escapeHtml(repair.damageRemarks)}</td></tr>
      <tr><th>Status</th><td>${escapeHtml(repair.currentStatus)}</td></tr>
    </table>
    <p class="muted">This receipt confirms goods were received for repair assessment. It is not proof of completed repair.</p>
  </main>
</body>
</html>`;
}

export function buildWhatsAppMessage(repair: RepairDetail) {
  const lines = [
    `Repair Receipt: ${repair.repairNumber}`,
    `Party: ${repair.party.name}`,
    `Product: ${repair.product.code} - ${repair.product.name}`,
    `Qty: ${repair.quantity}`,
    `Condition: ${repair.productCondition}`,
    `Status: ${repair.currentStatus}`,
    `Received: ${formatDate(repair.receivedAt)}`,
  ];

  return lines.join("\n");
}

export function buildWhatsAppUrl(message: string) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function buildPdfBytes(repair: RepairDetail) {
  const text = [
    "Repair Receipt",
    repair.repairNumber,
    `Party: ${repair.party.name}`,
    `Product: ${repair.product.code} - ${repair.product.name}`,
    `Quantity: ${repair.quantity}`,
    `Condition: ${repair.productCondition}`,
    `Status: ${repair.currentStatus}`,
    `Received: ${formatDate(repair.receivedAt)}`,
  ].join(" | ");

  const safeText = text.replace(/[()\\]/g, "\\$&");
  const stream = `BT /F1 14 Tf 50 760 Td (${safeText}) Tj ET`;
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >> endobj",
    `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
  ];
  const body = objects.join("\n");
  return `%PDF-1.4\n${body}\ntrailer << /Root 1 0 R >>\n%%EOF`;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
