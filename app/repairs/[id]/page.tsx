"use client";

import Link from "next/link";
import { use, useEffect, useState, useTransition } from "react";
import { RepairBackButton } from "@/components/RepairBackButton";
import { StatusBadge } from "@/components/StatusBadge";
import { actionLabel, allowedActions, relevantPersonLabel, sortedActionsForUi } from "@/lib/workflow";
import { type ActionPayload, type RepairDetail } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

const STAFF_ROLE = "staff" as const;

export default function RepairDetailPage({ params }: Params) {
  const { id } = use(params);
  const [repair, setRepair] = useState<RepairDetail | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; fileName: string } | null>(null);
  const [action, setAction] = useState<ActionPayload["action"] | "">("");
  const [form, setForm] = useState({
    sentToRepairBy: "",
    sentToRepairNote: "",
    receivedFromRepairBy: "",
    receivedFromRepairNote: "",
    sentToCustomerBy: "",
    sentToCustomerNote: "",
  });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    load(id);
  }, [id]);

  function load(repairId = id) {
    startTransition(async () => {
      const response = await fetch(`/api/repairs/${repairId}`, { cache: "no-store" });
      const data = await response.json();
      if (response.ok) {
        setRepair(data.repair);
        setError("");
      } else {
        setError(data.error ?? "Could not load repair.");
      }
    });
  }

  function runAction(selectedAction = action) {
    if (!selectedAction) return;
    setError("");
    setMessage("");
    startTransition(async () => {
      const payload = actionPayload(selectedAction, form);
      const response = await fetch(`/api/repairs/${id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, role: STAFF_ROLE }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Action failed.");
        return;
      }
      setRepair(data.repair);
      setAction("");
      setForm({
        sentToRepairBy: "",
        sentToRepairNote: "",
        receivedFromRepairBy: "",
        receivedFromRepairNote: "",
        sentToCustomerBy: "",
        sentToCustomerNote: "",
      });
      setMessage("Repair updated successfully.");
    });
  }

  function uploadPhoto() {
    setError("");
    if (!photoFile) {
      setError("Choose a photo file first.");
      return;
    }
    startTransition(async () => {
      const photoData = new FormData();
      photoData.append("photo", photoFile);
      const response = await fetch(`/api/repairs/${id}/photos`, {
        method: "POST",
        body: photoData,
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Photo upload failed.");
        return;
      }
      setPhotoFile(null);
      load();
    });
  }

  if (!repair) {
    return (
      <main className="shell">
        <div className="card">{error || "Loading repair..."}</div>
      </main>
    );
  }

  const actions = sortedActionsForUi(allowedActions(repair, STAFF_ROLE));
  const person = relevantPersonLabel(repair);

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <div className="eyebrow">Repair Preview</div>
          <h1>{repair.party.name}</h1>
          <p>
            {repair.repairNumber} · {repair.productDetails}
          </p>
        </div>
        <div className="actions">
          <RepairBackButton />
          {repair.status === "Received" ? (
            <Link className="button" href={`/repairs/${repair.id}/edit`}>
              Edit
            </Link>
          ) : null}
          <Link className="button secondary" href={`/repairs/${repair.id}/receipt`}>
            Receipt
          </Link>
        </div>
      </section>

      {previewPhoto ? (
        <div className="photo-preview" role="dialog" aria-modal="true" aria-label="Photo preview">
          <button className="button secondary photo-preview-back" type="button" onClick={() => setPreviewPhoto(null)}>
            Back
          </button>
          <img src={previewPhoto.url} alt={previewPhoto.fileName} />
        </div>
      ) : null}

      <div className="grid two">
        <section className="card grid">
          <div className="toolbar">
            <h2>Current State</h2>
            <StatusBadge status={repair.status} />
          </div>
          <table>
            <tbody>
              <Row label="Party" value={repair.party.name} />
              <Row label="Product details" value={repair.productDetails} />
              {repair.productColor ? <Row label="Product color" value={repair.productColor} /> : null}
              <Row label={person.label} value={person.value} />
              <Row label="Selling price" value={String(repair.sellingPrice)} />
              <Row label="Remark" value={repair.initialRemark} />
              <Row label="Created date" value={new Date(repair.createdAt).toLocaleString()} />
            </tbody>
          </table>

          <div className="actions">
            {actions.length === 0 ? <div className="notice">No more actions are available for this repair.</div> : null}
            {actions.map((availableAction) => (
              <button className="button" key={availableAction} type="button" onClick={() => setAction(availableAction)}>
                {actionLabel(availableAction)}
              </button>
            ))}
          </div>

          {action ? (
            <div className="card grid">
              <h3>{actionLabel(action)}</h3>
              {renderActionFields(action, form, setForm)}
              <div className="actions">
                <button className="button" disabled={isPending || !actions.includes(action)} onClick={() => runAction()} type="button">
                  Confirm
                </button>
                <button className="button secondary" onClick={() => setAction("")} type="button">
                  Close
                </button>
              </div>
              {!actions.includes(action) ? <div className="notice">This action is not allowed from the current status.</div> : null}
            </div>
          ) : null}

          {error ? <div className="notice">{error}</div> : null}
          {message ? <div className="notice">{message}</div> : null}
        </section>

        <section className="card grid">
          <h2>Photos</h2>
          {repair.photos.length === 0 ? <div className="notice">No photo attached yet.</div> : null}
          {repair.photos.map((item) => (
            <div className="notice" key={item.id}>
              <strong>{item.fileName}</strong>
              <br />
              <button className="photo-thumb" type="button" onClick={() => setPreviewPhoto({ url: item.url, fileName: item.fileName })}>
                <img src={item.url} alt={item.fileName} />
              </button>
            </div>
          ))}
          <div className="grid">
            <label className="field">
              <span>Upload Photo</span>
              <input className="input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)} />
            </label>
            {photoFile ? <div className="notice">Selected photo: {photoFile.name}</div> : null}
            <button className="button secondary" onClick={uploadPhoto} disabled={isPending} type="button">
              Upload Photo
            </button>
          </div>
        </section>
      </div>

      <section className="card grid" style={{ marginTop: 16 }}>
        <h2>Audit Timeline</h2>
        <div className="timeline">
          {repair.auditTimeline.map((item) => (
            <div className="timeline-item" key={item.id}>
              <div className="timeline-card">
                <strong>{timelineActionLabel(item.action)}</strong>
                <div className="timeline-meta">
                  {item.previousStatus ?? "New"} to {item.newStatus}
                </div>
                <div className="timeline-meta">
                  {item.roleLabel}: {item.personName}
                </div>
                <div className="timeline-meta">{new Date(item.createdAt).toLocaleString()}</div>
                {item.note ? <p className="timeline-note">{item.note}</p> : null}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <th>{label}</th>
      <td>{value}</td>
    </tr>
  );
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
  },
  setForm: React.Dispatch<
    React.SetStateAction<{
      sentToRepairBy: string;
      sentToRepairNote: string;
      receivedFromRepairBy: string;
      receivedFromRepairNote: string;
      sentToCustomerBy: string;
      sentToCustomerNote: string;
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
  },
): ActionPayload {
  if (action === "send-to-repair") {
    return { action, sentToRepairBy: form.sentToRepairBy, sentToRepairNote: form.sentToRepairNote };
  }
  if (action === "receive-from-repair") {
    return { action, receivedFromRepairBy: form.receivedFromRepairBy, receivedFromRepairNote: form.receivedFromRepairNote };
  }
  return { action, sentToCustomerBy: form.sentToCustomerBy, sentToCustomerNote: form.sentToCustomerNote };
}

function timelineActionLabel(action: string) {
  switch (action) {
    case "CREATE":
      return "Created / Received from customer";
    case "SEND_TO_REPAIR":
      return "Sent to Repair";
    case "RECEIVE_FROM_REPAIR":
      return "Received from Repair";
    case "SEND_TO_CUSTOMER":
      return "Sent to Customer";
    case "UPDATE":
      return "Repair Updated";
    default:
      return action;
  }
}
