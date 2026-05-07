"use client";

import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { useState, useTransition } from "react";

type Props = {
  className?: string;
  fallbackCopiedLabel?: string;
  label: string;
  text: string;
  title: string;
  url?: string;
};

export function NativeShareButton({ className = "button secondary", fallbackCopiedLabel = "Link copied.", label, text, title, url }: Props) {
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function share() {
    setMessage("");
    startTransition(async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          await Share.share({ dialogTitle: title, text, title, url: resolveUrl(url) });
          return;
        }

        if (navigator.share) {
          await navigator.share({ text, title, url: resolveUrl(url) });
          return;
        }

        const fallback = resolveUrl(url) || text;
        if (fallback && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(fallback);
          setMessage(fallbackCopiedLabel);
          return;
        }

        setMessage("Share is not available on this device.");
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setMessage("Could not open share options.");
      }
    });
  }

  return (
    <>
      <button className={className} type="button" disabled={isPending} onClick={share}>
        {isPending ? "Opening share..." : label}
      </button>
      {message ? <div className="inline-notice">{message}</div> : null}
    </>
  );
}

function resolveUrl(url?: string) {
  if (!url) return undefined;
  if (!url.startsWith("/") || typeof window === "undefined") return url;
  return `${window.location.origin}${url}`;
}
