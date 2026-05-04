"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { RepairBackButton } from "@/components/RepairBackButton";

type CreateResponse = {
  repair?: { id: string; repairNumber: string };
  error?: string;
};

export default function NewRepairPage() {
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [createdId, setCreatedId] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    partyName: "",
    receivedFromCustomerBy: "",
    productDetails: "",
    productColor: "",
    sellingPrice: "",
    initialRemark: "",
  });

  const hasUnsavedChanges = (!createdId && Object.values(form).some(Boolean)) || Boolean(photoFile);

  function submit() {
    setError("");
    setWarning("");
    if (!form.partyName.trim()) {
      setError("Party name is required.");
      return;
    }
    if (!form.receivedFromCustomerBy.trim()) {
      setError("Received from customer by is required.");
      return;
    }
    if (!form.productDetails.trim()) {
      setError("Product details are required.");
      return;
    }
    if (!form.initialRemark.trim()) {
      setError("Remark is required.");
      return;
    }
    if (form.sellingPrice === "" || Number.isNaN(Number(form.sellingPrice))) {
      setError("Selling price is required.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/repairs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyName: form.partyName,
          receivedFromCustomerBy: form.receivedFromCustomerBy,
          productDetails: form.productDetails,
          productColor: form.productColor || undefined,
          sellingPrice: Number(form.sellingPrice),
          initialRemark: form.initialRemark,
        }),
      });
      const data = (await response.json()) as CreateResponse;
      if (!response.ok || !data.repair) {
        setError(data.error ?? "Could not create repair.");
        return;
      }

      if (photoFile) {
        const photoData = new FormData();
        photoData.append("photo", photoFile);
        const photoResponse = await fetch(`/api/repairs/${data.repair.id}/photos`, {
          method: "POST",
          body: photoData,
        });
        if (!photoResponse.ok) {
          const photoError = await photoResponse.json();
          setWarning(photoError.error ?? "Repair saved, but photo upload failed.");
        }
      }

      const nextDownloadUrl = `/api/repairs/${data.repair.id}/receipt/pdf`;
      setCreatedId(data.repair.id);
      setDownloadUrl(nextDownloadUrl);
      triggerDownload(nextDownloadUrl, `${data.repair.repairNumber}.pdf`);
      setWarning((current) => current || "Receipt download started. If it does not open automatically, use Download Receipt.");
    });
  }

  return (
    <main className="shell">
      <section className="hero compact-hero">
        <div>
          <div className="eyebrow">Add Repair</div>
          <h1>New repair entry</h1>
        </div>
        <RepairBackButton hasUnsavedChanges={hasUnsavedChanges} />
      </section>

      <section className="card grid repair-form">
        <div className="form-section">
          <h2>Repair Intake</h2>
          <div className="grid two">
            <Input label="Party Name" value={form.partyName} onChange={(value) => setForm({ ...form, partyName: value })} placeholder="Required" />
            <Input
              label="Received from customer by"
              value={form.receivedFromCustomerBy}
              onChange={(value) => setForm({ ...form, receivedFromCustomerBy: value })}
              placeholder="Required"
            />
            <Input label="Product Color" value={form.productColor} onChange={(value) => setForm({ ...form, productColor: value })} />
            <Input
              label="Selling Price"
              type="number"
              value={form.sellingPrice}
              onChange={(value) => setForm({ ...form, sellingPrice: value })}
              placeholder="Required"
            />
          </div>
        </div>

        <div className="form-section">
          <h2>Product Details</h2>
          <label className="field">
            <span>Product details</span>
            <textarea className="input" value={form.productDetails} onChange={(event) => setForm({ ...form, productDetails: event.target.value })} />
          </label>
        </div>

        <div className="form-section">
          <h2>Remark and Photo</h2>
          <div className="grid">
            <label className="field">
              <span>Add Photo</span>
              <input className="input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)} />
            </label>
            {photoFile ? <div className="notice">Selected photo: {photoFile.name}</div> : null}
            <label className="field">
              <span>Remark</span>
              <textarea className="input" value={form.initialRemark} onChange={(event) => setForm({ ...form, initialRemark: event.target.value })} />
            </label>
          </div>
        </div>

        {error ? <div className="notice">{error}</div> : null}
        {warning ? <div className="notice">{warning}</div> : null}
        {createdId ? (
          <div className="notice">
            Repair created. <Link href={`/repairs/${createdId}`}>Open preview</Link>, <Link href={`/repairs/${createdId}/receipt`}>view receipt</Link>
            {downloadUrl ? (
              <>
                {" "}
                or{" "}
                <a className="button secondary" href={downloadUrl}>
                  Download Receipt
                </a>
              </>
            ) : null}
          </div>
        ) : null}

        <div className="actions">
          <button className="button" type="button" disabled={isPending || Boolean(createdId)} onClick={submit}>
            {isPending ? "Saving..." : "Submit Repair Entry"}
          </button>
        </div>
      </section>
    </main>
  );
}

function Input({
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

function triggerDownload(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
