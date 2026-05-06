"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { RepairBackButton } from "@/components/RepairBackButton";
import { isPreviewablePhoto } from "@/lib/drive";
import { type RepairPhoto } from "@/lib/types";

export default function EditRepairPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photos, setPhotos] = useState<RepairPhoto[]>([]);
  const [form, setForm] = useState({
    partyName: "",
    receivedFromCustomerBy: "",
    productDetails: "",
    productColor: "",
    sellingPrice: "",
    initialRemark: "",
    repairNumber: "",
    status: "",
  });

  useEffect(() => {
    if (!id) return;
    fetch(`/api/repairs/${id}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        const r = data.repair;
        if (!r) {
          setError(data.error ?? "Repair not found.");
          setLoaded(true);
          return;
        }
        setForm({
          partyName: r.partyName ?? r.party?.name ?? "",
          receivedFromCustomerBy: r.receivedFromCustomerBy ?? "",
          productDetails: r.productDetails ?? "",
          productColor: r.productColor ?? "",
          sellingPrice: r.sellingPrice !== undefined ? String(r.sellingPrice) : "",
          initialRemark: r.initialRemark ?? "",
          repairNumber: r.repairNumber,
          status: r.status,
        });
        setPhotos(Array.isArray(r.photos) ? r.photos : []);
        setLoaded(true);
      })
      .catch(() => {
        setError("Could not load repair.");
        setLoaded(true);
      });
  }, [id]);

  function save() {
    setError("");
    setMessage("");
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
      const response = await fetch(`/api/repairs/${id}`, {
        method: "PATCH",
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
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not save.");
        return;
      }
      router.push(`/repairs/${id}`);
    });
  }

  function uploadPhoto() {
    setError("");
    setMessage("");
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
      setMessage("Photo saved successfully.");

      const repairResponse = await fetch(`/api/repairs/${id}`, { cache: "no-store" });
      const repairData = await repairResponse.json();
      if (repairResponse.ok && repairData.repair) {
        setPhotos(Array.isArray(repairData.repair.photos) ? repairData.repair.photos : []);
      }
    });
  }

  if (!loaded) {
    return (
      <main className="shell">
        <div className="card">Loading...</div>
      </main>
    );
  }

  if (error && form.repairNumber === "") {
    return (
      <main className="shell">
        <div className="card">{error}</div>
        <Link className="button secondary" href="/repairs" style={{ marginTop: 12 }}>
          Repair list
        </Link>
      </main>
    );
  }

  if (form.status !== "Received") {
    return (
      <main className="shell">
        <section className="card grid">
          <h2>Edit not allowed</h2>
          <p style={{ margin: 0 }}>Only repairs in Received status can be edited.</p>
          <div className="actions">
            <RepairBackButton />
            <Link className="button" href={`/repairs/${id}`}>
              Open preview
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="hero compact-hero">
        <div>
          <div className="eyebrow">Edit Repair</div>
          <h1 className="record-hero-title">{form.partyName || "Party Name"}</h1>
          <p className="record-hero-subtitle">Repair ID: {form.repairNumber}</p>
        </div>
        <RepairBackButton hasUnsavedChanges />
      </section>

      <section className="card grid repair-form">
        <div className="form-section">
          <h2>Repair Intake</h2>
          <div className="grid two">
            <Input label="Party Name" value={form.partyName} onChange={(value) => setForm({ ...form, partyName: value })} />
            <Input
              label="Received from customer by"
              value={form.receivedFromCustomerBy}
              onChange={(value) => setForm({ ...form, receivedFromCustomerBy: value })}
            />
            <Input label="Product Color" value={form.productColor} onChange={(value) => setForm({ ...form, productColor: value })} />
            <Input label="Selling Price" type="number" value={form.sellingPrice} onChange={(value) => setForm({ ...form, sellingPrice: value })} />
          </div>
        </div>

        <div className="form-section">
          <h2>Product Code</h2>
          <label className="field">
            <span>Product details</span>
            <textarea className="input" value={form.productDetails} onChange={(event) => setForm({ ...form, productDetails: event.target.value })} />
          </label>
        </div>

        <div className="form-section">
          <h2>Remark</h2>
          <label className="field">
            <span>Remark</span>
            <textarea className="input" value={form.initialRemark} onChange={(event) => setForm({ ...form, initialRemark: event.target.value })} />
          </label>
        </div>

        <div className="form-section">
          <h2>Photos</h2>
          {photos.length === 0 ? <div className="notice">No photo attached yet.</div> : null}
          {photos.map((photo) => (
            <div className="notice" key={photo.id}>
              <strong>{photo.fileName}</strong>
              <br />
              {isPreviewablePhoto(photo) ? (
                <img
                  src={photo.previewUrl || photo.url}
                  alt={photo.fileName}
                  style={{ borderRadius: 8, marginTop: 8, maxHeight: 180, maxWidth: "100%", objectFit: "contain" }}
                />
              ) : (
                <a className="button secondary" href={photo.url} target="_blank" rel="noreferrer" style={{ marginTop: 8 }}>
                  {photo.linkType === "drive-folder" ? "Open Drive Folder" : "Open Photo Link"}
                </a>
              )}
              <div className="photo-link-row">
                <a href={photo.url} target="_blank" rel="noreferrer">
                  Open original link
                </a>
              </div>
            </div>
          ))}
          <label className="field">
            <span>Upload Photo to Google Drive</span>
            <input className="input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)} />
          </label>
          {photoFile ? <div className="notice">Selected photo: {photoFile.name}</div> : null}
          <div className="actions">
            <button className="button secondary" type="button" disabled={isPending} onClick={uploadPhoto}>
              {isPending ? "Saving..." : "Save Photo"}
            </button>
          </div>
        </div>

        {error ? <div className="notice">{error}</div> : null}
        {message ? <div className="notice">{message}</div> : null}

        <div className="actions">
          <button className="button" type="button" disabled={isPending} onClick={save}>
            {isPending ? "Saving..." : "Save changes"}
          </button>
          <Link className="button secondary" href={`/repairs/${id}`}>
            Cancel
          </Link>
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
