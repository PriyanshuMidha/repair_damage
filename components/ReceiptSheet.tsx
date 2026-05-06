export function ReceiptSheet({
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
    <section className="receipt">
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
