"use client";

import { useState } from "react";

function Field({ label, ...props }) {
  return (
    <div>
      <label className="block text-sm font-medium text-white/70 mb-1.5">{label}</label>
      <input
        {...props}
        className="w-full rounded-lg border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#8AA0FF] focus:border-transparent"
      />
    </div>
  );
}

export default function ContactForm({ t }) {
  const [naam, setNaam] = useState("");
  const [email, setEmail] = useState("");
  const [organisatie, setOrganisatie] = useState("");
  const [bericht, setBericht] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ naam, email, organisatie, bericht }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? t.fallbackError);
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setError(err.message);
    }
  }

  return (
    <section className="mx-auto max-w-lg px-6 pt-20 pb-24">
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3 text-center">
        {t.title}{" "}
        <span className="bg-gradient-to-r from-[#6E8BFF] to-[#B07CFF] bg-clip-text text-transparent">{t.titleHighlight}</span>{" "}
        {t.titlePost}
      </h1>
      <p className="text-white/50 text-center mb-10 leading-relaxed">{t.text}</p>

      {status === "sent" ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <p className="text-white font-semibold mb-1">{t.sentTitle}</p>
          <p className="text-sm text-white/50">{t.sentText}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
          <Field label={t.name} type="text" required value={naam} onChange={(e) => setNaam(e.target.value)} />
          <Field label={t.email} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Field
            label={t.organisation}
            type="text"
            value={organisatie}
            onChange={(e) => setOrganisatie(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">{t.message}</label>
            <textarea
              required
              rows={5}
              value={bericht}
              onChange={(e) => setBericht(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#8AA0FF] focus:border-transparent resize-none"
            />
          </div>
          {status === "error" && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={status === "sending"}
            className="w-full rounded-full bg-gradient-to-r from-[#6E8BFF] to-[#B07CFF] py-3 text-sm font-semibold text-white shadow-lg shadow-[#6E8BFF]/20 hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {status === "sending" ? t.submitting : t.submit}
          </button>
        </form>
      )}
    </section>
  );
}
