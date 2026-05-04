import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { RepairBackButton } from "@/components/RepairBackButton";
import { formatDate, formatMoney } from "@/lib/receipt";
import { getRepair } from "@/lib/mongoStore";
import { relevantPersonLabel } from "@/lib/workflow";

type Params = { params: Promise<{ id: string }> };

export default async function ReceiptPage({ params }: Params) {
  const { id } = await params;
  const repair = await getRepair(id);
  if (!repair) notFound();

  const person = relevantPersonLabel(repair);
  const receiptRows = [
    { label: "Date ID", value: repair.repairDateId },
    { label: "Product Details", value: repair.productDetails },
    ...(repair.productColor ? [{ label: "Color", value: repair.productColor }] : []),
    { label: person.label, value: person.value },
    { label: "Selling Price", value: formatMoney(repair.sellingPrice) },
    { label: "Created Date", value: formatDate(repair.createdAt) },
  ];

  return (
    <>
      <div className="no-print receipt-toolbar-wrap">
        <div className="toolbar receipt-toolbar">
          <RepairBackButton />
          <div className="actions">
            <PrintButton />
            <a className="button secondary" href={`/api/repairs/${repair.id}/receipt/pdf`}>
              Download Receipt
            </a>
          </div>
        </div>
      </div>
      <main className="receipt-page">
        <ReceiptSheet partyName={repair.party.name} productDetails={repair.productDetails} createdDate={formatDate(repair.createdAt)} rows={receiptRows} />
        <section className="receipt-print-sheet print-only">
          <ReceiptSheet partyName={repair.party.name} productDetails={repair.productDetails} createdDate={formatDate(repair.createdAt)} rows={receiptRows} />
          <div className="receipt-cutline">Cut Here</div>
          <ReceiptSheet partyName={repair.party.name} productDetails={repair.productDetails} createdDate={formatDate(repair.createdAt)} rows={receiptRows} />
        </section>
      </main>
    </>
  );
}

function ReceiptSheet({
  partyName,
  productDetails,
  createdDate,
  rows,
}: {
  partyName: string;
  productDetails: string;
  createdDate: string;
  rows: Array<{ label: string; value: string }>;
}) {
  return (
    <section className="receipt screen-only-print-copy">
      <div className="receipt-topline">
        <span className="eyebrow">Repair Receipt</span>
        <span>{createdDate}</span>
      </div>
      <div className="receipt-heading">
        <div>
          <h1>{partyName}</h1>
          <p className="receipt-summary">{productDetails}</p>
        </div>
      </div>

      <table className="receipt-kv">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th>{row.label}</th>
              <td>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
