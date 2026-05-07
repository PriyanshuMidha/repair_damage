"use client";

import { Capacitor } from "@capacitor/core";

export function PrintButton({ label = "Print Receipt", href }: { label?: string; href?: string }) {
  return (
    <button
      className="button secondary"
      type="button"
      onClick={() => {
        if (href) {
          if (Capacitor.isNativePlatform()) {
            window.location.assign(href);
            return;
          }
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
