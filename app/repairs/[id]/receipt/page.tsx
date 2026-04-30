import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { StatusBadge } from "@/components/StatusBadge";
import { buildWhatsAppMessage, buildWhatsAppUrl, formatDate } from "@/lib/receipt";
import { getRepair } from "@/lib/mongoStore";

type Params = { params: Promise<{ id: string }> };

export default async function ReceiptPage({ params }: Params) {
  const { id } = await params;
  const repair = await getRepair(id);
  if (!repair) notFound();

  const message = buildWhatsAppMessage(repair);

  return (
    <>
      <div className="shell no-print">
        <div className="toolbar">
          <Link className="button secondary" href={`/repairs/${repair.id}`}>
            Back to Repair
          </Link>
          <div className="actions">
            <PrintButton />
            <a className="button secondary" href={`/api/repairs/${repair.id}/receipt/pdf`}>
              Download PDF
            </a>
            <a className="button secondary" href={buildWhatsAppUrl(message)} target="_blank" rel="noreferrer">
              Share WhatsApp
            </a>
          </div>
        </div>
      </div>
      <main className="receipt">
        <div className="eyebrow">Damaged Goods Repair Receipt</div>
        <h1>{repair.repairNumber}</h1>
        <p>
          Received on {formatDate(repair.receivedAt)} by {repair.receiverStaffName}. This receipt confirms goods were received for repair assessment.
        </p>

        <table>
          <tbody>
            <tr>
              <th>Status</th>
              <td>
                <StatusBadge status={repair.currentStatus} />
              </td>
            </tr>
            <tr>
              <th>Party</th>
              <td>
                {repair.party.name} · {repair.party.phone}
              </td>
            </tr>
            <tr>
              <th>Product</th>
              <td>
                {repair.product.code} - {repair.product.name} ({repair.product.color})
              </td>
            </tr>
            <tr>
              <th>Quantity</th>
              <td>{repair.quantity}</td>
            </tr>
            <tr>
              <th>Billing</th>
              <td>{repair.isBilled ? `Yes - ${repair.billOrGrReference}` : "No"}</td>
            </tr>
            <tr>
              <th>Condition</th>
              <td>{repair.productCondition}</td>
            </tr>
            <tr>
              <th>Damage</th>
              <td>
                {repair.damageCategory}
                <br />
                {repair.damageRemarks}
              </td>
            </tr>
            <tr>
              <th>Photos</th>
              <td>{repair.photos.length ? `${repair.photos.length} attached` : "No photo attached at receipt time"}</td>
            </tr>
          </tbody>
        </table>

        <p>Customer/party acknowledgement: ________________________________</p>
      </main>
    </>
  );
}
