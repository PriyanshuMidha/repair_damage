"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { REPAIR_STATUSES, type RepairDetail } from "@/lib/types";

type ResponseShape = { repairs: RepairDetail[] };

export default function RepairsPage() {
  const [repairs, setRepairs] = useState<RepairDetail[]>([]);
  const [filters, setFilters] = useState({ status: "", party: "", productCode: "", staff: "", repairNumber: "", from: "", to: "" });
  const [isPending, startTransition] = useTransition();

  function load() {
    const search = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    startTransition(async () => {
      const response = await fetch(`/api/repairs?${search.toString()}`, { cache: "no-store" });
      const data = (await response.json()) as ResponseShape;
      setRepairs(data.repairs);
    });
  }

  useEffect(() => {
    load();
  }, []);

  const exportUrl = `/api/repairs/export?${new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString()}`;

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <div className="eyebrow">Repair Control Room</div>
          <h1>Damaged goods, tracked cleanly.</h1>
          <p>Receive, dispatch, inspect, return, and audit every repair without letting edge cases slip into the fog.</p>
        </div>
        <Link className="button" href="/repairs/new">
          New Repair
        </Link>
      </section>

      <section className="card grid">
        <div className="toolbar">
          <h2>Repair List</h2>
          <div className="actions">
            <button className="button secondary" onClick={load} disabled={isPending}>
              {isPending ? "Filtering..." : "Apply Filters"}
            </button>
            <a className="button secondary" href={exportUrl}>
              Export CSV
            </a>
          </div>
        </div>

        <div className="grid three">
          <Field label="Repair Number" value={filters.repairNumber} onChange={(value) => setFilters({ ...filters, repairNumber: value })} />
          <label className="field">
            <span>Status</span>
            <select className="input" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
              <option value="">All statuses</option>
              {REPAIR_STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <Field label="Party" value={filters.party} onChange={(value) => setFilters({ ...filters, party: value })} />
          <Field label="Product Code" value={filters.productCode} onChange={(value) => setFilters({ ...filters, productCode: value })} />
          <Field label="Staff" value={filters.staff} onChange={(value) => setFilters({ ...filters, staff: value })} />
          <Field label="From" type="date" value={filters.from} onChange={(value) => setFilters({ ...filters, from: value })} />
          <Field label="To" type="date" value={filters.to} onChange={(value) => setFilters({ ...filters, to: value })} />
        </div>

        {repairs.length === 0 ? (
          <div className="notice">No repairs yet. Create the first receipt and the list will wake up.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Repair</th>
                  <th>Status</th>
                  <th>Party</th>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Received</th>
                  <th>Staff</th>
                </tr>
              </thead>
              <tbody>
                {repairs.map((repair) => (
                  <tr key={repair.id}>
                    <td>
                      <Link href={`/repairs/${repair.id}`}>
                        <strong>{repair.repairNumber}</strong>
                      </Link>
                    </td>
                    <td>
                      <StatusBadge status={repair.currentStatus} />
                    </td>
                    <td>{repair.party.name}</td>
                    <td>
                      {repair.product.code}
                      <br />
                      <small>{repair.product.name}</small>
                    </td>
                    <td>{repair.quantity}</td>
                    <td>{new Date(repair.receivedAt).toLocaleString()}</td>
                    <td>{repair.receiverStaffName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input className="input" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
