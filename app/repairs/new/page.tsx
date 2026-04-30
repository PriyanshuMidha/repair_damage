"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { DAMAGE_CATEGORIES, type DamageCategory, type Party, type Product } from "@/lib/types";

type Masters = { parties: Party[]; products: Product[] };

const steps = ["Party + Receiver", "Billing / GR", "Product", "Damage + Photo", "Review", "Receipt"] as const;

export default function NewRepairPage() {
  const [masters, setMasters] = useState<Masters>({ parties: [], products: [] });
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [createdId, setCreatedId] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    partyId: "",
    receiverStaffName: "",
    productId: "",
    quantity: 1,
    isBilled: false,
    billOrGrReference: "",
    damageCategory: "Other" as DamageCategory,
    damageRemarks: "",
    productCondition: "",
  });

  useEffect(() => {
    fetch("/api/masters")
      .then((response) => response.json())
      .then((data: Masters) => {
        setMasters(data);
        setForm((current) => ({
          ...current,
          partyId: data.parties[0]?.id ?? "",
          productId: data.products[0]?.id ?? "",
          receiverStaffName: current.receiverStaffName || "Counter Staff",
        }));
      });
  }, []);

  const selectedParty = masters.parties.find((party) => party.id === form.partyId);
  const selectedProduct = masters.products.find((product) => product.id === form.productId);

  function nextStep() {
    setError("");
    if (step === 0 && !form.receiverStaffName.trim()) {
      setError("Receiver staff name is required.");
      return;
    }
    if (step === 1 && form.isBilled && !form.billOrGrReference.trim()) {
      setError("Bill / GR reference is required when billed.");
      return;
    }
    if (step === 2 && (!form.productId || form.quantity < 1)) {
      setError("Valid product and quantity are required.");
      return;
    }
    if (step === 3 && (!form.productCondition.trim() || !form.damageRemarks.trim())) {
      setError("Product condition and damage remarks are required.");
      return;
    }
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function submit() {
    setError("");
    setWarning("");
    startTransition(async () => {
      const response = await fetch("/api/repairs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) {
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
          const photoData = await photoResponse.json();
          setWarning(photoData.error ?? "Repair saved, but photo upload failed.");
        }
      } else {
        setWarning(data.warning ?? "No photo attached yet.");
      }
      setCreatedId(data.repair.id);
      setStep(5);
    });
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <div className="eyebrow">Receive Goods</div>
          <h1>Create repair entry.</h1>
          <p>Step-by-step entry for party, billing, product, damage, photo proof, review, and receipt.</p>
        </div>
        <Link className="button secondary" href="/repairs">
          Back to List
        </Link>
      </section>

      <section className="card grid">
        <div className="actions">
          {steps.map((label, index) => (
            <button key={label} className={`button ${index === step ? "" : "secondary"}`} onClick={() => setStep(index)} disabled={index === 5 && !createdId}>
              {index + 1}. {label}
            </button>
          ))}
        </div>

        {step === 0 ? (
          <div className="grid two">
            <label className="field">
              <span>Party who returned goods</span>
              <select className="input" value={form.partyId} onChange={(event) => setForm({ ...form, partyId: event.target.value })}>
                {masters.parties.map((party) => (
                  <option value={party.id} key={party.id}>
                    {party.name} - {party.type}
                  </option>
                ))}
              </select>
            </label>
            <Input label="Receiver Staff Name" value={form.receiverStaffName} onChange={(value) => setForm({ ...form, receiverStaffName: value })} />
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid two">
            <label className="field">
              <span>Has Bill / GR?</span>
              <select className="input" value={String(form.isBilled)} onChange={(event) => setForm({ ...form, isBilled: event.target.value === "true" })}>
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </label>
            <Input
              label="Bill / GR Reference"
              value={form.billOrGrReference}
              onChange={(value) => setForm({ ...form, billOrGrReference: value })}
              placeholder={form.isBilled ? "Required when billed" : "Optional"}
            />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid">
            <div className="grid two">
              <label className="field">
                <span>Product Code</span>
                <select className="input" value={form.productId} onChange={(event) => setForm({ ...form, productId: event.target.value })}>
                  {masters.products.map((product) => (
                    <option value={product.id} key={product.id}>
                      {product.code} - {product.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Quantity</span>
                <input className="input" type="number" min="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })} />
              </label>
            </div>
            {selectedProduct ? (
              <div className="notice">
                Auto-filled: {selectedProduct.name}, {selectedProduct.color}, sale rate Rs. {selectedProduct.saleRate}, purchase rate Rs. {selectedProduct.purchaseRate}
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid">
            <div className="grid two">
              <label className="field">
                <span>Damage Category</span>
                <select className="input" value={form.damageCategory} onChange={(event) => setForm({ ...form, damageCategory: event.target.value as DamageCategory })}>
                  {DAMAGE_CATEGORIES.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>
              <Input label="Product Condition" value={form.productCondition} onChange={(value) => setForm({ ...form, productCondition: value })} placeholder="Broken handle, dented box, not working..." />
            </div>
            <label className="field">
              <span>Damage Photo (recommended)</span>
              <input className="input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)} />
            </label>
            {photoFile ? <div className="notice">Selected photo: {photoFile.name}</div> : <div className="notice">Photo is recommended but not mandatory.</div>}
            <label className="field">
              <span>Damage Remarks</span>
              <textarea className="input" value={form.damageRemarks} onChange={(event) => setForm({ ...form, damageRemarks: event.target.value })} />
            </label>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="grid">
            <h2>Review Repair Entry</h2>
            <table>
              <tbody>
                <ReviewRow label="Party" value={selectedParty ? `${selectedParty.name} (${selectedParty.phone})` : "Not selected"} />
                <ReviewRow label="Receiver Staff" value={form.receiverStaffName} />
                <ReviewRow label="Billing" value={form.isBilled ? `Yes - ${form.billOrGrReference}` : "No"} />
                <ReviewRow label="Product" value={selectedProduct ? `${selectedProduct.code} - ${selectedProduct.name}` : "Not selected"} />
                <ReviewRow label="Quantity" value={String(form.quantity)} />
                <ReviewRow label="Product Condition" value={form.productCondition} />
                <ReviewRow label="Damage" value={`${form.damageCategory}: ${form.damageRemarks}`} />
                <ReviewRow label="Photo" value={photoFile ? photoFile.name : "No photo selected"} />
              </tbody>
            </table>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="grid">
            <h2>Receipt Generated</h2>
            {createdId ? (
              <div className="notice">
                Repair created successfully. <Link href={`/repairs/${createdId}`}>Open detail</Link> or <Link href={`/repairs/${createdId}/receipt`}>print receipt</Link>.
              </div>
            ) : (
              <div className="notice">Submit the reviewed repair entry to generate a receipt.</div>
            )}
          </div>
        ) : null}

        {error ? <div className="notice">{error}</div> : null}
        {warning ? <div className="notice">{warning}</div> : null}

        <div className="toolbar">
          <button className="button secondary" onClick={() => setStep((current) => Math.max(current - 1, 0))} disabled={step === 0 || isPending}>
            Previous
          </button>
          {step < 4 ? (
            <button className="button" onClick={nextStep} disabled={isPending}>
              Next Step
            </button>
          ) : null}
          {step === 4 ? (
            <button className="button" onClick={submit} disabled={isPending}>
              {isPending ? "Creating..." : "Create Repair + Receipt"}
            </button>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input className="input" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <th>{label}</th>
      <td>{value}</td>
    </tr>
  );
}
