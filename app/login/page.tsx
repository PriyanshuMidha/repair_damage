"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [form, setForm] = useState({ username: "", password: "" });
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError("");
    if (!form.username.trim()) {
      setError("Username is required.");
      return;
    }
    if (!form.password) {
      setError("Password is required.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.username.trim(), password: form.password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof data?.error === "string" ? data.error : "Invalid username or password");
        return;
      }
      router.replace("/repairs");
      router.refresh();
    });
  }

  return (
    <main className="shell login-shell">
      <section className="card grid login-card">
        <div>
          <div className="eyebrow">Repair Control Room</div>
          <h1 className="login-title">Login</h1>
          <p>Sign in to access repair list, reports, preview, editing, and workflow controls.</p>
        </div>

        <label className="field">
          <span>Username</span>
          <input className="input" value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            className="input"
            type="password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
          />
        </label>

        {error ? <div className="notice">{error}</div> : null}

        <div className="actions">
          <button className="button" type="button" disabled={isPending} onClick={submit}>
            {isPending ? "Logging in..." : "Login"}
          </button>
        </div>
      </section>
    </main>
  );
}
