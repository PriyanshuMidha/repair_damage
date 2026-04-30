"use client";

export function PrintButton() {
  return (
    <button className="button" onClick={() => window.print()}>
      Use Browser Print
    </button>
  );
}
