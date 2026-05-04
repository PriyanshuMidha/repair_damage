"use client";

import { useRouter } from "next/navigation";

type Props = { className?: string; hasUnsavedChanges?: boolean };

export function RepairBackButton({ className, hasUnsavedChanges = false }: Props) {
  const router = useRouter();

  function handleBack() {
    if (hasUnsavedChanges && !window.confirm("You have unsaved changes. Leave this page?")) return;

    if (typeof window === "undefined") {
      router.push("/repairs");
      return;
    }

    if (window.history.length > 1) router.back();
    else router.push("/repairs");
  }

  return (
    <button type="button" className={className ?? "button secondary"} onClick={handleBack}>
      Back
    </button>
  );
}
