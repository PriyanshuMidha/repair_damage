"use client";

import Link from "next/link";
import { use, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RepairBackButton } from "@/components/RepairBackButton";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/dateTime";
import { isPreviewablePhoto } from "@/lib/drive";
import { relevantPersonLabel } from "@/lib/workflow";
import { type RepairDetail } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export default function RepairDetailPage({ params }: Params) {
  const { id } = use(params);
  const router = useRouter();
  const [repair, setRepair] = useState<RepairDetail | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; fileName: string } | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
        return;
      }
      setRepair(null);
      setError(data.error ?? "Could not load repair.");
    });
  }

  function confirmDelete() {
    setError("");
    setMessage("");
    startTransition(async () => {
      const response = await fetch(`/api/repairs/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteReason }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not delete repair.");
        return;
      }
      setMessage("Repair deleted successfully.");
      router.push("/repairs?deleted=1");
    });
  }

  if (!repair) {
    return (
      <main className="shell">
        <div className="card">{error || "Loading repair..."}</div>
      </main>
    );
  }

  const person = relevantPersonLabel(repair);
  const canEdit = repair.status === "Received";

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
          {canEdit ? (
            <Link className="button" href={`/repairs/${repair.id}/edit`}>
              Edit
            </Link>
          ) : null}
          <Link className="button secondary" href={`/repairs/${repair.id}/receipt`}>
            Receipt
          </Link>
          <button className="button danger" type="button" onClick={() => setShowDeleteConfirm(true)}>
            Delete
          </button>
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

      {showDeleteConfirm ? (
        <div className="overlay-dialog" role="dialog" aria-modal="true" aria-label="Delete repair confirmation">
          <div className="overlay-card">
            <h2>Delete repair entry?</h2>
            <p style={{ margin: 0 }}>Are you sure you want to delete this receipt/repair entry? This action cannot be undone.</p>
            <table>
              <tbody>
                <Row label="Repair ID" value={repair.repairNumber} />
                <Row label="Party" value={repair.party.name} />
                <Row label="Product Code" value={repair.product.name || repair.productDetails} />
              </tbody>
            </table>
            <label className="field">
              <span>Delete Reason (optional)</span>
              <textarea className="input" value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} />
            </label>
            <div className="actions">
              <button className="button secondary" type="button" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button className="button danger" type="button" disabled={isPending} onClick={confirmDelete}>
                {isPending ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid two">
        <section className="card grid">
          <div className="toolbar">
            <h2>Repair Details</h2>
            <StatusBadge status={repair.status} />
          </div>
          <table>
            <tbody>
              <Row label="Repair ID" value={repair.repairNumber} />
              <Row label="Party Name" value={repair.party.name} />
              <Row label="Staff Name" value={person.value} />
              <Row label="Product Code" value={repair.product.name || repair.productDetails} />
              <Row label="Product Code" value={repair.productDetails} />
              {repair.productColor ? <Row label="Product Color" value={repair.productColor} /> : null}
              <Row label="Selling Price" value={String(repair.sellingPrice)} />
              <Row label="Remark" value={repair.initialRemark} />
              <Row label="Current Status" value={repair.status} />
              <Row label="Created Date" value={formatDateTime(repair.createdAt)} />
            </tbody>
          </table>

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
              {isPreviewablePhoto(item) ? (
                <button
                  className="photo-thumb"
                  type="button"
                  onClick={() => setPreviewPhoto({ url: item.previewUrl || item.url, fileName: item.fileName })}
                >
                  <img src={item.previewUrl || item.url} alt={item.fileName} />
                </button>
              ) : (
                <a className="button secondary" href={item.url} target="_blank" rel="noreferrer">
                  {item.linkType === "drive-folder" ? "Open Drive Folder" : "Open Photo Link"}
                </a>
              )}
              <div className="photo-link-row">
                <a href={item.url} target="_blank" rel="noreferrer">
                  Open original link
                </a>
              </div>
            </div>
          ))}
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
                <div className="timeline-meta">{formatDateTime(item.createdAt)}</div>
                {item.note ? <p className="timeline-note">{item.note}</p> : null}
                {item.metadata?.sendingMedium ? <div className="timeline-meta">Medium: {item.metadata.sendingMedium}</div> : null}
                {item.metadata?.proofPhotoUrl ? (
                  <div className="timeline-meta">
                    Proof Photo:{" "}
                    <a href={item.metadata.proofPhotoUrl} target="_blank" rel="noreferrer">
                      {item.metadata.proofPhotoFileName ?? "View file"}
                    </a>
                  </div>
                ) : null}
                {item.metadata?.proofPhotoPreviewUrl ? (
                  <button
                    className="photo-thumb"
                    type="button"
                    onClick={() =>
                      setPreviewPhoto({
                        url: item.metadata?.proofPhotoPreviewUrl || item.metadata?.proofPhotoUrl || "",
                        fileName: item.metadata?.proofPhotoFileName || "Proof photo",
                      })
                    }
                  >
                    <img src={item.metadata.proofPhotoPreviewUrl} alt={item.metadata.proofPhotoFileName ?? "Proof photo"} />
                  </button>
                ) : null}
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
    case "MARK_AS_GR":
      return "Marked As GR";
    case "UPDATE":
      return "Repair Updated";
    case "DELETE":
      return "Repair Deleted";
    default:
      return action;
  }
}
