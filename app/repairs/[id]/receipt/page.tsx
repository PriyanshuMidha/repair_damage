import { notFound } from "next/navigation";
import { NativeShareButton } from "@/components/NativeShareButton";
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
      <div className="mobile-only mobile-back-sticky receipt-mobile-toolbar no-print">
        <RepairBackButton />
      </div>
      <div className="no-print receipt-toolbar-wrap">
        <div className="toolbar receipt-toolbar">
          <div className="desktop-only">
            <RepairBackButton />
          </div>
          <div className="actions">
            <NativeShareButton
              label="Share Receipt"
              text={`Repair receipt for ${repair.party.name}\nReceipt: /repairs/${repair.id}/receipt\nPDF: /api/repairs/${repair.id}/receipt/pdf`}
              title={`Receipt ${repair.repairNumber}`}
              url={`/repairs/${repair.id}/receipt`}
            />
            <PrintButton label="Open Print Copy" href={`/repairs/${repair.id}/receipt/print`} />
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
