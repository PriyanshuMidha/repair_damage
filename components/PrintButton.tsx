"use client";

export function PrintButton({ label = "Print Receipt", href }: { label?: string; href?: string }) {
  return (
    <button
      className="button secondary"
      type="button"
      onClick={() => {
        if (href) {
          window.open(href, "_blank", "noopener,noreferrer");
          return;
        }
        window.print();
      }}
    >
      {label}
    </button>
  );
}
