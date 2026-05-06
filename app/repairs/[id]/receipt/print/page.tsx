import { notFound } from "next/navigation";
import { AutoPrint } from "@/components/AutoPrint";
import { ReceiptSheet } from "@/components/ReceiptSheet";
import { buildReceiptRows, formatDate } from "@/lib/receipt";
import { getRepair } from "@/lib/mongoStore";

type Params = { params: Promise<{ id: string }> };

export default async function ReceiptPrintPage({ params }: Params) {
  const { id } = await params;
  const repair = await getRepair(id);
  if (!repair) notFound();

  const rows = buildReceiptRows(repair);
  const createdDate = formatDate(repair.createdAt);

  return (
    <main className="receipt-only-page">
      <AutoPrint />
      <section className="receipt-only-print-page">
        <ReceiptSheet partyName={repair.party.name} productDetails={repair.productDetails} createdDate={createdDate} rows={rows} />
        <div className="receipt-cutline">Cut Here</div>
        <ReceiptSheet partyName={repair.party.name} productDetails={repair.productDetails} createdDate={createdDate} rows={rows} />
      </section>
    </main>
  );
}
