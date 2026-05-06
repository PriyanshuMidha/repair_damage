"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { RepairBackButton } from "@/components/RepairBackButton";
import { RepairHeroNav } from "@/components/RepairHeroNav";
import { StatusBadge } from "@/components/StatusBadge";
import { relevantPersonLabel } from "@/lib/workflow";
import { type RepairDetail } from "@/lib/types";

type ResponseShape = { repairs?: RepairDetail[]; error?: string };

export default function RepairsPage() {
  const [repairs, setRepairs] = useState<RepairDetail[]>([]);
  const [error, setError] = useState("");
  const [showDeleteNotice, setShowDeleteNotice] = useState(false);
  const [filters, setFilters] = useState({
    party: "",
    person: "",
  });
  const [isPending, startTransition] = useTransition();

  function load(nextFilters = filters) {
    const search = new URLSearchParams(Object.entries(nextFilters).filter(([, value]) => value));
    startTransition(async () => {
      setError("");
      const response = await fetch(`/api/repairs?${search.toString()}`, { cache: "no-store" });
      const data = (await response.json()) as ResponseShape;
      if (!response.ok) {
        setRepairs([]);
        setError(data.error ?? "Could not load repairs.");
        return;
      }
      setRepairs(data.repairs ?? []);
    });
  }

  useEffect(() => {
    load();
    if (typeof window !== "undefined") {
      const search = new URLSearchParams(window.location.search);
      setShowDeleteNotice(search.get("deleted") === "1");
    }
  }, []);

  const exportUrl = `/api/repairs/export?${new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString()}`;

  function reset() {
    const clean = { party: "", person: "" };
    setFilters(clean);
    load(clean);
  }

  return (
    <main className="shell">
      <div className="mobile-only mobile-back-sticky">
        <RepairBackButton />
      </div>
      <section className="hero">
        <div>
          <div className="eyebrow">Repair Control Room</div>
          <h1>Repairs in one clear flow.</h1>
          <p className="hero-lede">Track intake, repair movement, return, and receipt details without losing who handled each step.</p>
        </div>
        <div className="hero-actions">
          <div className="desktop-only">
            <RepairBackButton />
          </div>
          <RepairHeroNav active="list" />
        </div>
      </section>

      <section className="card grid">
        <div className="toolbar">
          <h2>Repair List</h2>
          <div className="actions">
            <button className="button" onClick={() => load()} disabled={isPending} type="button">
              {isPending ? "Searching..." : "Search"}
            </button>
            <div className="desktop-only">
              <button className="button secondary" onClick={reset} disabled={isPending} type="button">
                Reset
              </button>
              <a className="button secondary" href={exportUrl}>
                Export CSV
              </a>
            </div>
          </div>
        </div>

        <div className="grid two search-grid">
          <Field label="Party Name" value={filters.party} onChange={(value) => setFilters({ ...filters, party: value })} />
          <Field label="Search by person name" value={filters.person} onChange={(value) => setFilters({ ...filters, person: value })} />
        </div>

        {showDeleteNotice ? <div className="notice">Repair entry deleted successfully.</div> : null}

        {error ? <div className="notice">{error}</div> : null}

        {repairs.length === 0 ? (
          <div className="notice">No repairs found.</div>
        ) : (
          <>
            <div className="repair-card-list">
              {repairs.map((repair) => {
                const person = relevantPersonLabel(repair);
                return (
                  <article className="repair-card" key={repair.id}>
                    <div className="toolbar">
                      <Link href={`/repairs/${repair.id}`}>
                        <strong>Open Preview</strong>
                      </Link>
                      <StatusBadge status={repair.status} />
                    </div>
                    <div className="record-heading-block">
                      <div className="record-title">{repair.party.name}</div>
                      <div className="record-subtitle">Repair ID: {repair.repairNumber}</div>
                    </div>
                    <div>
                      {repair.productDetails}
                      <br />
                      {person.label}: {person.value}
                    </div>
                    <small>{new Date(repair.createdAt).toLocaleString()}</small>
                    <div className="actions">
                      <Link className="button" href={`/repairs/${repair.id}`}>
                        Preview
                      </Link>
                      <Link className="button secondary" href={`/repairs/${repair.id}/receipt`}>
                        Receipt
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="table-wrap repair-table">
              <table>
                <thead>
                  <tr>
                    <th>Preview</th>
                    <th>Status</th>
                    <th>Party</th>
                    <th>Product</th>
                    <th>Price</th>
                    <th>Created</th>
                    <th>Person</th>
                  </tr>
                </thead>
                <tbody>
                  {repairs.map((repair) => {
                    const person = relevantPersonLabel(repair);
                    return (
                      <tr key={repair.id}>
                        <td>
                          <Link className="button secondary" href={`/repairs/${repair.id}`}>
                            Preview
                          </Link>
                        </td>
                        <td>
                          <StatusBadge status={repair.status} />
                        </td>
                        <td>
                          <div className="record-heading-block">
                            <div className="record-title record-title-table">{repair.party.name}</div>
                            <div className="record-subtitle">Repair ID: {repair.repairNumber}</div>
                          </div>
                        </td>
                        <td>{repair.productDetails}</td>
                        <td>{repair.sellingPrice}</td>
                        <td>{new Date(repair.createdAt).toLocaleString()}</td>
                        <td>{person.value}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
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
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input className="input" type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
