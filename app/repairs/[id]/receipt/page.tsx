import { notFound } from "next/navigation";
import { ReceiptSheet } from "@/components/ReceiptSheet";
import { PrintButton } from "@/components/PrintButton";
import { RepairBackButton } from "@/components/RepairBackButton";
import { formatDate } from "@/lib/dateTime";
import { buildReceiptRows } from "@/lib/receipt";
import { getRepair } from "@/lib/mongoStore";

type Params = { params: Promise<{ id: string }> };

export default async function ReceiptPage({ params }: Params) {
  const { id } = await params;
  const repair = await getRepair(id);
  if (!repair) notFound();

  const receiptRows = buildReceiptRows(repair);

  return (
    <>
      <div className="no-print receipt-toolbar-wrap">
        <div className="toolbar receipt-toolbar">
          <RepairBackButton />
          <div className="actions">
            <PrintButton href={`/repairs/${repair.id}/receipt/print`} />
            <a className="button secondary" href={`/api/repairs/${repair.id}/receipt/pdf`}>
              Download Receipt
            </a>
          </div>
        </div>
      </div>
      <main className="receipt-page">
        <ReceiptSheet partyName={repair.party.name} productDetails={repair.productDetails} createdDate={formatDate(repair.createdAt)} rows={receiptRows} />
      </main>
    </>
  );
}
