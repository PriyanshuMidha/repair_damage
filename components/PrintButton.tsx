"use client";

export function PrintButton({ label = "Print Receipt" }: { label?: string }) {
  return (
    <button className="button secondary" type="button" onClick={() => window.print()}>
      {label}
    </button>
  );
}
