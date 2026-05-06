"use client";

import { useEffect } from "react";

export function AutoPrint() {
  useEffect(() => {
    const handle = window.setTimeout(() => window.print(), 150);
    return () => window.clearTimeout(handle);
  }, []);

  return null;
}
