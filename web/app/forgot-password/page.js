"use client";

import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("sending");
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setStatus("sent");
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-slate-50 px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-bold text-slate-900">Wachtwoord vergeten</h1>
          <p className="text-sm text-slate-500 mt-1">Vul je e-mailadres in, dan sturen we een link om een nieuw wachtwoord in te stellen.</p>
        </div>

        {status === "sent" ? (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 text-center">
            <p className="text-sm text-slate-700">
              Als dit e-mailadres bij ons bekend is, ontvang je zo een link om je wachtwoord opnieuw in te stellen.
            </p>
            <a href="/login" className="inline-block mt-4 text-sm text-indigo-600 hover:underline">
              Terug naar inloggen
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">E-mailadres</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 transition-colors disabled:opacity-40"
            >
              {status === "sending" ? "Versturen..." : "Verstuur link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
