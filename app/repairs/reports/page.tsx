"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RepairBackButton } from "@/components/RepairBackButton";
import { RepairHeroNav } from "@/components/RepairHeroNav";
import { StatusBadge } from "@/components/StatusBadge";
import { REPAIR_STATUSES, type RepairDetail } from "@/lib/types";

type ResponseShape = { repairs: RepairDetail[] };

export default function RepairReportsPage() {
  const [repairs, setRepairs] = useState<RepairDetail[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/repairs", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Could not load repairs.");
        return response.json();
      })
      .then((data: ResponseShape) => setRepairs(data.repairs))
      .catch(() => setError("Reports could not be loaded."));
  }, []);

  const { countsByStatus, openCount } = useMemo(() => {
    const countsByStatus = Object.fromEntries(REPAIR_STATUSES.map((status) => [status, 0])) as Record<string, number>;
    let openCount = 0;
    for (const r of repairs) {
      countsByStatus[r.status] = (countsByStatus[r.status] ?? 0) + 1;
      if (r.status !== "Sent to Customer") openCount++;
    }
    return { countsByStatus, openCount };
  }, [repairs]);

  const closedCount = repairs.length - openCount;

  return (
    <main className="shell">
      <div className="mobile-only mobile-back-sticky">
        <RepairBackButton />
      </div>
      <section className="hero">
        <div>
          <div className="eyebrow">Repair Control Room</div>
          <h1>Reports &amp; snapshot.</h1>
          <p className="hero-lede">
            High-level counts by status based on every repair currently in the system (same dataset as the repair list).
          </p>
        </div>
        <div className="hero-actions">
          <div className="desktop-only">
            <RepairBackButton />
          </div>
          <RepairHeroNav active="reports" />
        </div>
      </section>

      <section className="card grid">
        <div className="toolbar">
          <h2>Operations reports</h2>
          <div className="actions">
            <Link className="button secondary" href="/repairs">
              Open repair list
            </Link>
            <div className="desktop-only">
              <a className="button secondary" href="/api/repairs/export">
                Export full CSV
              </a>
            </div>
          </div>
        </div>

        {error ? (
          <div className="notice">{error}</div>
        ) : (
          <>
            <div className="grid two">
              <div className="metric-panel">
                <div className="metric-label">Total repairs</div>
                <div className="metric-value">{repairs.length}</div>
              </div>
              <div className="metric-panel">
                <div className="metric-label">Open vs closed</div>
                <div className="metric-value">
                  {openCount} open · {closedCount} closed
                </div>
              </div>
            </div>

            <h3 className="reports-section-title">Count by status</h3>
            <div className="grid two">
              {REPAIR_STATUSES.map((status) => (
                <div key={status} className="status-report-row">
                  <StatusBadge status={status} />
                  <strong>{countsByStatus[status] ?? 0}</strong>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
