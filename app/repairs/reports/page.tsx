"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { RepairBackButton } from "@/components/RepairBackButton";
import { RepairHeroNav } from "@/components/RepairHeroNav";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/dateTime";
import { type ActionPayload, REPAIR_STATUSES, type RepairDetail, type RepairStatus } from "@/lib/types";
import { actionLabel, relevantPersonLabel, sortedActionsForUi } from "@/lib/workflow";

type ResponseShape = { repairs: RepairDetail[]; error?: string };

export default function RepairReportsPage() {
  const [repairs, setRepairs] = useState<RepairDetail[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [activeStatus, setActiveStatus] = useState<RepairStatus | null>(null);
  const [activeAction, setActiveAction] = useState<ActionPayload["action"] | null>(null);
  const [partySearch, setPartySearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sentToCustomerProofPhoto, setSentToCustomerProofPhoto] = useState<File | null>(null);
  const [form, setForm] = useState({
    sentToRepairBy: "",
    sentToRepairNote: "",
    receivedFromRepairBy: "",
    receivedFromRepairNote: "",
    sentToCustomerBy: "",
    sentToCustomerNote: "",
    sentToCustomerSendingMedium: "",
    grBy: "",
    grNote: "",
  });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    loadRepairs();
  }, []);

  function loadRepairs() {
    startTransition(async () => {
      setError("");
      const response = await fetch("/api/repairs", { cache: "no-store" });
      const data = (await response.json()) as ResponseShape;
      if (!response.ok) {
        setRepairs([]);
        setError(data.error ?? "Reports could not be loaded.");
        return;
      }
      setRepairs(data.repairs ?? []);
    });
  }

  const { countsByStatus, openCount } = useMemo(() => {
    const countsByStatus = Object.fromEntries(REPAIR_STATUSES.map((status) => [status, 0])) as Record<RepairStatus, number>;
    let openCount = 0;
    for (const repair of repairs) {
      countsByStatus[repair.status] = (countsByStatus[repair.status] ?? 0) + 1;
      if (repair.status !== "Sent to Customer" && repair.status !== "GR") openCount += 1;
    }
    return { countsByStatus, openCount };
  }, [repairs]);

  const filteredRepairs = useMemo(() => {
    if (!activeStatus) return [];
    const normalizedSearch = partySearch.trim().toLowerCase();
    return repairs.filter((repair) => {
      if (repair.status !== activeStatus) return false;
      if (!normalizedSearch) return true;
      return repair.party.name.toLowerCase().includes(normalizedSearch);
    });
  }, [activeStatus, partySearch, repairs]);

  useEffect(() => {
    const visibleIds = new Set(filteredRepairs.map((repair) => repair.id));
    setSelectedIds((current) => current.filter((id) => visibleIds.has(id)));
  }, [filteredRepairs]);

  const selectedRepairs = useMemo(
    () => filteredRepairs.filter((repair) => selectedIds.includes(repair.id)),
    [filteredRepairs, selectedIds],
  );
  const statusRepairs = useMemo(() => {
    if (!activeStatus) return [];
    return repairs.filter((repair) => repair.status === activeStatus);
  }, [activeStatus, repairs]);

  const availableActions = useMemo(() => (activeStatus ? sortedActionsForUi(actionsForStatus(activeStatus)) : []), [activeStatus]);
  const allVisibleSelected = filteredRepairs.length > 0 && filteredRepairs.every((repair) => selectedIds.includes(repair.id));
  const closedCount = repairs.length - openCount;

  function handleStatusClick(status: RepairStatus) {
    const nextActions = sortedActionsForUi(actionsForStatus(status));
    setActiveStatus(status);
    setActiveAction(nextActions[0] ?? null);
    setPartySearch("");
    setSelectedIds([]);
    resetForm();
    setMessage("");
    setError("");
  }

  function backToSummary() {
    setActiveStatus(null);
    setActiveAction(null);
    setPartySearch("");
    setSelectedIds([]);
    resetForm();
    setError("");
    setMessage("");
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(filteredRepairs.map((repair) => repair.id));
  }

  function submitBulkAction() {
    if (!activeAction || selectedIds.length === 0) return;

    setError("");
    setMessage("");

    startTransition(async () => {
      const results = await Promise.allSettled(
        selectedIds.map(async (id) => {
          let proofPhoto: { driveFileId?: string; url?: string; previewUrl?: string; fileName?: string } | undefined;
          if (activeAction === "send-to-customer" && sentToCustomerProofPhoto) {
            const photoData = new FormData();
            photoData.append("photo", sentToCustomerProofPhoto);
            photoData.append("kind", "proof");
            const photoResponse = await fetch(`/api/repairs/${id}/photos`, {
              method: "POST",
              body: photoData,
            });
            const photoBody = await photoResponse.json();
            if (!photoResponse.ok) {
              throw new Error(photoBody.error ?? `Proof photo upload failed for repair ${id}.`);
            }
            proofPhoto = {
              driveFileId: photoBody.photo?.driveFileId,
              url: photoBody.photo?.url,
              previewUrl: photoBody.photo?.previewUrl,
              fileName: photoBody.photo?.fileName,
            };
          }

          const payload = actionPayload(activeAction, form, proofPhoto);
          const response = await fetch(`/api/repairs/${id}/actions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, role: "staff" }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error ?? `Action failed for repair ${id}.`);
          return data.repair as RepairDetail;
        }),
      );

      const failures = results.filter((result) => result.status === "rejected");
      if (failures.length > 0) {
        setError(failures[0].reason instanceof Error ? failures[0].reason.message : "Some records could not be updated.");
      }

      const successCount = results.length - failures.length;
      if (successCount > 0) {
        setMessage(`${successCount} repair${successCount === 1 ? "" : "s"} updated successfully.`);
        setSelectedIds([]);
        resetForm();
      }

      loadRepairs();
    });
  }

  function resetForm() {
    setForm({
      sentToRepairBy: "",
      sentToRepairNote: "",
      receivedFromRepairBy: "",
      receivedFromRepairNote: "",
      sentToCustomerBy: "",
      sentToCustomerNote: "",
      sentToCustomerSendingMedium: "",
      grBy: "",
      grNote: "",
    });
    setSentToCustomerProofPhoto(null);
  }

  return (
    <main className="shell">
      <div className="mobile-only mobile-back-sticky">
        <RepairBackButton />
      </div>
      <section className="hero">
        <div>
          <div className="eyebrow">Repair Control Room</div>
          <h1>Reports &amp; workflow.</h1>
          <p className="hero-lede">Track status counts, drill into one stage, multi-select records, and move workflow only from this screen.</p>
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
                Export active CSV
              </a>
            </div>
          </div>
        </div>

        {error ? <div className="notice">{error}</div> : null}
        {message ? <div className="notice">{message}</div> : null}

        {!activeStatus ? (
          <>
            <div className="grid two">
              <div className="metric-panel">
                <div className="metric-label">Total active repairs</div>
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
                <button key={status} className="status-report-row status-report-button" type="button" onClick={() => handleStatusClick(status)}>
                  <StatusBadge status={status} />
                  <strong>{countsByStatus[status] ?? 0}</strong>
                </button>
              ))}
            </div>
          </>
        ) : (
          <section className="report-subview">
            <div className="toolbar report-subview-header">
              <button className="button secondary report-back-button" type="button" onClick={backToSummary}>
                Back
              </button>
              <div className="report-subview-heading">
                <h3 className="report-drilldown-title">{activeStatus} Records</h3>
                <div className="timeline-meta">{filteredRepairs.length} visible of {statusRepairs.length}</div>
              </div>
              {filteredRepairs.length > 0 ? (
                <button className="button secondary" type="button" onClick={toggleSelectAll}>
                  {allVisibleSelected ? "Clear All" : "Select All"}
                </button>
              ) : (
                <div />
              )}
            </div>

            <label className="field">
              <span>Search by Party Name</span>
              <input
                className="input"
                value={partySearch}
                placeholder="Type party name"
                onChange={(event) => setPartySearch(event.target.value)}
              />
            </label>

            {filteredRepairs.length === 0 ? (
              <div className="notice">
                {partySearch.trim() ? "No records match this party name in the selected status." : "No repairs are currently in this status."}
              </div>
            ) : null}

            {filteredRepairs.length > 0 ? (
              <div className="report-record-list">
                {filteredRepairs.map((repair) => {
                  const person = relevantPersonLabel(repair);
                  const checked = selectedIds.includes(repair.id);
                  return (
                    <label className={`report-record${checked ? " report-record-selected" : ""}`} key={repair.id}>
                      <div className="report-record-checkbox">
                        <input type="checkbox" checked={checked} onChange={() => toggleSelection(repair.id)} />
                      </div>
                      <div className="report-record-body">
                        <div className="toolbar">
                          <div className="record-heading-block">
                            <div className="record-title">{repair.party.name}</div>
                            <div className="record-subtitle">Repair ID: {repair.repairNumber}</div>
                          </div>
                          <StatusBadge status={repair.status} />
                        </div>
                        <div className="report-record-grid">
                          <div className="timeline-meta">
                            <strong>Staff:</strong> {person.value}
                          </div>
                          <div className="timeline-meta">
                            <strong>Product Code:</strong> {repair.product.name || repair.productDetails}
                          </div>
                          {repair.productColor ? (
                            <div className="timeline-meta">
                              <strong>Color:</strong> {repair.productColor}
                            </div>
                          ) : null}
                          <div className="timeline-meta">
                            <strong>Remark:</strong> {repair.initialRemark}
                          </div>
                          <div className="timeline-meta">
                            <strong>Date:</strong> {formatDate(repair.createdAt)}
                          </div>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            ) : null}

            {availableActions.length > 0 ? (
              <div className="card grid report-action-panel">
                <div className="toolbar">
                  <h3>{activeAction ? actionLabel(activeAction) : "Choose Action"}</h3>
                  <div className="timeline-meta">{selectedRepairs.length} selected</div>
                </div>
                {availableActions.length > 1 ? (
                  <div className="actions">
                    {availableActions.map((action) => (
                      <button
                        key={action}
                        className={`button${activeAction === action ? "" : " secondary"}`}
                        type="button"
                        onClick={() => {
                          setActiveAction(action);
                          setError("");
                          setMessage("");
                        }}
                      >
                        {actionLabel(action)}
                      </button>
                    ))}
                  </div>
                ) : null}
                {activeAction ? renderActionFields(activeAction, form, setForm) : null}
                {activeAction === "send-to-customer" ? (
                  <>
                    <Input
                      label="Medium of Sending"
                      value={form.sentToCustomerSendingMedium}
                      onChange={(value) => setForm((current) => ({ ...current, sentToCustomerSendingMedium: value }))}
                    />
                    <label className="field">
                      <span>Upload Bill / Proof Photo</span>
                      <input
                        className="input"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={(event) => setSentToCustomerProofPhoto(event.target.files?.[0] ?? null)}
                      />
                    </label>
                    {sentToCustomerProofPhoto ? <div className="notice">Selected file: {sentToCustomerProofPhoto.name}</div> : null}
                  </>
                ) : null}
                <div className="actions">
                  <button className="button" type="button" disabled={isPending || selectedIds.length === 0 || !activeAction} onClick={submitBulkAction}>
                    {isPending ? "Updating..." : activeAction ? actionLabel(activeAction) : "Choose Action"}
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => {
                      setSelectedIds([]);
                      resetForm();
                    }}
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            ) : activeStatus === "Sent to Customer" || activeStatus === "GR" ? (
              <div className="notice">Records in {activeStatus} have no further workflow action in the current flow.</div>
            ) : null}
          </section>
        )}
      </section>
    </main>
  );
}

function actionsForStatus(status: RepairStatus): ActionPayload["action"][] {
  if (status === "Received") return ["send-to-repair"];
  if (status === "Repair In Progress") return ["receive-from-repair"];
  if (status === "Repair Received") return ["send-to-customer", "mark-as-gr"];
  return [];
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input className="input" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea className="input" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function renderActionFields(
  action: ActionPayload["action"],
  form: {
    sentToRepairBy: string;
    sentToRepairNote: string;
    receivedFromRepairBy: string;
    receivedFromRepairNote: string;
    sentToCustomerBy: string;
    sentToCustomerNote: string;
    sentToCustomerSendingMedium: string;
    grBy: string;
    grNote: string;
  },
  setForm: React.Dispatch<
    React.SetStateAction<{
      sentToRepairBy: string;
      sentToRepairNote: string;
      receivedFromRepairBy: string;
      receivedFromRepairNote: string;
      sentToCustomerBy: string;
      sentToCustomerNote: string;
      sentToCustomerSendingMedium: string;
      grBy: string;
      grNote: string;
    }>
  >,
) {
  if (action === "send-to-repair") {
    return (
      <>
        <Input label="Sent to repair by" value={form.sentToRepairBy} onChange={(value) => setForm((current) => ({ ...current, sentToRepairBy: value }))} />
        <TextArea label="Note" value={form.sentToRepairNote} onChange={(value) => setForm((current) => ({ ...current, sentToRepairNote: value }))} />
      </>
    );
  }

  if (action === "receive-from-repair") {
    return (
      <>
        <Input
          label="Received from repair by"
          value={form.receivedFromRepairBy}
          onChange={(value) => setForm((current) => ({ ...current, receivedFromRepairBy: value }))}
        />
        <TextArea
          label="Note"
          value={form.receivedFromRepairNote}
          onChange={(value) => setForm((current) => ({ ...current, receivedFromRepairNote: value }))}
        />
      </>
    );
  }

  if (action === "mark-as-gr") {
    return (
      <>
        <Input label="Marked as GR by" value={form.grBy} onChange={(value) => setForm((current) => ({ ...current, grBy: value }))} />
        <TextArea label="Note" value={form.grNote} onChange={(value) => setForm((current) => ({ ...current, grNote: value }))} />
      </>
    );
  }

  return (
    <>
      <Input label="Sent to customer by" value={form.sentToCustomerBy} onChange={(value) => setForm((current) => ({ ...current, sentToCustomerBy: value }))} />
      <TextArea label="Note" value={form.sentToCustomerNote} onChange={(value) => setForm((current) => ({ ...current, sentToCustomerNote: value }))} />
    </>
  );
}

function actionPayload(
  action: ActionPayload["action"],
  form: {
    sentToRepairBy: string;
    sentToRepairNote: string;
    receivedFromRepairBy: string;
    receivedFromRepairNote: string;
    sentToCustomerBy: string;
    sentToCustomerNote: string;
    sentToCustomerSendingMedium: string;
    grBy: string;
    grNote: string;
  },
  proofPhoto?: { driveFileId?: string; url?: string; previewUrl?: string; fileName?: string },
): ActionPayload {
  if (action === "send-to-repair") {
    return { action, sentToRepairBy: form.sentToRepairBy, sentToRepairNote: form.sentToRepairNote };
  }
  if (action === "receive-from-repair") {
    return { action, receivedFromRepairBy: form.receivedFromRepairBy, receivedFromRepairNote: form.receivedFromRepairNote };
  }
  if (action === "mark-as-gr") {
    return { action, grBy: form.grBy, grNote: form.grNote };
  }
  return {
    action,
    sentToCustomerBy: form.sentToCustomerBy,
    sentToCustomerNote: form.sentToCustomerNote,
    sentToCustomerSendingMedium: form.sentToCustomerSendingMedium,
    sentToCustomerProofPhotoDriveId: proofPhoto?.driveFileId,
    sentToCustomerProofPhotoUrl: proofPhoto?.url,
    sentToCustomerProofPhotoPreviewUrl: proofPhoto?.previewUrl,
    sentToCustomerProofPhotoFileName: proofPhoto?.fileName,
  };
}
