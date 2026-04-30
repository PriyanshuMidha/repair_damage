"use client";

import Link from "next/link";
import { use, useEffect, useState, useTransition } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { DELIVERY_MODES, type ActionPayload, type DeliveryMode, type RepairDetail } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export default function RepairDetailPage({ params }: Params) {
  const { id } = use(params);
  const [repair, setRepair] = useState<RepairDetail | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [action, setAction] = useState<ActionPayload["action"] | "">("");
  const [form, setForm] = useState({
    remarks: "",
    repairCenter: "",
    sentToRepairByStaffName: "",
    receivedAfterRepairByStaffName: "",
    checkedByStaffName: "",
    returnedByStaffName: "",
    returnReceivedBy: "",
    deliveryMode: "By Hand" as DeliveryMode,
    courierName: "",
    trackingNumber: "",
    transportName: "",
    correctionPatch: "",
  });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    load(id);
  }, [id]);

  function load(repairId = id) {
    startTransition(async () => {
      const response = await fetch(`/api/repairs/${repairId}`, { cache: "no-store" });
      const data = await response.json();
      if (response.ok) setRepair(data.repair);
      else setError(data.error ?? "Could not load repair.");
    });
  }

  function runAction(selectedAction = action) {
    if (!selectedAction) return;
    setError("");
    setMessage("");
    startTransition(async () => {
      let patch: unknown = undefined;
      if (selectedAction === "admin-correct" && form.correctionPatch.trim()) {
        try {
          patch = JSON.parse(form.correctionPatch);
        } catch {
          setError("Correction patch must be valid JSON.");
          return;
        }
      }
      const response = await fetch(`/api/repairs/${id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: selectedAction, role: selectedAction === "admin-correct" ? "admin" : "staff", ...form, patch }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Action failed.");
        return;
      }
      setRepair(data.repair);
      setAction("");
      setMessage("Action completed and audit history updated.");
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

  function regenerateReceipt() {
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/repairs/${id}/receipt`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Receipt generation failed.");
        return;
      }
      setMessage(`WhatsApp template ready:\n${data.whatsAppMessage}`);
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

  const canAddPhoto = repair.currentStatus !== "Returned To Customer" && repair.currentStatus !== "Cancelled";

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <div className="eyebrow">Repair Detail</div>
          <h1>{repair.repairNumber}</h1>
          <p>
            {repair.party.name} · {repair.product.code} · Qty {repair.quantity}
          </p>
        </div>
        <div className="actions">
          <Link className="button secondary" href="/repairs">
            Back
          </Link>
          <Link className="button secondary" href={`/repairs/${repair.id}/receipt`}>
            Print Receipt
          </Link>
          <a className="button secondary" href={`/api/repairs/${repair.id}/receipt/pdf`}>
            Download PDF
          </a>
        </div>
      </section>

      <div className="grid two">
        <section className="card grid">
          <div className="toolbar">
            <h2>Current State</h2>
            <StatusBadge status={repair.currentStatus} />
          </div>
          {repair.photos.length === 0 ? <div className="notice">No photo attached. Allowed, but evidence is recommended.</div> : null}
          <table>
            <tbody>
              <Row label="Party" value={`${repair.party.name} (${repair.party.phone})`} />
              <Row label="Receiver Staff" value={repair.receiverStaffName} />
              <Row label="Product" value={`${repair.product.code} - ${repair.product.name}, ${repair.product.color}`} />
              <Row label="Rates" value={`Sale Rs. ${repair.product.saleRate}, Purchase Rs. ${repair.product.purchaseRate}`} />
              <Row label="Billing" value={repair.isBilled ? `Yes - ${repair.billOrGrReference}` : "No"} />
              <Row label="Product Condition" value={repair.productCondition} />
              <Row label="Damage" value={`${repair.damageCategory}: ${repair.damageRemarks}`} />
              <Row label="Repair Center" value={repair.repairCenter ?? "Not sent yet"} />
              <Row label="Sent By" value={repair.sentToRepairByStaffName ?? "Not sent yet"} />
              <Row label="Received After Repair By" value={repair.receivedAfterRepairByStaffName ?? "Not received yet"} />
              <Row label="Checked By" value={repair.checkedByStaffName ?? "Not checked yet"} />
              <Row label="Return" value={repair.returnedAt ? `${repair.deliveryMode} to ${repair.returnReceivedBy}` : "Not returned"} />
            </tbody>
          </table>

          <div className="actions">
            {repair.currentStatus === "Received" || repair.currentStatus === "Rework Required" ? (
              <button className="button" onClick={() => setAction("send-to-repair")}>
                Send To Repair
              </button>
            ) : null}
            {repair.currentStatus === "Repair In Progress" ? (
              <button className="button" onClick={() => setAction("receive-from-repair")}>
                Receive From Repair
              </button>
            ) : null}
            {repair.currentStatus === "Received After Repair" ? (
              <>
                <button className="button" onClick={() => setAction("mark-ready")}>
                  Mark Ready
                </button>
                <button className="button secondary" onClick={() => setAction("mark-rework")}>
                  Rework Required
                </button>
                <button className="button danger" onClick={() => setAction("mark-failed")}>
                  Repair Failed
                </button>
              </>
            ) : null}
            {repair.currentStatus === "Ready To Return" || repair.currentStatus === "Repair Failed" ? (
              <button className="button" onClick={() => setAction("return-to-customer")}>
                Return To Customer
              </button>
            ) : null}
            {repair.currentStatus !== "Returned To Customer" && repair.currentStatus !== "Cancelled" ? (
              <>
                <button className="button secondary" onClick={() => setAction("cancel")}>
                  Cancel
                </button>
                <button className="button secondary" onClick={() => setAction("admin-correct")}>
                  Admin Correction
                </button>
              </>
            ) : null}
            <button className="button secondary" onClick={regenerateReceipt}>
              Regenerate Receipt
            </button>
          </div>

          {action ? (
            <div className="card grid">
              <h3>{actionLabel(action)}</h3>
              {action === "send-to-repair" ? (
                <>
                  <Input label="Repair Center" value={form.repairCenter} onChange={(value) => setForm({ ...form, repairCenter: value })} />
                  <Input label="Sending Staff Name" value={form.sentToRepairByStaffName} onChange={(value) => setForm({ ...form, sentToRepairByStaffName: value })} />
                </>
              ) : null}
              {action === "receive-from-repair" ? (
                <Input
                  label="Received After Repair By Staff"
                  value={form.receivedAfterRepairByStaffName}
                  onChange={(value) => setForm({ ...form, receivedAfterRepairByStaffName: value })}
                />
              ) : null}
              {["mark-ready", "mark-rework", "mark-failed"].includes(action) ? (
                <Input label="Checked By Staff Name" value={form.checkedByStaffName} onChange={(value) => setForm({ ...form, checkedByStaffName: value })} />
              ) : null}
              {action === "return-to-customer" ? (
                <>
                  <Input label="Returned By Staff Name" value={form.returnedByStaffName} onChange={(value) => setForm({ ...form, returnedByStaffName: value })} />
                  <Input label="Received By Party/Customer" value={form.returnReceivedBy} onChange={(value) => setForm({ ...form, returnReceivedBy: value })} />
                  <label className="field">
                    <span>Delivery Mode</span>
                    <select className="input" value={form.deliveryMode} onChange={(event) => setForm({ ...form, deliveryMode: event.target.value as DeliveryMode })}>
                      {DELIVERY_MODES.map((mode) => (
                        <option key={mode}>{mode}</option>
                      ))}
                    </select>
                  </label>
                  {form.deliveryMode === "Courier" ? (
                    <>
                      <Input label="Courier Name" value={form.courierName} onChange={(value) => setForm({ ...form, courierName: value })} />
                      <Input label="Tracking Number" value={form.trackingNumber} onChange={(value) => setForm({ ...form, trackingNumber: value })} />
                    </>
                  ) : null}
                  {form.deliveryMode === "Transport" ? (
                    <>
                      <Input label="Transport Name" value={form.transportName} onChange={(value) => setForm({ ...form, transportName: value })} />
                      <Input label="Tracking Number" value={form.trackingNumber} onChange={(value) => setForm({ ...form, trackingNumber: value })} />
                    </>
                  ) : null}
                </>
              ) : null}
              {action === "admin-correct" ? (
                <label className="field">
                  <span>Optional Core Field Patch JSON</span>
                  <textarea
                    className="input"
                    value={form.correctionPatch}
                    onChange={(event) => setForm({ ...form, correctionPatch: event.target.value })}
                    placeholder='{"damageRemarks":"Corrected damage note","quantity":2}'
                  />
                </label>
              ) : null}
              <label className="field">
                <span>Remarks {["mark-rework", "mark-failed", "cancel", "admin-correct"].includes(action) ? "(required)" : ""}</span>
                <textarea className="input" value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} />
              </label>
              <div className="actions">
                <button className="button" disabled={isPending} onClick={() => runAction()}>
                  Confirm
                </button>
                <button className="button secondary" onClick={() => setAction("")}>
                  Close
                </button>
              </div>
            </div>
          ) : null}

          {error ? <div className="notice">{error}</div> : null}
          {message ? <pre className="notice">{message}</pre> : null}
        </section>

        <section className="card grid">
          <h2>Photos</h2>
          {repair.photos.map((item) => (
            <div className="notice" key={item.id}>
              <strong>{item.fileName}</strong>
              <br />
              <a href={item.url} target="_blank" rel="noreferrer">
                {item.url}
              </a>
              <br />
              <img src={item.url} alt={item.fileName} style={{ borderRadius: 12, marginTop: 10, maxHeight: 160, maxWidth: "100%" }} />
            </div>
          ))}
          {canAddPhoto ? (
            <div className="grid">
              <label className="field">
                <span>Upload Photo</span>
                <input className="input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)} />
              </label>
              {photoFile ? <div className="notice">Selected photo: {photoFile.name}</div> : null}
              <button className="button secondary" onClick={uploadPhoto} disabled={isPending}>
                Upload Photo
              </button>
            </div>
          ) : null}
        </section>
      </div>

      <section className="card grid" style={{ marginTop: 16 }}>
        <h2>Audit Timeline</h2>
        <div className="timeline">
          {repair.history.map((item) => (
            <div className="timeline-item" key={item.id}>
              <strong>{item.action}</strong> · {item.fromStatus ?? "New"} → {item.toStatus}
              <br />
              <small>
                {item.userName} · {new Date(item.createdAt).toLocaleString()}
              </small>
              {item.remarks ? <p>{item.remarks}</p> : null}
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

function actionLabel(action: string) {
  return action
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}
